import { callOpenAI, type UserContext } from './context';

// ─── Validator ────────────────────────────────────────────────────────────────

const BANNED_EXERCISE_NAMES = ['walking', 'circuit', 'routine', 'workout'];
const ALLOWED_CATEGORIES = ['cardio', 'strength', 'flexibility'];

type Ex = { category?: string; intensity?: string; restSeconds?: number; durationMinutes?: number; name?: string };
export type WorkoutValidationResult = { isValid: boolean; errors: string[] };

export function validateWorkoutPlan(
  plan: Record<string, unknown>,
  targetMinutes: number
): WorkoutValidationResult {
  const errors: string[] = [];
  const wp = (plan?.workoutPlan ?? plan) as Record<string, unknown> | null;
  if (!wp) return { isValid: false, errors: ['Missing workoutPlan'] };

  const ex = wp.exercises as Ex[] | undefined;
  if (!Array.isArray(ex) || ex.length < 6 || ex.length > 8) {
    errors.push(`Exercise count must be 6–8 (got ${Array.isArray(ex) ? ex.length : 'none'})`);
  }

  if (Array.isArray(ex) && ex.length >= 2) {
    // Warm-up: cardio + low
    if (ex[0]?.category !== 'cardio') errors.push('exercises[0] warm-up must use category "cardio"');
    if (ex[0]?.intensity !== 'low') errors.push('exercises[0] warm-up must have intensity "low"');

    // Cool-down last
    if (ex[ex.length - 1]?.category !== 'flexibility') errors.push('Last exercise must be cool-down (category: flexibility)');

    // Core second-to-last
    if (ex[ex.length - 2]?.category !== 'strength') errors.push('Second-to-last exercise must be core (category: strength)');

    // exercises[3][4][5] must all be strength
    if (ex.length >= 6) {
      [3, 4, 5].forEach((idx) => {
        if (idx < ex.length - 2 && ex[idx]?.category !== 'strength') {
          errors.push(`exercises[${idx}] must be strength (got "${ex[idx]?.category}")`);
        }
      });
    }

    // Category validity
    ex.forEach((e, i) => {
      if (!ALLOWED_CATEGORIES.includes(e.category ?? '')) {
        errors.push(`Invalid category "${e.category}" at index ${i} — must be cardio|strength|flexibility`);
      }
    });

    // Cardio count (excluding warm-up)
    const cardioCount = ex.slice(1).filter((e) => e.category === 'cardio').length;
    if (cardioCount < 2) errors.push(`Need ≥2 cardio exercises after warm-up (got ${cardioCount})`);

    // Strength before core slot
    const strengthBeforeCore = ex.slice(0, ex.length - 2).filter((e) => e.category === 'strength').length;
    if (strengthBeforeCore < 3) errors.push(`Need ≥3 strength exercises before core slot (got ${strengthBeforeCore})`);

    // Intensity
    const mediumCount = ex.filter((e) => e.intensity === 'medium').length;
    if (mediumCount < 2) errors.push(`Need ≥2 medium-intensity exercises (got ${mediumCount})`);

    // Rest cap
    ex.forEach((e, i) => {
      if (Number(e.restSeconds ?? 0) > 45) errors.push(`Rest too long at index ${i}: ${e.restSeconds}s (max 45s)`);
    });

    // Per-exercise duration cap
    ex.forEach((e, i) => {
      if (Number(e.durationMinutes ?? 0) > 6) errors.push(`Exercise ${i} duration ${e.durationMinutes}min exceeds 6-minute cap`);
    });

    // Metabolic density
    const totalWork = ex.reduce((s, e) => s + Number(e.durationMinutes ?? 0), 0);
    const totalRest = ex.reduce((s, e) => s + Number(e.restSeconds ?? 0) / 60, 0);
    if (totalWork > 0 && totalRest / totalWork > 0.3) {
      errors.push(`Rest-to-work ratio too high (${(totalRest / totalWork * 100).toFixed(0)}% — max 30%)`);
    }

    // Banned names
    ex.forEach((e, i) => {
      const name = String(e.name ?? '').toLowerCase();
      const banned = BANNED_EXERCISE_NAMES.find((b) => name.includes(b));
      if (banned) errors.push(`Exercise ${i} name contains banned term "${banned}"`);
    });

    // Duplicate names
    const names = ex.map((e) => String(e.name ?? '').toLowerCase().trim());
    const seen = new Set<string>();
    names.forEach((n, i) => {
      if (seen.has(n)) errors.push(`Duplicate exercise name at index ${i}: "${n}"`);
      seen.add(n);
    });

    // Warm-up vs cardio name collision
    if (ex.length >= 3) {
      const warmupName = names[0];
      if (names[1] === warmupName || names[2] === warmupName) {
        errors.push(`Warm-up name "${warmupName}" duplicated in cardio block — must be a different movement`);
      }
    }

    // Core volume
    if (ex.length >= 2) {
      const coreDur = Number(ex[ex.length - 2]?.durationMinutes ?? 0);
      if (coreDur < 2) errors.push(`Core exercise duration ${coreDur}min too short — must be ≥2 min`);
    }
  }

  // Total duration
  const duration = Number((wp as { durationMinutes?: number }).durationMinutes ?? 0);
  if (Math.abs(duration - targetMinutes) > 2) {
    errors.push(`Duration ${duration}min not within ±2 min of target ${targetMinutes}min`);
  }

  // Calorie range
  const calories = Number((wp as { estimatedCalories?: number }).estimatedCalories ?? 0);
  if (calories < 280 || calories > 320) {
    errors.push(`estimatedCalories ${calories} outside target range 280–320 kcal`);
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Generator ────────────────────────────────────────────────────────────────

export async function generateWorkoutPlan(ctx: UserContext, apiKey: string) {
  const system = `You are an elite performance-based fitness coach AI for Arogyamandiram. Generate ONLY a workout plan.

Respond with this exact JSON:
{
  "workoutPlan": {
    "name": "string — concise name specific to the user's goal",
    "description": "string — one sentence describing the session",
    "progressionTip": "string — specific next-session change combining ≥2 improvements",
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

VARIETY RULE (REQUIRED):
- No exercise name may appear more than once in the plan
- Warm-up name MUST be different from exercises[1] and [2] — if warm-up uses Jumping Jacks, cardio must use Mountain Climbers / High Knees
- Strength block must include posterior chain OR full-body metabolic load (e.g. Reverse Lunges, Squat to Knee Drive, Glute Bridges) alongside Squats and Push-Ups

CORE VOLUME (REQUIRED):
- Core exercise (second-to-last) must be 2–3 sets × 30–40 seconds
- durationMinutes for core MUST be ≥ 2

CALORIE TARGET (STRICT):
- estimatedCalories MUST be between 280 and 320 kcal
- If duration is 40 min at medium intensity for a beginner, 350+ kcal is too aggressive — dial back by reducing 1–2 strength sets or shortening cardio intervals

PROGRESSION QUALITY (REQUIRED):
- Progression tip MUST improve overall session stimulus combining ≥2 changes
- Good: "reduce rest to 25s and increase cardio intervals to 40s"
- Bad: "Add 1 set to Push-Ups" (single-exercise tweak — rejected)

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

DURATION RULE (STRICT):
- Total durationMinutes MUST be within ±2 minutes of the user's daily workout minutes target
- No single exercise > 6 minutes

FAT LOSS PRIORITY:
- If user body fat > 22%, bias toward fat-loss recomposition even if goal is "maintain"
- Prioritize exercises that keep heart rate elevated and engage the core throughout

EXERCISE RULES:
- Each exercise MUST have a "steps" array of 3-5 plain sentences a complete beginner can follow
- Name exercises clearly (e.g. "Bodyweight Squats", not "Squat Circuit Round 1")
- Prefer compound movements (squats, lunges, push-ups, rows) over isolation`;

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.difficultyNote, `Plan date: ${ctx.targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, system, userPrompt);
  return { ...ai, request: { systemPrompt: system, userPrompt } };
}

// ─── Validated generator (auto-retry up to 3×) ───────────────────────────────

export async function generateWorkoutPlanWithValidation(
  ctx: UserContext,
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
    mutCtx.difficultyNote = [
      mutCtx.difficultyNote,
      `\nPREVIOUS PLAN REJECTED — fix ALL of these before responding:\n${validation.errors.map((e) => `- ${e}`).join('\n')}`,
    ].filter(Boolean).join('\n');
  }

  throw new Error(`Workout plan failed validation after 3 attempts: ${lastErrors.join('; ')}`);
}
