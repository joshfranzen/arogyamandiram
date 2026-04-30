import { callOpenAI, buildUserContext, type UserContext } from './context';
import { validateWorkoutPlan, generateWorkoutPlanWithValidation } from './workout';

// ─── Focused overview generator ───────────────────────────────────────────────

export async function generateOverview(ctx: UserContext, apiKey: string) {
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

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.yesterdayContext,
    ctx.predictionContext, `Plan date: ${ctx.targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, system, userPrompt);
  return { ...ai, request: { systemPrompt: system, userPrompt } };
}

// ─── Full plan builder (food + workout + overview in one call, used by cron) ──

export async function buildPlanForUser(
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
  predictionData: { weeklyWeightChangeKg: number; projectedWeightKg: number | null };
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

VARIETY RULE: no duplicate exercise names; warm-up name must differ from exercises[1] and [2]; strength block must include posterior chain or full-body metabolic move (Reverse Lunges, Squat to Knee Drive, Glute Bridges)

CORE VOLUME: core exercise must be 2–3 sets × 30–40s, durationMinutes ≥ 2

CALORIE TARGET: estimatedCalories must be 280–320 kcal; 350+ is too aggressive for beginners at 40 min medium intensity

PROGRESSION QUALITY: tip must combine ≥2 changes (e.g. "reduce rest to 25s and increase cardio intervals to 40s") — single-exercise tweaks rejected

INTENSITY RULES:
- beginners: ≥2 exercises = "medium"; never all-low
- intermediate: mix "medium"/"high"; advanced: majority "high"
- MANDATORY: use difficultyNote to adjust intensity (too_hard → one level easier; too_easy → one level harder; no data → moderate progression)

CALORIE LOGIC (CRITICAL):
- Maintain continuous activity density; rest MUST NOT exceed 45s per exercise

DURATION RULE (STRICT): total durationMinutes must be within ±2 minutes of the user's daily workout minutes target

FAT LOSS PRIORITY: if body fat > 22%, bias toward fat-loss recomposition even if goal is "maintain"; prioritize heart-rate-elevating, core-engaging movements

- Each exercise MUST have a "steps" array of 3-5 plain beginner-friendly sentences
- Name exercises clearly (e.g. "Bodyweight Squats"); prefer compound movements`;

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.yesterdayContext,
    ctx.feedbackContext, ctx.difficultyNote, ctx.predictionContext,
    `Plan date: ${targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, systemPrompt, userPrompt);

  // Validate workout; if invalid, patch with focused validated generator
  const targetMinutes = (ctx.targets as { dailyWorkoutMinutes?: number }).dailyWorkoutMinutes ?? 30;
  const workoutValidation = validateWorkoutPlan(
    { workoutPlan: (ai.parsed as { workoutPlan?: unknown }).workoutPlan },
    targetMinutes
  );

  let parsed = ai.parsed;
  if (!workoutValidation.isValid) {
    console.warn('[Daily Plan] Full-plan workout validation failed — patching:', workoutValidation.errors);
    try {
      const patched = await generateWorkoutPlanWithValidation(ctx, apiKey);
      parsed = { ...ai.parsed, workoutPlan: (patched.parsed as { workoutPlan?: unknown }).workoutPlan };
    } catch (patchErr) {
      console.error('[Daily Plan] Patch also failed — keeping original:', patchErr);
    }
  }

  return {
    parsed,
    generationContext: ctx.generationContext,
    fitnessLevelDerived: ctx.fitnessLevel,
    predictionData: ctx.predictionData,
    request: { systemPrompt, userPrompt, rawResponse: ai.rawText, usage: ai.usage },
  };
}
