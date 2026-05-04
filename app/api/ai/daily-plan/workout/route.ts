import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { createOpenAiJson } from '@/lib/openaiJson';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';
import { writeDebugLog } from '@/lib/debugLogWriter';
import { OPENAI_BEST_MODEL } from '@/lib/aiModel';
import {
  buildWorkoutPrompt,
  deriveWorkoutPlanConstraints,
  type WorkoutRequestBody,
  normalizeWorkoutPlan,
} from '../shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;
    await connectDB();

    const plan = await DailyPlan.findOne({ userId, date: getToday() })
      .select('workoutPlan status feedback')
      .lean() as { workoutPlan?: unknown; status?: string; feedback?: { workoutDifficulty?: string } } | null;

    return maskedResponse({
      workoutPlan: plan?.workoutPlan ?? null,
      status: plan?.status ?? null,
      feedback: plan?.feedback ? { workoutDifficulty: plan.feedback.workoutDifficulty } : null,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch workout plan', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const body = await req.json().catch(() => ({})) as WorkoutRequestBody;
    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();
    const systemPrompt = `You are building a production-grade AI fitness planning system.
Your goal is not to generate a random workout.
Your goal is to understand physiology and behavior, choose the right training strategy, and generate a scientifically valid daily plan.

Return JSON only with this exact shape:
{
  "workoutPlan": {
    "name": "string",
    "description": "string",
    "strategyUsed": "full_body_fat_loss | upper_lower | push_pull_legs",
    "readinessAdjustment": "string",
    "exercises": [
      {
        "name": "string",
        "sets": number,
        "reps": "string",
        "durationMinutes": number,
        "restSeconds": number,
        "category": "cardio | strength | flexibility | core",
        "intensity": "low | medium | high",
        "muscleGroup": "legs | push | pull | core"
      }
    ],
    "estimatedCalories": number,
    "progressionTip": "string",
    "reasoning": "string",
    "durationMinutes": number
  }
}

Mandatory architecture:
1) Strategy engine (weekly logic): classify using bodyFatPct, fitnessLevel, activityLevel
2) Recovery/readiness adjustment: use protein intake, sleep, and steps logs
3) Daily workout generation
4) Fat-loss intelligence
5) MET-based calorie estimation

Rules:
- Beginner + bodyFatPct > 20 => full_body_fat_loss.
- Intermediate => upper_lower or push_pull_legs.
- Never assign body-part split to beginners.
- Always include at least 1 lower-body, 1 push, 1 pull, and 1 core movement.
- Order strictly: warm-up -> strength -> cardio -> core -> cooldown.
- Warm-up must be 3-5 minutes at low intensity.
- Cooldown must include at least 2 stretches.
- Keep total duration within +/-3 minutes of target duration.
- If protein < 70% of target: reduce volume.
- If steps > 8000 (or above target): reduce extra cardio.
- If steps < 3000: include light cardio.
- If sleep < 6h: avoid high intensity.
- If bodyFatPct >= 25: prioritize full-body structure, moderate cardio, and core every session.
- Do not use spot-reduction logic.
- Keep exercises beginner friendly and with low equipment dependency.
- Do not overestimate calories.`;
    const user = await User.findById(userId)
      .select('profile.gender profile.age profile.dateOfBirth profile.height profile.weight profile.activityLevel profile.goal profile.targetWeight profile.bodyType profile.bodyFat profile.fatFocusAreas profile.fitnessLevelDerived profile.fitnessLevelUser targets')
      .lean() as {
        profile?: {
          gender?: string;
          age?: number;
          dateOfBirth?: string | Date;
          height?: number;
          weight?: number;
          activityLevel?: string;
          goal?: string;
          targetWeight?: number;
          bodyType?: string;
          bodyFat?: number;
          fatFocusAreas?: string[];
          fitnessLevelDerived?: string;
          fitnessLevelUser?: string;
        };
        targets?: {
          dailyWorkoutMinutes?: number;
          dailyCalorieBurn?: number;
          dailyCalories?: number;
          dailyWater?: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          sleepHours?: number;
          dailySteps?: number;
        };
      } | null;

    const recentLogs = await DailyLog.find({ userId, date: { $lte: today } })
      .sort({ date: -1 })
      .limit(3)
      .select('date totalCalories totalProtein totalCarbs totalFat waterIntake caloriesBurned heartRate steps activeCalories distanceKm sleep.duration sleep.quality workouts.exercise workouts.category workouts.duration workouts.caloriesBurned workouts.sets workouts.reps workouts.source')
      .lean() as Array<{
        date?: string;
        totalCalories?: number;
        totalProtein?: number;
        totalCarbs?: number;
        totalFat?: number;
        waterIntake?: number;
        caloriesBurned?: number;
        heartRate?: number;
        steps?: number;
        activeCalories?: number;
        distanceKm?: number;
        sleep?: { duration?: number; quality?: number };
        workouts?: Array<{
          exercise?: string;
          category?: string;
          duration?: number;
          caloriesBurned?: number;
          sets?: number;
          reps?: number;
          source?: string;
        }>;
      }>;

    const recentFeedback = await DailyPlan.find({ userId, date: { $lte: today }, feedback: { $exists: true } })
      .sort({ date: -1 })
      .limit(3)
      .select('date feedback.workoutDifficulty feedback.skippedWorkoutReason')
      .lean() as Array<{
        date?: string;
        feedback?: {
          workoutDifficulty?: string;
          skippedWorkoutReason?: string;
        };
      }>;

    const userPrompt = buildWorkoutPrompt(body, today, {
      profile: user?.profile ?? null,
      targets: user?.targets ?? null,
      recentLogs,
      recentFeedback,
    });
    const constraints = deriveWorkoutPlanConstraints(body, {
      profile: user?.profile ?? null,
      targets: user?.targets ?? null,
      recentLogs,
      recentFeedback,
    });

    const ai = await createOpenAiJson<{ workoutPlan?: Record<string, unknown> }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
    });
    const workoutPlan = normalizeWorkoutPlan(ai.workoutPlan ?? ai, constraints);

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $set: { workoutPlan, status: 'ready', generatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    await writeDebugLog({
      userId,
      page: 'today-plan',
      agent: 'workout',
      payload: {
        userRequest: {
          requestedAt: new Date().toISOString(),
          action: 'generate',
          date: today,
          body,
        },
        systemPrompt,
        userPrompt,
        parsedResult: { workoutPlan },
        metadata: {
          status: 'success',
          model: OPENAI_BEST_MODEL,
        },
      },
    });

    return maskedResponse({ workoutPlan: (plan as { workoutPlan?: unknown } | null)?.workoutPlan ?? null });
  } catch (err) {
    console.error('[Workout Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate workout plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
