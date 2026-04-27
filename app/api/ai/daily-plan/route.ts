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
  const system = `You are an elite performance-based fitness coach AI for Arogyamandiram. Generate ONLY a workout plan.

Respond with this exact JSON:
{
  "workoutPlan": {
    "name": "string — concise name specific to the user's goal",
    "description": "string — one sentence describing the session",
    "progressionTip": "string — specific next-session change (e.g. 'reduce rest by 10s' or 'add 1 set to squats')",
    "reasoning": "string — 1-2 sentences explaining why this plan suits this user",
    "exercises": [
      {
        "name": "string — clear exercise name (e.g. Bodyweight Squats, Push-Ups, Plank)",
        "steps": ["3-5 short plain-English steps explaining how to do this exercise for a beginner"],
        "sets": number,
        "reps": "string (e.g. '10-15' or '30 seconds')",
        "durationMinutes": number,
        "restSeconds": number,
        "intensity": "low" | "medium" | "high",
        "category": "cardio" | "strength" | "flexibility"
      }
    ],
    "estimatedCalories": number,
    "durationMinutes": number
  }
}

ORDER RULE (STRICT — array must follow this exact sequence):
- exercises[0] = warm-up: category MUST be "cardio", intensity MUST be "low"
- exercises[1] and [2] = cardio: active intervals (Jumping Jacks, Mountain Climbers, High Knees) — never passive walking
- exercises[3], [4], and [5] = strength: ALL THREE must be compound strength exercises BEFORE the core exercise
- second-to-last exercise = core: category MUST be "strength" — place this ONLY after all strength exercises are done
- last exercise = cool-down: category MUST be "flexibility"
Total: 6-8 exercises.

STRENGTH ENFORCEMENT (CRITICAL):
- exercises[3], [4], [5] MUST ALL be strength category — minimum 3 strength exercises BEFORE core
- Plank and similar core moves do NOT count as strength — they are the dedicated core slot (second-to-last only)
- Never place core exercises inside the strength block

CATEGORY RULE:
- Allowed values: "cardio" | "strength" | "flexibility" only
- Core exercises use "strength" category — never create a "core" category
- Warm-up uses "cardio" — never "flexibility"

PROGRESSION QUALITY (REQUIRED):
- Progression tip MUST improve overall session stimulus, not just one exercise
- Good examples: "reduce rest to 30s across all exercises", "increase cardio intervals to 45s each", "add 1 set to both squat and push-up"
- Bad example: "Add 1 set to Push-Ups" (too narrow — rejected)

INTENSITY RULES:
- beginners: at least 2 exercises must be "medium"; remainder "low" or "medium" — never all-low
- intermediate: mix of "medium" and "high"
- advanced: majority "high"
- Adjust one level easier if yesterday's workout was too_hard; one level harder if too_easy

ADAPTATION (MANDATORY):
- You MUST use the provided difficultyNote to adjust intensity
- If no difficulty data is available → default to moderate progression (keep current level, add 1 set)

CALORIE LOGIC (CRITICAL):
- Maintain continuous activity density — no long idle blocks
- Rest periods MUST NOT exceed 45 seconds per exercise
- Ensure the combined intensity distribution supports burning ~300 kcal over the session duration

DURATION RULE (STRICT):
- Total durationMinutes MUST be within ±2 minutes of the user's daily workout minutes target
- No single exercise > 6 minutes

FAT LOSS PRIORITY:
- If user body fat > 22%, bias toward fat-loss recomposition even if goal is "maintain"
- Prioritize exercises that keep heart rate elevated and engage the core throughout

EXERCISE RULES:
- Each exercise MUST have a "steps" array of 3-5 plain sentences a complete beginner can follow
- Name exercises clearly (e.g. "Bodyweight Squats", not "Squat Circuit Round 1")
- Prefer compound movements (squats, lunges, push-ups, rows) over isolation

PROGRESSION TIP (required):
- Must name a concrete change: reduce rest by Xs, add 1 set to [exercise], increase tempo, or try a harder variant
- Never generic ("increase reps" is not acceptable)`;

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

// ─── Workout validator ────────────────────────────────────────────────────────

const BANNED_EXERCISE_NAMES = ['walking', 'circuit', 'routine', 'workout'];
const ALLOWED_CATEGORIES = ['cardio', 'strength', 'flexibility'];

type WorkoutValidationResult = { isValid: boolean; errors: string[] };

function validateWorkoutPlan(
  plan: Record<string, unknown>,
  targetMinutes: number
): WorkoutValidationResult {
  const errors: string[] = [];
  const wp = (plan?.workoutPlan ?? plan) as Record<string, unknown> | null;
  if (!wp) return { isValid: false, errors: ['Missing workoutPlan'] };

  const ex = wp.exercises as Record<string, unknown>[] | undefined;
  if (!Array.isArray(ex) || ex.length < 6 || ex.length > 8) {
    errors.push(`Exercise count must be 6–8 (got ${Array.isArray(ex) ? ex.length : 'none'})`);
  }

  if (Array.isArray(ex) && ex.length >= 2) {
    type Ex = { category?: string; intensity?: string; restSeconds?: number; durationMinutes?: number; name?: string };

    // Warm-up: must be cardio + low intensity
    if ((ex[0] as Ex)?.category !== 'cardio') {
      errors.push('exercises[0] warm-up must use category "cardio" (not "flexibility")');
    }
    if ((ex[0] as Ex)?.intensity !== 'low') {
      errors.push('exercises[0] warm-up must have intensity "low"');
    }
    // Cool-down last
    if ((ex[ex.length - 1] as Ex)?.category !== 'flexibility') {
      errors.push('Last exercise must be cool-down (category: flexibility)');
    }
    // Core second-to-last
    if ((ex[ex.length - 2] as Ex)?.category !== 'strength') {
      errors.push('Second-to-last exercise must be core (category: strength)');
    }
    // exercises[3], [4], [5] must all be strength (if array is long enough)
    if (ex.length >= 6) {
      [3, 4, 5].forEach((idx) => {
        if (idx < ex.length - 2 && (ex[idx] as Ex)?.category !== 'strength') {
          errors.push(`exercises[${idx}] must be strength (got "${(ex[idx] as Ex)?.category}")`);
        }
      });
    }

    // Category validity
    ex.forEach((e, i) => {
      const cat = (e as Ex).category;
      if (!ALLOWED_CATEGORIES.includes(cat ?? '')) {
        errors.push(`Invalid category "${cat}" at index ${i} — must be cardio|strength|flexibility`);
      }
    });

    // Cardio count (warm-up doesn't count — it's cardio but low)
    const cardioCount = ex.slice(1).filter((e) => (e as Ex).category === 'cardio').length;
    if (cardioCount < 2) errors.push(`Need ≥2 cardio exercises after warm-up (got ${cardioCount})`);

    // Strength count: minimum 3 strength exercises before core slot
    const strengthBeforeCore = ex.slice(0, ex.length - 2).filter((e) => (e as Ex).category === 'strength').length;
    if (strengthBeforeCore < 3) errors.push(`Need ≥3 strength exercises before core slot (got ${strengthBeforeCore})`);

    // Intensity: at least 2 medium
    const mediumCount = ex.filter((e) => (e as { intensity?: string }).intensity === 'medium').length;
    if (mediumCount < 2) errors.push(`Need ≥2 medium-intensity exercises (got ${mediumCount})`);

    // Rest cap
    ex.forEach((e, i) => {
      const rest = Number((e as { restSeconds?: number }).restSeconds ?? 0);
      if (rest > 45) errors.push(`Rest too long at index ${i}: ${rest}s (max 45s)`);
    });

    // Per-exercise duration cap
    ex.forEach((e, i) => {
      const dur = Number((e as { durationMinutes?: number }).durationMinutes ?? 0);
      if (dur > 6) errors.push(`Exercise ${i} duration ${dur}min exceeds 6-minute cap`);
    });

    // Metabolic density: rest-to-work ratio
    const totalWork = ex.reduce((s, e) => s + Number((e as { durationMinutes?: number }).durationMinutes ?? 0), 0);
    const totalRest = ex.reduce((s, e) => s + Number((e as { restSeconds?: number }).restSeconds ?? 0) / 60, 0);
    if (totalWork > 0 && totalRest / totalWork > 0.3) {
      errors.push(`Rest-to-work ratio too high (${(totalRest / totalWork * 100).toFixed(0)}% — max 30%)`);
    }

    // Banned vague exercise names
    ex.forEach((e, i) => {
      const name = String((e as { name?: string }).name ?? '').toLowerCase();
      const banned = BANNED_EXERCISE_NAMES.find((b) => name.includes(b));
      if (banned) errors.push(`Exercise ${i} name contains banned term "${banned}"`);
    });
  }

  // Total duration
  const duration = Number((wp as { durationMinutes?: number }).durationMinutes ?? 0);
  if (Math.abs(duration - targetMinutes) > 2) {
    errors.push(`Duration ${duration}min not within ±2 min of target ${targetMinutes}min`);
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Validated workout generator (auto-retry up to 3×) ───────────────────────

async function generateWorkoutPlanWithValidation(
  ctx: Awaited<ReturnType<typeof buildUserContext>>,
  apiKey: string
): Promise<ReturnType<typeof generateWorkoutPlan>> {
  const targetMinutes = (ctx.targets as { dailyWorkoutMinutes?: number }).dailyWorkoutMinutes ?? 30;
  let lastErrors: string[] = [];
  const mutCtx = { ...ctx };

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await generateWorkoutPlan(mutCtx, apiKey);
    const validation = validateWorkoutPlan(result.parsed as Record<string, unknown>, targetMinutes);
    if (validation.isValid) return result;

    lastErrors = validation.errors;
    // Inject validation feedback into next attempt via difficultyNote
    mutCtx.difficultyNote = [
      mutCtx.difficultyNote,
      `\nPREVIOUS PLAN REJECTED — fix ALL of these before responding:\n${validation.errors.map((e) => `- ${e}`).join('\n')}`,
    ].filter(Boolean).join('\n');
  }

  throw new Error(`Workout plan failed validation after 3 attempts: ${lastErrors.join('; ')}`);
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
    "name": "string — concise name specific to the user's goal",
    "description": "string — one sentence describing the session",
    "progressionTip": "string — specific next-session change (e.g. 'reduce rest by 10s' or 'add 1 set to squats')",
    "reasoning": "string — 1-2 sentences explaining why this plan suits this user",
    "exercises": [
      {
        "name": "string — clear exercise name (e.g. Bodyweight Squats, Push-Ups, Plank)",
        "steps": ["3-5 short plain-English steps explaining how to do this exercise for a beginner"],
        "sets": number,
        "reps": "string (e.g. '10-15' or '30 seconds')",
        "durationMinutes": number,
        "restSeconds": number,
        "intensity": "low"|"medium"|"high",
        "category": "cardio"|"strength"|"flexibility"
      }
    ],
    "estimatedCalories": number,
    "durationMinutes": number
  },
  "prediction": {
    "weeklyWeightChangeKg": number,
    "projectedWeightKg": number,
    "basis": "string — brief explanation like 'Based on 5-day avg: -350 kcal/day deficit'"
  }
}

Rules:
- Food plan: 4-6 suggestions across multiple meal types; prioritize high-protein foods if protein gap > 20g; avoid disliked foods

ORDER RULE (STRICT — array must follow this exact sequence):
- exercises[0] = warm-up: category "cardio", intensity "low"
- exercises[1] and [2] = cardio: active intervals (Jumping Jacks, Mountain Climbers, High Knees — never walking)
- exercises[3], [4], [5] = strength: ALL THREE must be compound strength moves BEFORE core
- second-to-last = core: category "strength" — ONLY after all strength exercises are done
- last = cool-down: category "flexibility"
Total: 6-8 exercises, no single exercise > 6 min

STRENGTH ENFORCEMENT (CRITICAL): exercises[3][4][5] must ALL be "strength"; plank/core moves belong only in the core slot (second-to-last), never in the strength block

CATEGORY RULE: only "cardio" | "strength" | "flexibility" — never "core"; warm-up = "cardio" not "flexibility"

PROGRESSION QUALITY: tip must improve overall session stimulus (e.g. "reduce rest to 30s across all exercises") — not just one exercise

INTENSITY RULES:
- beginners: ≥2 exercises = "medium"; never all-low
- intermediate: mix "medium"/"high"; advanced: majority "high"
- MANDATORY: use difficultyNote to adjust intensity (too_hard → one level easier; too_easy → one level harder; no data → moderate progression)

CALORIE LOGIC (CRITICAL):
- Maintain continuous activity density; rest MUST NOT exceed 45s per exercise
- Intensity distribution must support ~300 kcal burn over the session

DURATION RULE (STRICT): total durationMinutes must be within ±2 minutes of the user's daily workout minutes target

FAT LOSS PRIORITY: if body fat > 22%, bias toward fat-loss recomposition even if goal is "maintain"; prioritize heart-rate-elevating, core-engaging movements

- Each exercise MUST have a "steps" array of 3-5 plain beginner-friendly sentences
- Name exercises clearly (e.g. "Bodyweight Squats"); prefer compound movements
- Progression tip must be specific (e.g. "reduce rest by 10s", "add 1 set to lunges") — never generic`;

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.yesterdayContext,
    ctx.feedbackContext, ctx.difficultyNote, ctx.predictionContext,
    `Plan date: ${targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, systemPrompt, userPrompt);

  // Validate workout section; if invalid patch it with the focused generator (avoids re-running food)
  const targetMinutes = (ctx.targets as { dailyWorkoutMinutes?: number }).dailyWorkoutMinutes ?? 30;
  const workoutValidation = validateWorkoutPlan(
    { workoutPlan: (ai.parsed as { workoutPlan?: unknown }).workoutPlan },
    targetMinutes
  );

  let parsed = ai.parsed;
  if (!workoutValidation.isValid) {
    console.warn('[Daily Plan] Full-plan workout validation failed — patching via focused generator:', workoutValidation.errors);
    try {
      const patched = await generateWorkoutPlanWithValidation(ctx, apiKey);
      parsed = {
        ...ai.parsed,
        workoutPlan: (patched.parsed as { workoutPlan?: unknown }).workoutPlan,
      };
    } catch (patchErr) {
      console.error('[Daily Plan] Patch also failed — keeping original:', patchErr);
    }
  }

  return {
    parsed,
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
        const result = await generateWorkoutPlanWithValidation(ctx, apiKey);
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
