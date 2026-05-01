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
import { buildWorkoutPrompt, type WorkoutRequestBody, normalizeWorkoutPlan } from '../shared';

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
    const systemPrompt = `You are a practical fitness coach. Create a simple workout plan for TODAY based on the user's last-week details.
Return JSON only with this shape:
{
  "workoutPlan": {
    "name": "string",
    "description": "string",
    "exercises": [
      {
        "name": "string",
        "sets": number,
        "reps": "string",
        "durationMinutes": number,
        "restSeconds": number,
        "category": "cardio" | "strength" | "flexibility" | "sports" | "other",
        "intensity": "low" | "medium" | "high"
      }
    ],
    "estimatedCalories": number,
    "progressionTip": "string",
    "reasoning": "string",
    "durationMinutes": number
  }
}
Rules:
- Order exercises as: warm-up first, then main work, then cool-down stretches.
- Include a true warm-up block (3-5 min, low intensity) before strength/cardio.
- Include at least 2 flexibility/cool-down stretches at the end (not just one).
- Keep total planned exercise time + typical rest transitions reasonably aligned with durationMinutes.
- If recent protein intake appears below 70% of protein target, mention recovery constraints in reasoning and avoid excessive high-volume programming.
- If recent daily steps exceed the target (or 8,000 when target is unavailable), acknowledge the user is already active and avoid stacking extra cardio volume unnecessarily.
- Keep it realistic, beginner-friendly when unclear, and aligned to the user's details.`;
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
    const ai = await createOpenAiJson<{ workoutPlan?: Record<string, unknown> }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
    });
    const workoutPlan = normalizeWorkoutPlan(ai.workoutPlan ?? ai);

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
          model: 'gpt-4o-mini',
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
