// ============================================
// /api/ai/daily-plan — Fetch or generate today's daily health plan
// ============================================
// GET  ?date=YYYY-MM-DD → returns stored DailyPlan + today's log data
// POST → generates plan immediately (manual fallback, max 3/day)

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday, getYesterday, getAgeFromDateOfBirth } from '@/lib/utils';
import { getLatestLoggedWeight } from '@/lib/latestWeight';
import { deriveFitnessLevel } from '@/lib/deriveFitnessLevel';

export const dynamic = 'force-dynamic';

// ─── Shared: OpenAI call ─────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{
  parsed: Record<string, unknown>;
  rawText: string;
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
}> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = res.status;
    if (status === 401 || status === 403) {
      throw new Error('Your OpenAI API key looks invalid or expired. Update it in Settings → API Keys.');
    }
    throw new Error((err.error?.message as string) || `OpenAI API error: ${status}`);
  }

  const data = await res.json();
  const rawText: string = data?.choices?.[0]?.message?.content;
  if (!rawText?.trim()) throw new Error('OpenAI returned an empty response.');
  return {
    parsed: JSON.parse(rawText) as Record<string, unknown>,
    rawText,
    usage: data?.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined,
  };
}

// ─── Shared: build context for a user ────────────────────────────────────────

async function buildUserContext(userId: string, targetDate: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('User not found');

  const profile = user.profile as {
    age?: number; dateOfBirth?: Date | string; gender?: string;
    height?: number; weight?: number; activityLevel?: string; goal?: string;
    targetWeight?: number; bodyType?: string; bodyFat?: number;
    fatFocusAreas?: string[]; fitnessLevelDerived?: string; fitnessLevelUser?: string;
  };
  const targets = user.targets as {
    dailyCalories?: number; dailyWater?: number; protein?: number; carbs?: number;
    fat?: number; idealWeight?: number; dailyWorkoutMinutes?: number;
    dailyCalorieBurn?: number; sleepHours?: number; dailySteps?: number;
  };

  const age = profile.dateOfBirth
    ? getAgeFromDateOfBirth(profile.dateOfBirth)
    : (profile.age ?? 0);
  const latestWeight = await getLatestLoggedWeight(userId);
  const currentWeight = latestWeight ?? profile.weight;

  const fitnessLevel = await deriveFitnessLevel(userId);

  const yesterday = getYesterday();
  const yesterdayLog = await DailyLog.findOne({ userId, date: yesterday }).lean() as {
    totalCalories?: number; totalProtein?: number; waterIntake?: number;
    workouts?: { duration?: number }[]; sleep?: { duration?: number };
  } | null;

  const yesterdayProtein = Number(yesterdayLog?.totalProtein) || 0;
  const yesterdayCalories = Number(yesterdayLog?.totalCalories) || 0;
  const proteinGap = Math.max(0, (targets.protein ?? 150) - yesterdayProtein);
  const calorieGap = (targets.dailyCalories ?? 2000) - yesterdayCalories;

  const recentLogs = await DailyLog.find({ userId }).sort({ date: -1 }).limit(7).lean() as {
    date: string; totalCalories?: number; totalProtein?: number; totalCarbs?: number;
    totalFat?: number; waterIntake?: number; weight?: number; caloriesBurned?: number;
    workouts?: { duration?: number }[]; sleep?: { duration?: number; quality?: number };
    heartRate?: number; steps?: number; activeCalories?: number; distanceKm?: number;
  }[];

  const todayPlan = await DailyPlan.findOne({ userId, date: getToday() }).lean() as {
    feedback?: { dislikedFoods?: string[]; workoutDifficulty?: string };
  } | null;
  const dislikedFoods = todayPlan?.feedback?.dislikedFoods ?? [];
  const lastWorkoutDifficulty = todayPlan?.feedback?.workoutDifficulty ?? 'just_right';

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 13);
  const cutoff = cutoffDate.toISOString().split('T')[0];
  const workoutLogs = await DailyLog.find({ userId, date: { $gte: cutoff }, 'workouts.0': { $exists: true } }).lean();
  const recentWorkoutsPerWeek = workoutLogs.length / 2;

  const avgWorkoutDuration = (() => {
    let total = 0, count = 0;
    for (const l of workoutLogs) {
      for (const w of (l.workouts as { duration?: number }[] ?? [])) {
        if (w.duration) { total += w.duration; count++; }
      }
    }
    return count > 0 ? Math.round(total / count) : 0;
  })();

  const avgCalories = recentLogs.length > 0
    ? recentLogs.reduce((s, l) => s + (Number(l.totalCalories) || 0), 0) / recentLogs.length
    : 0;
  const avgDeficit = avgCalories > 0 ? (targets.dailyCalories ?? 2000) - avgCalories : 0;
  const weeklyWeightChangeKg = avgDeficit > 0
    ? -(avgDeficit * 7 / 7700)
    : (avgDeficit < 0 ? (-avgDeficit * 7 / 7700) : 0);

  const profileContext = [
    `Profile: age ${age}y, gender ${profile.gender ?? '—'}, height ${profile.height ?? '—'}cm, weight ${currentWeight ?? '—'}kg.`,
    `Goal: ${profile.goal ?? '—'}, target weight ${profile.targetWeight ?? '—'}kg, activity ${profile.activityLevel ?? '—'}.`,
    `Body composition: type ${profile.bodyType ?? '—'}, body fat ${profile.bodyFat != null ? profile.bodyFat + '%' : '—'}, fitness ${fitnessLevel}, focus areas: ${profile.fatFocusAreas?.join(', ') || '—'}.`,
    `Daily targets: ${targets.dailyCalories ?? 2000} kcal, protein ${targets.protein ?? 150}g, carbs ${targets.carbs ?? 200}g, fat ${targets.fat ?? 67}g, water ${targets.dailyWater ?? 2500}ml.`,
    `Extended targets: ideal weight ${targets.idealWeight ?? '—'}kg, workout ${targets.dailyWorkoutMinutes ?? 30} min/day, burn ${targets.dailyCalorieBurn ?? 400} kcal/day, sleep ${targets.sleepHours ?? 8}h, steps ${targets.dailySteps ?? 8000}/day.`,
  ].join('\n');

  const recentContext = recentLogs.length > 0
    ? `Recent 7 days: ${JSON.stringify(recentLogs.map(l => {
        const row: Record<string, unknown> = {
          d: l.date,
          cal: Number(l.totalCalories) || 0,
          p: Number(l.totalProtein) || 0,
          w: Number(l.waterIntake) || 0,
          wm: Array.isArray(l.workouts) ? l.workouts.reduce((s, w) => s + (Number(w?.duration) || 0), 0) : 0,
        };
        if (l.sleep) row.s = { dur: Number(l.sleep.duration) || 0, q: Number(l.sleep.quality) || 0 };
        if (l.heartRate != null && l.heartRate > 0) row.hr = l.heartRate;
        if (l.steps != null && l.steps > 0) row.st = l.steps;
        if (l.activeCalories != null && l.activeCalories > 0) row.ac = l.activeCalories;
        if (l.distanceKm != null && l.distanceKm > 0) row.dk = Number(l.distanceKm.toFixed(2));
        return row;
      }))}`
    : 'No recent tracking data.';

  const yesterdayContext = yesterdayLog
    ? `Yesterday's intake: ${yesterdayCalories} kcal, ${yesterdayProtein}g protein. Protein gap: ${proteinGap}g.`
    : 'No data logged yesterday.';

  const feedbackContext = dislikedFoods.length > 0
    ? `User dislikes: ${dislikedFoods.join(', ')}. Avoid these foods.`
    : '';

  const difficultyNote = lastWorkoutDifficulty === 'too_hard'
    ? 'Yesterday\'s workout was too hard — suggest lighter intensity or recovery session.'
    : lastWorkoutDifficulty === 'too_easy'
      ? 'Yesterday\'s workout was too easy — increase difficulty slightly.'
      : '';

  const predictionContext = avgCalories > 0
    ? `Recent avg intake: ${Math.round(avgCalories)} kcal/day. Target: ${targets.dailyCalories ?? 2000} kcal/day. Avg ${avgDeficit > 0 ? 'deficit' : 'surplus'}: ${Math.abs(Math.round(avgDeficit))} kcal/day.`
    : '';

  return {
    profile, targets, profileContext, recentContext, yesterdayContext,
    feedbackContext, difficultyNote, predictionContext,
    currentWeight, fitnessLevel, proteinGap, calorieGap,
    yesterdayProtein, yesterdayCalories, recentWorkoutsPerWeek, avgWorkoutDuration,
    weeklyWeightChangeKg,
    generationContext: {
      yesterdayProteinG: yesterdayProtein, proteinGapG: proteinGap,
      yesterdayCalories, calorieGap, recentWorkoutsPerWeek, avgWorkoutDurationMin: avgWorkoutDuration,
    },
    predictionData: {
      weeklyWeightChangeKg: Number(weeklyWeightChangeKg.toFixed(2)),
      projectedWeightKg: currentWeight ? Number((currentWeight + weeklyWeightChangeKg * 4).toFixed(1)) : null,
    },
    targetDate,
  };
}

// ─── Focused generators ───────────────────────────────────────────────────────

async function generateFoodPlan(ctx: Awaited<ReturnType<typeof buildUserContext>>, apiKey: string) {
  const system = `You are an elite AI nutrition coach for Arogyamandiram. Generate ONLY a food plan.

Respond with this exact JSON:
{
  "foodPlan": {
    "suggestions": [
      {
        "name": "string",
        "description": "string",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "mealType": "breakfast"|"lunch"|"dinner"|"snack",
        "ingredients": ["string"],
        "isVegetarian": boolean
      }
    ],
    "reasoning": "1-2 sentences explaining WHY this food plan"
  }
}

Rules: Suggest 4-6 foods across meal types. Match the user's goals, preferences, and disliked foods. If protein gap > 20g, prioritize high-protein options. Keep suggestions specific and realistic.`;

  const userPrompt = [ctx.profileContext, ctx.recentContext, ctx.yesterdayContext, ctx.feedbackContext, `Plan date: ${ctx.targetDate}`].filter(Boolean).join('\n');
  const ai = await callOpenAI(apiKey, system, userPrompt);
  return {
    ...ai,
    request: {
      systemPrompt: system,
      userPrompt,
    },
  };
}

async function generateWorkoutPlan(ctx: Awaited<ReturnType<typeof buildUserContext>>, apiKey: string) {
  const system = `
  You are an elite performance-based fitness coach AI. Your job is to design
a safe, scientifically grounded, personalized workout STRUCTURE for one user.

You do NOT compute calories. A downstream validator computes kcal from the
(MET, durationMinutes, weight) you provide. Your only responsibilities are:
  1. Choose exercises appropriate to the user's profile and goals.
  2. Assign each exercise a MET value from the reference table.
  3. Assign each exercise a durationMinutes value.
  4. Ensure the plan's weighted-average MET meets the required threshold.

=========================
USER CONTEXT (dynamic — from backend)
=========================
- age: {{age}}
- gender: {{gender}}
- weight_kg: {{weight_kg}}
- height_cm: {{height_cm}}
- body_fat_pct: {{body_fat_pct}}
- body_type: {{body_type}}              // ectomorph | mesomorph | endomorph
- fitness_level: {{fitness_level}}      // beginner | intermediate | advanced
- primary_goal: {{primary_goal}}        // fat_loss | maintain | muscle_gain | endurance
- focus_areas: {{focus_areas}}          // e.g. ["belly","hips","chest"]
- equipment: {{equipment}}              // e.g. ["bodyweight","dumbbells","jump_rope"]
- injuries_or_limits: {{injuries}}      // e.g. ["knee_sensitive"] or []
- target_workout_minutes: {{target_minutes}}
- target_kcal_burn: {{target_kcal}}
- recent_activity_summary: {{recent_activity}}   // last 7 days avg HR, steps, sleep

=========================
DERIVED TARGETS (compute mentally, don't output arithmetic)
=========================
- required_avg_MET = target_kcal_burn / weight_kg
  (because MET × weight × 1h = kcal, so for a 1h session avg MET must equal kcal/weight)
- If target_workout_minutes ≠ 60, scale:
  required_avg_MET = target_kcal_burn / (weight_kg × target_minutes/60)

Your plan's weighted-average MET MUST be within [required_avg_MET × 0.98,
required_avg_MET × 1.08]. If you cannot reach it safely given the user's
fitness level and injuries, lower it and flag "target_unrealistic": true.

=========================
MET REFERENCE (use these; do not invent)
=========================
static_stretch_or_slow_walk: 2.0 – 2.5
dynamic_warmup_or_mobility: 3.0 – 3.5
light_resistance_or_yoga_flow: 3.5 – 4.5
bodyweight_strength_moderate: 5.5 – 6.5
loaded_strength_or_lunges: 6.0 – 7.0
steady_cardio_jog_cycle: 7.0 – 8.0
burpees_mountain_climbers_sustained: 8.5 – 9.5
jump_rope_fast_or_hiit_intervals: 10.0 – 11.5
sprint_or_all_out_circuit: 11.5 – 12.5

=========================
STRUCTURAL RULES
=========================
- Sum of durationMinutes MUST equal target_workout_minutes (exactly).
- No single exercise block may exceed 6 minutes. Break long blocks into
  named circuit rounds (e.g., "Strength Circuit Round 1", "Round 2").
- Required phases (scale proportionally if target_minutes ≠ 60):
  * Warm-up: 8–13% of total, MET ≤ 3.5
  * Main block: 50–60% of total, mix of strength and metabolic circuits
  * HIIT finisher: 20–28% of total, weighted-avg MET ≥ 9
  * Cool-down: 8–12% of total, MET ≤ 2.5
- Respect injuries_or_limits: omit contraindicated movements entirely.
- Adapt to body_type and primary_goal:
  * endomorph + fat_loss → higher metabolic density, longer HIIT
  * ectomorph + muscle_gain → longer strength blocks, shorter HIIT
  * beginner → cap MET at 9, add 5-sec form cues per exercise
  * advanced → allow MET 11+ in finisher
- Respect focus_areas: at least 40% of main-block minutes should train them.

=========================
WHAT YOU DO NOT DO
=========================
- Do NOT output any kcal fields.
- Do NOT output avgMET (backend computes it).
- Do NOT do arithmetic in prose or reasoning fields.
- Do NOT claim to hit a calorie target — the validator decides.
- Do NOT output text outside the JSON object.

=========================
OUTPUT SCHEMA (JSON only)
=========================
{
  "workoutPlan": {
    "name": "<concise, specific to user goal>",
    "description": "<one sentence, non-numeric>",
    "progressionTip": "<one actionable sentence for next session>",
    "exercises": [
      {
        "name": "<exercise or circuit name>",
        "steps": ["<3-5 beginner-friendly how-to steps, each a plain sentence>"],
        "phase": "warmup | main | finisher | cooldown",
        "durationMinutes": <integer>,
        "MET": <number from reference table>,
        "targets": ["<muscle or system>", ...],
        "form_cue": "<one short coaching cue>"
      }
    ],
    "durationMinutes": <integer, equals sum of exercises[].durationMinutes>,
    "target_unrealistic": <boolean>,
    "adaptation_notes": "<one sentence: how this plan is tailored to THIS user>"
  }
}
  `;

  const userPrompt = [ctx.profileContext, ctx.recentContext, ctx.difficultyNote, `Plan date: ${ctx.targetDate}`].filter(Boolean).join('\n');
  const ai = await callOpenAI(apiKey, system, userPrompt);
  return {
    ...ai,
    request: {
      systemPrompt: system,
      userPrompt,
    },
  };
}

async function generateOverview(ctx: Awaited<ReturnType<typeof buildUserContext>>, apiKey: string) {
  const system = `You are an elite AI health coach for Arogyamandiram. Generate ONLY a top insight and weight prediction.

Respond with this exact JSON:
{
  "topInsight": "One sentence: the #1 priority for the user today based on their data",
  "prediction": {
    "weeklyWeightChangeKg": number,
    "projectedWeightKg": number,
    "basis": "Brief explanation like 'Based on 5-day avg: -350 kcal/day deficit'"
  }
}`;

  const userPrompt = [ctx.profileContext, ctx.recentContext, ctx.yesterdayContext, ctx.predictionContext, `Plan date: ${ctx.targetDate}`].filter(Boolean).join('\n');
  const ai = await callOpenAI(apiKey, system, userPrompt);
  return {
    ...ai,
    request: {
      systemPrompt: system,
      userPrompt,
    },
  };
}

// ─── Shared: build plan for one user (full — used by cron) ───────────────────

async function buildPlanForUser(
  userId: string,
  apiKey: string,
  targetDate: string
): Promise<{
  parsed: Record<string, unknown>;
  generationContext: {
    yesterdayProteinG?: number;
    proteinGapG?: number;
    yesterdayCalories?: number;
    calorieGap?: number;
    recentWorkoutsPerWeek?: number;
    avgWorkoutDurationMin?: number;
  };
  fitnessLevelDerived: string;
  predictionData: {
    weeklyWeightChangeKg: number;
    projectedWeightKg: number | null;
  };
  request: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  };
}> {
  const ctx = await buildUserContext(userId, targetDate);

  const systemPrompt = `You are an elite AI health coach for Arogyamandiram. You generate a complete personalized daily health plan.

IMPORTANT: Always respond with this exact JSON structure:
{
  "topInsight": "One sentence: the #1 priority for the user today based on their data",
  "foodPlan": {
    "suggestions": [
      {
        "name": "string",
        "description": "string",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "mealType": "breakfast"|"lunch"|"dinner"|"snack",
        "ingredients": ["string"],
        "isVegetarian": boolean
      }
    ],
    "reasoning": "1-2 sentences explaining WHY this food plan — reference yesterday's gaps"
  },
  "workoutPlan": {
    "name": "string",
    "description": "string",
    "progressionTip": "string",
    "exercises": [
      {
        "name": "string",
        "steps": ["3-5 short bullet steps: how to do this exercise, written for beginners. Each step is one plain sentence. No markdown."],
        "sets": number,
        "reps": "string",
        "durationMinutes": number,
        "restSeconds": number,
        "intensity": "low"|"medium"|"high",
        "category": "cardio"|"strength"|"flexibility"|"sports"
      }
    ],
    "estimatedCalories": number,
    "durationMinutes": number,
    "reasoning": "1-2 sentences explaining WHY this workout plan"
  },
  "prediction": {
    "weeklyWeightChangeKg": number,
    "projectedWeightKg": number,
    "basis": "string — brief explanation like 'Based on 5-day avg: -350 kcal/day deficit'"
  }
}

Rules:
- Food plan: 4-6 suggestions across multiple meal types
- Workout: balanced session (warm-up → main → cool-down), duration close to target
- If protein gap > 20g: prioritize high-protein foods
- Avoid user's disliked foods
- Adjust workout intensity based on yesterday's difficulty feedback
- Be specific and actionable`;

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.yesterdayContext,
    ctx.feedbackContext, ctx.difficultyNote, ctx.predictionContext,
    `Plan date: ${targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, systemPrompt, userPrompt);

  return {
    parsed: ai.parsed,
    generationContext: ctx.generationContext,
    fitnessLevelDerived: ctx.fitnessLevel,
    predictionData: ctx.predictionData,
    request: {
      systemPrompt,
      userPrompt,
      rawResponse: ai.rawText,
      usage: ai.usage,
    },
  };
}

// ─── GET /api/ai/daily-plan ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    await connectDB();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getToday();

    // Fetch stored plan
    const plan = await DailyPlan.findOne({ userId, date }).lean();

    // Fetch today's DailyLog for live adherence
    const todayLog = await DailyLog.findOne({ userId, date: getToday() })
      .select('totalCalories totalProtein totalCarbs totalFat waterIntake workouts sleep weight')
      .lean() as {
        totalCalories?: number; totalProtein?: number; totalCarbs?: number; totalFat?: number;
        waterIntake?: number; workouts?: { duration?: number }[]; sleep?: { duration?: number; quality?: number };
        weight?: number;
      } | null;

    // Fetch yesterday's plan feedback for recovery score
    const yesterdayPlan = await DailyPlan.findOne({ userId, date: getYesterday() })
      .select('feedback')
      .lean() as { feedback?: { workoutDifficulty?: string } } | null;

    return maskedResponse({
      plan: plan ?? null,
      todayLog: todayLog
        ? {
            totalCalories: Number(todayLog.totalCalories) || 0,
            totalProtein: Number(todayLog.totalProtein) || 0,
            totalCarbs: Number(todayLog.totalCarbs) || 0,
            totalFat: Number(todayLog.totalFat) || 0,
            waterIntake: Number(todayLog.waterIntake) || 0,
            workoutMinutes: Array.isArray(todayLog.workouts)
              ? todayLog.workouts.reduce((s, w) => s + (Number(w?.duration) || 0), 0)
              : 0,
            sleep: todayLog.sleep
              ? { duration: Number(todayLog.sleep.duration) || 0, quality: Number(todayLog.sleep.quality) || 0 }
              : null,
            weight: Number(todayLog.weight) || null,
          }
        : null,
      yesterdayFeedback: yesterdayPlan?.feedback
        ? { workoutDifficulty: yesterdayPlan.feedback.workoutDifficulty }
        : null,
    });
  } catch (err) {
    console.error('[Daily Plan GET Error]:', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch daily plan', 500);
  }
}

// ─── POST /api/ai/daily-plan (manual generate) ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) {
      return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);
    }

    await connectDB();
    const today = getToday();

    // Parse type: 'food' | 'workout' | 'overview' | 'full' (default 'full')
    const body = await req.json().catch(() => ({})) as { type?: string };
    const type = (['food', 'workout', 'overview'].includes(body.type ?? '') ? body.type : 'full') as
      'food' | 'workout' | 'overview' | 'full';

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $inc: {
          [`regenerationCounts.${type}`]: 1,
          ...(type === 'full' ? { regenerationCount: 1 } : {}),
        },
      },
      { upsert: true }
    );

    try {
      const ctx = await buildUserContext(userId, today);
      let updateFields: Record<string, unknown> = { generatedAt: new Date(), status: 'ready' };
      let debugLog: Record<string, unknown> | null;
      const generationStartedAt = new Date().toISOString();

      if (type === 'food') {
        const result = await generateFoodPlan(ctx, apiKey);
        const foodResult = result.parsed as {
          foodPlan?: { suggestions?: unknown[]; reasoning?: string };
        };
        updateFields['foodPlan.suggestions'] = foodResult.foodPlan?.suggestions ?? [];
        updateFields['foodPlan.reasoning'] = foodResult.foodPlan?.reasoning ?? null;
        debugLog = {
          userRequest: {
            type,
            targetDate: today,
            requestedAt: generationStartedAt,
          },
          aiRequest: result.request,
          aiResponse: {
            parsed: foodResult,
            rawResponse: result.rawText,
          },
          metadata: {
            model: 'gpt-4o-mini',
            usage: result.usage,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        };

      } else if (type === 'workout') {
        const result = await generateWorkoutPlan(ctx, apiKey);
        const workoutResult = result.parsed as {
          workoutPlan?: Record<string, unknown>;
        };
        updateFields['workoutPlan'] = workoutResult.workoutPlan ?? null;
        debugLog = {
          userRequest: {
            type,
            targetDate: today,
            requestedAt: generationStartedAt,
          },
          aiRequest: result.request,
          aiResponse: {
            parsed: workoutResult,
            rawResponse: result.rawText,
          },
          metadata: {
            model: 'gpt-4o-mini',
            usage: result.usage,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        };

      } else if (type === 'overview') {
        const result = await generateOverview(ctx, apiKey);
        const overviewResult = result.parsed as {
          topInsight?: string;
          prediction?: { weeklyWeightChangeKg?: number; projectedWeightKg?: number; basis?: string };
        };
        updateFields['topInsight'] = overviewResult.topInsight ?? null;
        updateFields['prediction'] = overviewResult.prediction ?? null;
        debugLog = {
          userRequest: {
            type,
            targetDate: today,
            requestedAt: generationStartedAt,
          },
          aiRequest: result.request,
          aiResponse: {
            parsed: overviewResult,
            rawResponse: result.rawText,
          },
          metadata: {
            model: 'gpt-4o-mini',
            usage: result.usage,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        };

      } else {
        // full
        const { parsed, generationContext, fitnessLevelDerived, request } = await buildPlanForUser(userId, apiKey, today);
        const aiResult = parsed as {
          topInsight?: string;
          foodPlan?: { suggestions?: unknown[]; reasoning?: string };
          workoutPlan?: Record<string, unknown>;
          prediction?: { weeklyWeightChangeKg?: number; projectedWeightKg?: number; basis?: string };
        };
        updateFields = {
          status: 'ready',
          generatedAt: new Date(),
          topInsight: aiResult.topInsight ?? null,
          'foodPlan.suggestions': aiResult.foodPlan?.suggestions ?? [],
          'foodPlan.reasoning': aiResult.foodPlan?.reasoning ?? null,
          workoutPlan: aiResult.workoutPlan ?? null,
          prediction: aiResult.prediction ?? null,
          fitnessLevelDerived,
          generationContext,
        };
        debugLog = {
          userRequest: {
            type,
            targetDate: today,
            requestedAt: generationStartedAt,
          },
          aiRequest: {
            systemPrompt: request.systemPrompt,
            userPrompt: request.userPrompt,
          },
          aiResponse: {
            parsed: aiResult,
            rawResponse: request.rawResponse,
          },
          metadata: {
            model: 'gpt-4o-mini',
            usage: request.usage,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        };
      }

      const plan = await DailyPlan.findOneAndUpdate(
        { userId, date: today },
        { $set: updateFields },
        { new: true, upsert: true }
      ).lean();

      return maskedResponse({ plan, debugLog });
    } catch (genErr) {
      await DailyPlan.findOneAndUpdate(
        { userId, date: today },
        { $set: { status: 'failed', errorMessage: genErr instanceof Error ? genErr.message : 'Generation failed' } }
      );
      console.error('[Daily Plan POST Error]:', genErr);
      const msg = genErr instanceof Error ? genErr.message : 'Failed to generate plan';
      const status = msg.includes('API key') ? 403 : msg.includes('3 times') ? 429 : 500;
      return errorResponse(msg, status);
    }
  } catch (err) {
    console.error('[Daily Plan POST Error]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate plan';
    const status = msg.includes('API key') ? 403 : msg.includes('3 times') ? 429 : 500;
    return errorResponse(msg, status);
  }
}
