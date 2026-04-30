import type { AiMealSuggestion, AiWorkoutPlan, DailyPlanData } from '@/types';

export type FoodRequestBody = {
  lastWeekFoodDetails?: string;
  goal?: string;
  dietaryPreference?: string;
};

export type OverviewRequestBody = {
  lastWeekSummary?: string;
  goal?: string;
  currentWeightKg?: number;
};

export type WorkoutRequestBody = {
  lastWeekDetails?: string;
  goal?: string;
  fitnessLevel?: string;
  todayAvailableMinutes?: number;
};

const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const VALID_INTENSITIES = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set(['cardio', 'strength', 'flexibility', 'sports', 'other']);

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildFoodPrompt(body: FoodRequestBody, date: string): string {
  const details = body.lastWeekFoodDetails?.trim() || 'No previous food details provided.';
  const goal = body.goal?.trim() || 'Eat balanced meals for health';
  const dietaryPreference = body.dietaryPreference?.trim() || 'No specific preference';
  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Dietary preference: ${dietaryPreference}`,
    `Last week food details from user: ${details}`,
  ].join('\n');
}

export function buildOverviewPrompt(body: OverviewRequestBody, date: string): string {
  const summary = body.lastWeekSummary?.trim() || 'No weekly summary provided.';
  const goal = body.goal?.trim() || 'General health improvement';
  const weight = Number(body.currentWeightKg);
  const weightLine = Number.isFinite(weight) && weight > 0
    ? `Current weight kg: ${weight}`
    : 'Current weight kg: not provided';

  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    weightLine,
    `Last week summary from user: ${summary}`,
  ].join('\n');
}

export function buildWorkoutPrompt(body: WorkoutRequestBody, date: string): string {
  const details = body.lastWeekDetails?.trim() || 'No previous workout details provided.';
  const goal = body.goal?.trim() || 'General fitness and consistency';
  const fitnessLevel = body.fitnessLevel?.trim() || 'beginner';
  const minutes = Number(body.todayAvailableMinutes);
  const durationTarget = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30;

  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Fitness level: ${fitnessLevel}`,
    `Today workout target minutes: ${durationTarget}`,
    `Last week details from user: ${details}`,
  ].join('\n');
}

export function normalizeFoodPlan(input: unknown): NonNullable<DailyPlanData['foodPlan']> {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const rawSuggestions = Array.isArray(root.suggestions) ? root.suggestions : [];
  const suggestions: AiMealSuggestion[] = rawSuggestions
    .map((raw) => {
      const meal = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
      const mealType = asString(meal.mealType, 'snack').toLowerCase();
      return {
        name: asString(meal.name, 'Meal suggestion'),
        description: asString(meal.description),
        calories: clamp(Math.round(asNumber(meal.calories, 350)), 0, 2000),
        protein: clamp(Math.round(asNumber(meal.protein, 15)), 0, 300),
        carbs: clamp(Math.round(asNumber(meal.carbs, 40)), 0, 400),
        fat: clamp(Math.round(asNumber(meal.fat, 10)), 0, 200),
        mealType: (VALID_MEAL_TYPES.has(mealType) ? mealType : 'snack') as AiMealSuggestion['mealType'],
        ingredients: Array.isArray(meal.ingredients)
          ? meal.ingredients.map((item) => String(item).trim()).filter(Boolean).slice(0, 20)
          : [],
        isVegetarian: Boolean(meal.isVegetarian),
      };
    })
    .filter((meal) => meal.name.length > 0)
    .slice(0, 12);

  return {
    suggestions,
    reasoning: asString(root.reasoning) || undefined,
  };
}

export function normalizeWorkoutPlan(input: unknown): AiWorkoutPlan {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const rawExercises = Array.isArray(root.exercises) ? root.exercises : [];

  const exercises: AiWorkoutPlan['exercises'] = rawExercises
    .map((raw) => {
      const ex = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
      const intensity = asString(ex.intensity, 'medium').toLowerCase();
      const category = asString(ex.category, 'other').toLowerCase();
      const steps = Array.isArray(ex.steps)
        ? ex.steps.map((step) => String(step).trim()).filter(Boolean).slice(0, 10)
        : [];

      return {
        name: asString(ex.name, 'Exercise'),
        ...(steps.length > 0 ? { steps } : {}),
        sets: clamp(Math.round(asNumber(ex.sets, 3)), 1, 20),
        reps: asString(ex.reps, '10-12'),
        durationMinutes: clamp(Math.round(asNumber(ex.durationMinutes, 5)), 1, 180),
        restSeconds: clamp(Math.round(asNumber(ex.restSeconds, 60)), 0, 600),
        intensity: (VALID_INTENSITIES.has(intensity) ? intensity : 'medium') as 'low' | 'medium' | 'high',
        category: (VALID_CATEGORIES.has(category) ? category : 'other') as AiWorkoutPlan['exercises'][number]['category'],
      };
    })
    .filter((exercise) => exercise.name.length > 0)
    .slice(0, 20);

  return {
    name: asString(root.name, 'Today Workout'),
    description: asString(root.description, 'A balanced session based on your recent activity.'),
    progressionTip: asString(root.progressionTip) || undefined,
    reasoning: asString(root.reasoning) || undefined,
    exercises,
    estimatedCalories: clamp(Math.round(asNumber(root.estimatedCalories, 220)), 0, 3000),
    durationMinutes: clamp(Math.round(asNumber(root.durationMinutes, 30)), 1, 240),
  };
}

export function normalizeOverview(input: unknown): {
  topInsight: string | null;
  prediction: NonNullable<DailyPlanData['prediction']> | null;
} {
  const root = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const predictionRoot = (root.prediction && typeof root.prediction === 'object')
    ? root.prediction as Record<string, unknown>
    : {};

  const weeklyWeightChangeKg = asNumber(predictionRoot.weeklyWeightChangeKg, 0);
  const projectedWeightKg = asNumber(predictionRoot.projectedWeightKg, 0);
  const hasPrediction = Object.keys(predictionRoot).length > 0;

  return {
    topInsight: asString(root.topInsight) || null,
    prediction: hasPrediction
      ? {
          weeklyWeightChangeKg: Number(weeklyWeightChangeKg.toFixed(2)),
          projectedWeightKg: Number(projectedWeightKg.toFixed(1)),
          basis: asString(predictionRoot.basis, 'Projected trend based on recent habits.'),
        }
      : null,
  };
}
