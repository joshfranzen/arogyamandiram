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
  deriveReadinessSignals,
  type WorkoutRequestBody,
  normalizeWorkoutPlan,
} from '../shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;
    await connectDB();

    const today = getToday();
    const [plan, todayLog] = await Promise.all([
      DailyPlan.findOne({ userId, date: today })
        .select('workoutPlan status feedback')
        .lean() as Promise<{ workoutPlan?: unknown; status?: string; feedback?: { workoutDifficulty?: string } } | null>,
      DailyLog.findOne({ userId, date: today })
        .select('workouts')
        .lean() as Promise<{ workouts?: Array<Record<string, unknown>> } | null>,
    ]);

    return maskedResponse({
      workoutPlan: plan?.workoutPlan ?? null,
      status: plan?.status ?? null,
      feedback: plan?.feedback ? { workoutDifficulty: plan.feedback.workoutDifficulty } : null,
      // Used by WorkoutTab to re-hydrate the "Logged" pill across page reloads.
      loggedToday: Array.isArray(todayLog?.workouts) ? todayLog!.workouts : [],
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
    const systemPrompt = `You are an evidence-based fitness coach generating ONE user's daily workout plan as JSON.

Your responsibilities, in order:
1. Read the user's last 7 days of workouts (provided in the user message). Decide the right training split for THIS user THIS week. Choices include — but you may also blend or invent — full body, upper/lower, push-pull-legs, or single-body-part-per-day. Pick what fits their fitness level, recovery state, and what's already been trained this week. Do NOT fall back to a default rule like "always full body for beginners" — use the data.
2. For today, choose body parts the user has NOT trained in the last 1–2 days. Aim for full-body weekly coverage.
3. Apply the readiness signals provided (protein deficit, sleep, steps).
4. Use the DERIVED goalDirection (lose / maintain / gain), NOT the raw profile.goal field. If goalDirection is "lose": lean toward higher total work and moderate cardio. If "maintain": balanced. If "gain": more strength volume, longer rests, less cardio.
5. Estimate calories burned with MET × bodyweight × time. Use these ranges; do NOT under- or over-estimate:
   - cardio:           low 3.5–4.5 · medium 5.0–7.0 · high 7.0–10.0
   - strength:         low 3.0–4.0 · medium 4.5–6.0 · high 6.0–8.0
   - core:             low 2.5–3.5 · medium 3.5–4.5 · high 4.5–6.0
   - flexibility:      2.0–2.5 (any intensity)

Hard constraints (always):
- Total session duration must be within ±3 minutes of "Today target minutes".
- The first exercise must have phase="warmup" (3–5 min, low intensity).
- The last 1–2 exercises must have phase="cooldown" or "mobility".
- Pick beginner-friendly, low-equipment exercises unless the user is intermediate or advanced.
- Never recommend spot reduction.

Return JSON only with this exact shape:
{
  "workoutPlan": {
    "name": "string",
    "description": "string",
    "weeklyStrategyChosen": "string — one sentence: which split you picked for the week and why",
    "whyToday": "string — one sentence: why today's session looks the way it does given recent days",
    "readinessAdjustment": "string — how today reflects the readiness signals",
    "exercises": [
      {
        "name": "string",
        "phase": "warmup | strength | cardio | core | mobility | cooldown",
        "sets": number,
        "reps": "string — e.g. '10', '10-12', '30 seconds', or 'continuous'",
        "durationMinutes": number,
        "restSeconds": number,
        "category": "cardio | strength | flexibility | core",
        "intensity": "low | medium | high",
        "muscleGroup": "legs | push | pull | core"
      }
    ],
    "estimatedCalories": number,
    "progressionTip": "string — one specific increase for next session",
    "reasoning": "string — short paragraph explaining the choices",
    "durationMinutes": number
  }
}`;
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

    // 7-day window ending today. We include today's recovery / nutrition / hydration
    // data so readiness signals are accurate, but the buildWeeklyWorkoutSummary
    // helper drops today's *workouts* from the LLM prompt to avoid feeding the model
    // the workout it's about to generate.
    const sevenDaysAgo = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return d.toISOString().slice(0, 10);
    })();
    const recentLogs = await DailyLog.find({ userId, date: { $gte: sevenDaysAgo, $lte: today } })
      .sort({ date: -1 })
      .limit(7)
      .select('date totalCalories totalProtein totalCarbs totalFat waterIntake caloriesBurned heartRate steps activeCalories distanceKm sleep.duration sleep.quality workouts.exercise workouts.planExerciseName workouts.category workouts.duration workouts.caloriesBurned workouts.sets workouts.reps workouts.source workouts.notes')
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
          planExerciseName?: string;
          category?: string;
          duration?: number;
          caloriesBurned?: number;
          sets?: number;
          reps?: number;
          source?: string;
          notes?: string;
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

    const promptContext = {
      profile: user?.profile ?? null,
      targets: user?.targets ?? null,
      recentLogs,
      recentFeedback,
    };
    const userPrompt = buildWorkoutPrompt(body, today, promptContext);
    const signals = deriveReadinessSignals(body, promptContext);

    const ai = await createOpenAiJson<{ workoutPlan?: Record<string, unknown> }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
    });
    const workoutPlan = normalizeWorkoutPlan(ai.workoutPlan ?? ai, signals);

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
