import type { AiMealSuggestion, AiWorkoutPlan, DailyPlanData } from '@/types';
import { getAgeFromDateOfBirth } from '@/lib/utils';

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

export type WorkoutPromptContext = {
  profile?: {
    age?: number;
    dateOfBirth?: string | Date;
    gender?: string;
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
  } | null;
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
  } | null;
  recentLogs?: Array<{
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
    sleep?: { duration?: number; quality?: number } | null;
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
  recentFeedback?: Array<{
    date?: string;
    feedback?: {
      workoutDifficulty?: string;
      skippedWorkoutReason?: string;
    } | null;
  }>;
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

function toFinite(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function sanitizeWorkoutContext(context?: WorkoutPromptContext) {
  if (!context) return null;

  const profile = context.profile
    ? {
        age: (() => {
          if (context.profile?.dateOfBirth) {
            const derived = getAgeFromDateOfBirth(context.profile.dateOfBirth);
            if (Number.isFinite(derived) && derived > 0) return derived;
          }
          return toFinite(context.profile.age);
        })(),
        gender: asString(context.profile.gender),
        heightCm: toFinite(context.profile.height),
        weightKg: toFinite(context.profile.weight),
        activityLevel: asString(context.profile.activityLevel),
        goal: asString(context.profile.goal),
        targetWeightKg: toFinite(context.profile.targetWeight),
        bodyType: asString(context.profile.bodyType),
        bodyFatPct: toFinite(context.profile.bodyFat),
        fatFocusAreas: Array.isArray(context.profile.fatFocusAreas)
          ? context.profile.fatFocusAreas.map((a) => asString(a)).filter(Boolean)
          : [],
        fitnessLevel: asString(context.profile.fitnessLevelDerived || context.profile.fitnessLevelUser),
      }
    : null;

  const targets = context.targets
    ? {
        dailyWorkoutMinutes: toFinite(context.targets.dailyWorkoutMinutes),
        dailyCalorieBurnKcal: toFinite(context.targets.dailyCalorieBurn),
        dailyCaloriesKcal: toFinite(context.targets.dailyCalories),
        dailyWaterMl: toFinite(context.targets.dailyWater),
        proteinG: toFinite(context.targets.protein),
        carbsG: toFinite(context.targets.carbs),
        fatG: toFinite(context.targets.fat),
        sleepHours: toFinite(context.targets.sleepHours),
        dailySteps: toFinite(context.targets.dailySteps),
      }
    : null;

  const recentLogs = Array.isArray(context.recentLogs)
    ? context.recentLogs
        .map((log) => ({
          ...(() => {
            const sleepDuration = toFinite(log.sleep?.duration);
            const sleepQuality = toFinite(log.sleep?.quality);
            const hasSleepData = typeof sleepDuration === 'number' || typeof sleepQuality === 'number';
            return {
              recovery: hasSleepData
                ? {
                    sleepDurationHours: sleepDuration,
                    sleepQuality1to5: sleepQuality,
                  }
                : {
                    sleepStatus: 'not_recorded',
                  },
            };
          })(),
          date: asString(log.date),
          nutrition: {
            caloriesKcal: toFinite(log.totalCalories) ?? 0,
            proteinG: toFinite(log.totalProtein) ?? 0,
            carbsG: toFinite(log.totalCarbs) ?? 0,
            fatG: toFinite(log.totalFat) ?? 0,
          },
          hydration: {
            waterMl: toFinite(log.waterIntake) ?? 0,
          },
          activity: {
            caloriesBurnedKcal: toFinite(log.caloriesBurned) ?? 0,
            steps: toFinite(log.steps) ?? 0,
            activeCaloriesKcal: toFinite(log.activeCalories) ?? 0,
            distanceKm: toFinite(log.distanceKm) ?? 0,
            heartRateAvg: toFinite(log.heartRate) ?? 0,
          },
          workouts: Array.isArray(log.workouts)
            ? log.workouts.map((w) => ({
                exercise: asString(w.exercise),
                category: asString(w.category, 'other'),
                durationMinutes: toFinite(w.duration) ?? 0,
                caloriesBurnedKcal: toFinite(w.caloriesBurned) ?? 0,
                sets: toFinite(w.sets) ?? 0,
                reps: toFinite(w.reps) ?? 0,
                source: asString(w.source, 'manual'),
              }))
            : [],
        }))
        .slice(0, 3)
    : [];

  const recentFeedback = Array.isArray(context.recentFeedback)
    ? context.recentFeedback
        .map((entry) => ({
          date: asString(entry.date),
          workoutDifficulty: asString(entry.feedback?.workoutDifficulty),
          skippedWorkoutReason: asString(entry.feedback?.skippedWorkoutReason),
        }))
        .filter((entry) => entry.date && (entry.workoutDifficulty || entry.skippedWorkoutReason))
        .slice(0, 3)
    : [];

  return { profile, targets, recentLogs, recentFeedback };
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

export function buildWorkoutPrompt(
  body: WorkoutRequestBody,
  date: string,
  context?: WorkoutPromptContext
): string {
  const details = body.lastWeekDetails?.trim() || 'No previous workout details provided.';
  const sanitized = sanitizeWorkoutContext(context);
  const goal = body.goal?.trim() || sanitized?.profile?.goal || 'General fitness and consistency';
  const fitnessLevel = body.fitnessLevel?.trim() || sanitized?.profile?.fitnessLevel || 'beginner';
  const minutes = Number(body.todayAvailableMinutes);
  const durationTarget = Number.isFinite(minutes) && minutes > 0
    ? Math.round(minutes)
    : Math.round(sanitized?.targets?.dailyWorkoutMinutes ?? 30);

  const lines = [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Fitness level: ${fitnessLevel}`,
    `Today workout target minutes: ${durationTarget}`,
    `Last week details from user: ${details}`,
  ];

  if (sanitized?.profile) {
    lines.push(`Anonymized profile: ${JSON.stringify(sanitized.profile)}`);
  }
  if (sanitized?.targets) {
    lines.push(`Targets and constraints: ${JSON.stringify(sanitized.targets)}`);
  }
  if (sanitized?.recentLogs?.length) {
    lines.push(`Recent 3-day health/activity logs: ${JSON.stringify(sanitized.recentLogs)}`);
  } else {
    lines.push('Recent 3-day health/activity logs: none available');
  }
  if (sanitized?.recentFeedback?.length) {
    lines.push(`Recent workout-plan feedback: ${JSON.stringify(sanitized.recentFeedback)}`);
  }

  return lines.join('\n');
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
