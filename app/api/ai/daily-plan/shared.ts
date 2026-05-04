import type { AiMealSuggestion, AiWorkoutPlan, DailyPlanData } from '@/types';
import { getAgeFromDateOfBirth } from '@/lib/utils';

export type FoodRequestBody = {
  lastWeekFoodDetails?: string;
  goal?: string;
  dietaryPreference?: string;
  allergies?: string[];
  targetProteinG?: number;
  targetCalories?: number;
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
const VALID_CATEGORIES = new Set(['cardio', 'strength', 'flexibility', 'core']);
const VALID_MUSCLE_GROUPS = new Set(['legs', 'push', 'pull', 'core']);
const DEFAULT_REQUIRED_COMPONENTS: Array<'legs' | 'push' | 'pull' | 'core'> = ['legs', 'push', 'pull', 'core'];

export type WorkoutPlanConstraints = {
  targetDurationMinutes: number;
  strategy: 'full_body_fat_loss' | 'upper_lower' | 'push_pull_legs';
  requiredComponentsPerWorkout: Array<'legs' | 'push' | 'pull' | 'core'>;
  readinessAdjustment: string;
  reduceVolume: boolean;
  reduceExtraCardio: boolean;
  includeLightCardio: boolean;
  avoidHighIntensity: boolean;
  bodyFatPct?: number;
  weightKg?: number;
};

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

function normalizeFitnessLevel(level: string): 'beginner' | 'intermediate' | 'advanced' {
  const normalized = level.trim().toLowerCase();
  if (normalized === 'advanced') return 'advanced';
  if (normalized === 'intermediate') return 'intermediate';
  return 'beginner';
}

export function deriveWorkoutPlanConstraints(
  body: WorkoutRequestBody,
  context?: WorkoutPromptContext
): WorkoutPlanConstraints {
  const sanitized = sanitizeWorkoutContext(context);
  const fitnessLevel = normalizeFitnessLevel(
    body.fitnessLevel?.trim() || sanitized?.profile?.fitnessLevel || 'beginner'
  );
  const bodyFatPct = toFinite(sanitized?.profile?.bodyFatPct);
  const activityLevel = asString(sanitized?.profile?.activityLevel).toLowerCase();

  let strategy: WorkoutPlanConstraints['strategy'] = 'full_body_fat_loss';
  if (fitnessLevel === 'beginner' && (bodyFatPct ?? 0) > 20) {
    strategy = 'full_body_fat_loss';
  } else if (fitnessLevel === 'intermediate') {
    strategy = ['active', 'very_active', 'moderate'].includes(activityLevel)
      ? 'push_pull_legs'
      : 'upper_lower';
  } else if (fitnessLevel === 'advanced') {
    strategy = 'push_pull_legs';
  }

  const minutes = Number(body.todayAvailableMinutes);
  const targetDurationMinutes = Number.isFinite(minutes) && minutes > 0
    ? clamp(Math.round(minutes), 12, 120)
    : clamp(Math.round(sanitized?.targets?.dailyWorkoutMinutes ?? 30), 12, 120);

  const recentLogs = sanitized?.recentLogs ?? [];
  const proteinTarget = sanitized?.targets?.proteinG;
  const proteinRatios = recentLogs
    .map((log) => {
      const protein = toFinite(log.nutrition?.proteinG);
      if (!proteinTarget || proteinTarget <= 0 || protein == null || protein < 0) return null;
      return protein / proteinTarget;
    })
    .filter((v): v is number => typeof v === 'number');
  const avgProteinRatio = proteinRatios.length > 0
    ? proteinRatios.reduce((sum, ratio) => sum + ratio, 0) / proteinRatios.length
    : 1;

  const stepValues = recentLogs
    .map((log) => toFinite(log.activity?.steps))
    .filter((v): v is number => typeof v === 'number' && v >= 0);
  const avgSteps = stepValues.length > 0
    ? stepValues.reduce((sum, steps) => sum + steps, 0) / stepValues.length
    : 0;

  const sleepDurations = recentLogs
    .map((log) => toFinite(log.recovery?.sleepDurationHours))
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const avgSleepHours = sleepDurations.length > 0
    ? sleepDurations.reduce((sum, hours) => sum + hours, 0) / sleepDurations.length
    : (sanitized?.targets?.sleepHours ?? 7);

  const stepsTarget = sanitized?.targets?.dailySteps ?? 8000;
  const reduceVolume = avgProteinRatio < 0.7;
  const reduceExtraCardio = avgSteps > stepsTarget || avgSteps > 8000;
  const includeLightCardio = avgSteps > 0 && avgSteps < 3000;
  const avoidHighIntensity = avgSleepHours < 6;

  const readinessLines: string[] = [];
  if (reduceVolume) readinessLines.push('reduced volume because recent protein intake is under 70% of target');
  if (reduceExtraCardio) readinessLines.push('reduced extra cardio because recent steps already exceed target');
  if (includeLightCardio) readinessLines.push('included light cardio because recent step count is low');
  if (avoidHighIntensity) readinessLines.push('avoided high intensity because recent sleep is under 6 hours');
  if (readinessLines.length === 0) readinessLines.push('normal volume and intensity based on current readiness');

  return {
    targetDurationMinutes,
    strategy,
    requiredComponentsPerWorkout: DEFAULT_REQUIRED_COMPONENTS,
    readinessAdjustment: readinessLines.join('; '),
    reduceVolume,
    reduceExtraCardio,
    includeLightCardio,
    avoidHighIntensity,
    bodyFatPct,
    weightKg: toFinite(sanitized?.profile?.weightKg),
  };
}

export function buildFoodPrompt(body: FoodRequestBody, date: string): string {
  const details = body.lastWeekFoodDetails?.trim() || 'No previous food details provided.';
  const goal = body.goal?.trim() || 'Eat balanced meals for health';
  const dietaryPreferenceRaw = body.dietaryPreference?.trim() || 'no_preference';
  const dietaryPreference = (() => {
    if (dietaryPreferenceRaw === 'vegetarian') return 'Vegetarian';
    if (dietaryPreferenceRaw === 'non_vegetarian') return 'Non-vegetarian';
    if (dietaryPreferenceRaw === 'vegan') return 'Vegan';
    return 'No specific preference';
  })();
  const allergies = Array.isArray(body.allergies)
    ? body.allergies.map((entry) => entry.trim()).filter(Boolean)
    : [];
  const targetProtein = Number(body.targetProteinG);
  const targetCalories = Number(body.targetCalories);
  const proteinLine = Number.isFinite(targetProtein) && targetProtein > 0
    ? `Daily protein target: ${Math.round(targetProtein)}g`
    : 'Daily protein target: not provided';
  const caloriesLine = Number.isFinite(targetCalories) && targetCalories > 0
    ? `Daily calories target: ${Math.round(targetCalories)} kcal`
    : 'Daily calories target: not provided';
  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Dietary preference: ${dietaryPreference}`,
    `Allergies or avoid list: ${allergies.length > 0 ? allergies.join(', ') : 'None provided'}`,
    proteinLine,
    caloriesLine,
    'Protein rule: Keep total daily protein close to the protein target and keep each main meal protein-forward.',
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
  const constraints = deriveWorkoutPlanConstraints(body, context);
  const goal = body.goal?.trim() || sanitized?.profile?.goal || 'General fitness and consistency';
  const fitnessLevel = body.fitnessLevel?.trim() || sanitized?.profile?.fitnessLevel || 'beginner';

  const lines = [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Fitness level: ${fitnessLevel}`,
    `Today workout target minutes: ${constraints.targetDurationMinutes}`,
    `Required planning architecture: strategy_engine -> readiness_adjustment -> daily_workout_generation -> fat_loss_intelligence -> calorie_estimation`,
    `Computed strategy engine output: ${JSON.stringify({
      strategy: constraints.strategy,
      requiredComponentsPerWorkout: constraints.requiredComponentsPerWorkout,
    })}`,
    `Computed readiness adjustment: ${constraints.readinessAdjustment}`,
    `Generation quality requirements: include legs + push + pull + core each session; order warm-up -> strength -> cardio -> core -> cooldown; include at least 2 cooldown stretches; keep duration within ±3 minutes of target.`,
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

function inferMuscleGroup(name: string, category: string): 'legs' | 'push' | 'pull' | 'core' {
  const n = name.toLowerCase();
  if (category === 'core' || /core|plank|crunch|dead bug|bird dog|russian twist|hollow hold/.test(n)) return 'core';
  if (/squat|lunge|glute|hamstring|calf|step-up|wall sit/.test(n)) return 'legs';
  if (/push|press|dip|chest|shoulder|tricep/.test(n)) return 'push';
  if (/row|pull|lat|rear delt|bicep/.test(n)) return 'pull';
  return category === 'cardio' ? 'legs' : 'push';
}

type WorkoutExercise = AiWorkoutPlan['exercises'][number];
const EQUIPMENT_MAP: Record<string, string> = {
  'Bent Over Dumbbell Rows': 'Resistance Band Rows',
  'Lat Pulldown': 'Towel Rows',
  'Cable Row': 'Seated Resistance Band Rows',
};

function normalizeMuscleGroup(exercise: WorkoutExercise): WorkoutExercise {
  if (exercise.category === 'cardio') {
    return { ...exercise, muscleGroup: 'legs' };
  }
  if (exercise.category === 'flexibility') {
    return { ...exercise, muscleGroup: 'core' };
  }
  return exercise;
}

function enforceBeginnerEquipment(exercise: WorkoutExercise): WorkoutExercise {
  const replacement = EQUIPMENT_MAP[exercise.name];
  if (!replacement) return exercise;
  return { ...exercise, name: replacement };
}

function normalizeWarmup(exercise: WorkoutExercise): WorkoutExercise {
  return {
    ...exercise,
    sets: 1,
    reps: 'continuous',
    durationMinutes: clamp(Math.round(asNumber(exercise.durationMinutes, 4)), 3, 5),
    restSeconds: 0,
    intensity: 'low',
    category: 'cardio',
    muscleGroup: 'legs',
  };
}

function defaultWarmup(): WorkoutExercise {
  return {
    name: 'March in Place + Arm Circles',
    sets: 1,
    reps: 'continuous',
    durationMinutes: 4,
    restSeconds: 0,
    category: 'cardio',
    intensity: 'low',
    muscleGroup: 'legs',
  };
}

function isLikelyWarmup(exercise: WorkoutExercise): boolean {
  const name = exercise.name.toLowerCase();
  return /warm.?up|march in place|arm circles|mobility|joint rotation/.test(name)
    || (exercise.category === 'flexibility' && exercise.intensity === 'low' && (exercise.durationMinutes ?? 0) <= 5);
}

function ensureMinCooldown(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const stretches = exercises.filter((exercise) => exercise.category === 'flexibility');
  if (stretches.length >= 2) {
    return stretches.slice(0, 4).map((stretch) => ({
      ...stretch,
      sets: Math.max(1, stretch.sets),
      restSeconds: 0,
      intensity: 'low',
      muscleGroup: 'core',
    }));
  }
  const required: WorkoutExercise[] = [
    {
      name: 'Standing Quad Stretch',
      sets: 1,
      reps: '30 seconds each leg',
      durationMinutes: 2,
      restSeconds: 0,
      category: 'flexibility',
      intensity: 'low',
      muscleGroup: 'core',
    },
    {
      name: 'Hamstring Stretch',
      sets: 1,
      reps: '30 seconds each leg',
      durationMinutes: 2,
      restSeconds: 0,
      category: 'flexibility',
      intensity: 'low',
      muscleGroup: 'core',
    },
  ];
  return [...stretches, ...required].slice(0, 2);
}

function ensureCore(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const coreExercises = exercises.filter((exercise) => exercise.muscleGroup === 'core');
  if (coreExercises.length === 0) {
    return [
      ...exercises,
      {
        name: 'Plank',
        sets: 3,
        reps: '25-30 seconds',
        durationMinutes: 5,
        restSeconds: 30,
        category: 'core',
        intensity: 'medium',
        muscleGroup: 'core',
      },
    ];
  }
  return exercises.map((exercise) => {
    if (exercise.muscleGroup === 'core' && exercise.sets < 3) {
      return { ...exercise, sets: 3, reps: '25-30 seconds' };
    }
    return exercise;
  });
}

function enforceWorkoutOrder(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const warmupCandidates: WorkoutExercise[] = [];
  const strength: WorkoutExercise[] = [];
  const cardio: WorkoutExercise[] = [];
  const core: WorkoutExercise[] = [];
  const cooldownCandidates: WorkoutExercise[] = [];

  for (const exercise of exercises) {
    if (isLikelyWarmup(exercise)) {
      warmupCandidates.push(exercise);
    } else if (exercise.category === 'strength') {
      strength.push(exercise);
    } else if (exercise.category === 'cardio') {
      cardio.push(exercise);
    } else if (exercise.category === 'core') {
      core.push(exercise);
    } else if (exercise.category === 'flexibility') {
      cooldownCandidates.push(exercise);
    }
  }

  const warmup = warmupCandidates.length > 0
    ? [normalizeWarmup(warmupCandidates[0])]
    : [defaultWarmup()];
  const cooldown = ensureMinCooldown([...warmupCandidates.slice(1), ...cooldownCandidates]);
  return [...warmup, ...strength, ...cardio, ...core, ...cooldown];
}

function dedupeExercises(exercises: WorkoutExercise[]): WorkoutExercise[] {
  const seen = new Set<string>();
  const deduped: WorkoutExercise[] = [];
  for (const exercise of exercises) {
    const key = `${exercise.name.toLowerCase()}|${exercise.category}|${exercise.muscleGroup}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(exercise);
  }
  return deduped;
}

function createDefaultExercise(muscleGroup: 'legs' | 'push' | 'pull' | 'core'): AiWorkoutPlan['exercises'][number] {
  if (muscleGroup === 'legs') {
    return {
      name: 'Bodyweight Squat',
      sets: 3,
      reps: '10-12',
      durationMinutes: 6,
      restSeconds: 60,
      category: 'strength',
      intensity: 'medium',
      muscleGroup: 'legs',
    };
  }
  if (muscleGroup === 'push') {
    return {
      name: 'Incline Push-up',
      sets: 3,
      reps: '8-12',
      durationMinutes: 6,
      restSeconds: 60,
      category: 'strength',
      intensity: 'medium',
      muscleGroup: 'push',
    };
  }
  if (muscleGroup === 'pull') {
    return {
      name: 'Band Row',
      sets: 3,
      reps: '10-12',
      durationMinutes: 6,
      restSeconds: 60,
      category: 'strength',
      intensity: 'medium',
      muscleGroup: 'pull',
    };
  }
  return {
    name: 'Forearm Plank',
    sets: 3,
    reps: '30-45 sec hold',
    durationMinutes: 5,
    restSeconds: 45,
    category: 'core',
    intensity: 'medium',
    muscleGroup: 'core',
  };
}

function estimateCaloriesFromMet(exercises: AiWorkoutPlan['exercises'], weightKg?: number): number {
  const weight = clamp(Math.round((weightKg ?? 70) * 10) / 10, 40, 160);
  const total = exercises.reduce((sum, exercise) => {
    const minutes = clamp(Math.round(asNumber(exercise.durationMinutes, 0)), 0, 180);
    const intensity = exercise.intensity ?? 'medium';
    const met = (() => {
      if (exercise.category === 'cardio') return intensity === 'low' ? 4.2 : intensity === 'high' ? 6 : 5;
      if (exercise.category === 'strength') return intensity === 'low' ? 3.5 : intensity === 'high' ? 6 : 4.8;
      if (exercise.category === 'core') return intensity === 'low' ? 3 : intensity === 'high' ? 4.5 : 3.8;
      return 2.5;
    })();
    return sum + ((met * 3.5 * weight) / 200) * minutes;
  }, 0);
  return clamp(Math.round(total), 40, 1200);
}

function generateProgression(exercises: WorkoutExercise[]): string {
  const push = exercises.find((exercise) => exercise.muscleGroup === 'push');
  const core = exercises.find((exercise) => exercise.muscleGroup === 'core');
  return `Next session: add +2 reps to ${push?.name || 'your push exercise'} and +5 sec to ${core?.name || 'your core holds'}`;
}

function alignDuration(exercises: AiWorkoutPlan['exercises'], targetMinutes: number): AiWorkoutPlan['exercises'] {
  const target = clamp(targetMinutes, 12, 120);
  const current = exercises.reduce((sum, ex) => sum + clamp(Math.round(asNumber(ex.durationMinutes, 0)), 0, 180), 0);
  if (Math.abs(current - target) <= 3) return exercises;
  const updated = exercises.map((exercise) => ({ ...exercise }));
  let delta = target - current;
  const priorities = delta > 0
    ? updated
    : updated.filter((exercise) => exercise.category === 'cardio' || exercise.category === 'strength');
  for (const exercise of priorities) {
    if (Math.abs(delta) <= 3) break;
    const currentDuration = clamp(Math.round(asNumber(exercise.durationMinutes, 5)), 1, 180);
    if (delta > 0) {
      const add = Math.min(4, delta);
      exercise.durationMinutes = currentDuration + add;
      delta -= add;
    } else {
      const removable = Math.max(0, currentDuration - 3);
      const remove = Math.min(removable, Math.abs(delta));
      exercise.durationMinutes = currentDuration - remove;
      delta += remove;
    }
  }
  return updated;
}

export function normalizeWorkoutPlan(input: unknown, constraints?: WorkoutPlanConstraints): AiWorkoutPlan {
  const parsedRoot = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const root = (parsedRoot.workoutPlan && typeof parsedRoot.workoutPlan === 'object')
    ? parsedRoot.workoutPlan as Record<string, unknown>
    : parsedRoot;
  const rawExercises = Array.isArray(root.exercises) ? root.exercises : [];

  let exercises: AiWorkoutPlan['exercises'] = rawExercises
    .map((raw) => {
      const ex = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
      const intensity = asString(ex.intensity, 'medium').toLowerCase();
      const category = asString(ex.category, 'strength').toLowerCase();
      const muscleGroupRaw = asString(ex.muscleGroup).toLowerCase();
      const name = asString(ex.name, 'Exercise');
      const steps = Array.isArray(ex.steps)
        ? ex.steps.map((step) => String(step).trim()).filter(Boolean).slice(0, 10)
        : [];
      const safeCategory = (VALID_CATEGORIES.has(category) ? category : 'strength') as AiWorkoutPlan['exercises'][number]['category'];
      const inferredMuscleGroup = inferMuscleGroup(name, safeCategory);

      return {
        name,
        ...(steps.length > 0 ? { steps } : {}),
        sets: clamp(Math.round(asNumber(ex.sets, 3)), 1, 20),
        reps: asString(ex.reps, '10-12'),
        durationMinutes: clamp(Math.round(asNumber(ex.durationMinutes, 5)), 1, 180),
        restSeconds: clamp(Math.round(asNumber(ex.restSeconds, 60)), 0, 600),
        intensity: (VALID_INTENSITIES.has(intensity) ? intensity : 'medium') as 'low' | 'medium' | 'high',
        category: safeCategory,
        muscleGroup: (VALID_MUSCLE_GROUPS.has(muscleGroupRaw) ? muscleGroupRaw : inferredMuscleGroup) as 'legs' | 'push' | 'pull' | 'core',
      };
    })
    .filter((exercise) => exercise.name.length > 0)
    .slice(0, 20);

  exercises = exercises.map(normalizeMuscleGroup).map(enforceBeginnerEquipment);

  const requiredComponents = constraints?.requiredComponentsPerWorkout ?? DEFAULT_REQUIRED_COMPONENTS;
  const availableGroups = new Set(exercises.map((exercise) => exercise.muscleGroup));
  for (const component of requiredComponents) {
    if (!availableGroups.has(component)) {
      exercises.push(createDefaultExercise(component));
      availableGroups.add(component);
    }
  }
  exercises = ensureCore(exercises);
  exercises = dedupeExercises(exercises);

  if (constraints?.reduceVolume) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.category === 'flexibility' ? exercise.sets : Math.max(2, Math.min(exercise.sets, 3)),
    }));
  }

  if (constraints?.avoidHighIntensity) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      intensity: exercise.intensity === 'high' ? 'medium' : exercise.intensity,
    }));
  }

  if (constraints?.reduceExtraCardio) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      durationMinutes: exercise.category === 'cardio' && !isLikelyWarmup(exercise)
        ? Math.min(exercise.durationMinutes ?? 5, 10)
        : exercise.durationMinutes,
    }));
  }

  if (constraints?.includeLightCardio && !exercises.some((exercise) => exercise.category === 'cardio' && (exercise.durationMinutes ?? 0) >= 6)) {
    exercises.push({
      name: 'Brisk Walk',
      sets: 1,
      reps: 'steady pace',
      durationMinutes: 8,
      restSeconds: 0,
      category: 'cardio',
      intensity: 'low',
      muscleGroup: 'legs',
    });
  }

  if ((constraints?.bodyFatPct ?? 0) >= 25) {
    exercises = exercises.map((exercise) => ({
      ...exercise,
      durationMinutes: exercise.category === 'cardio'
        ? Math.min(exercise.durationMinutes ?? 5, 15)
        : exercise.durationMinutes,
    }));
    if (!exercises.some((exercise) => exercise.muscleGroup === 'core')) {
      exercises.push(createDefaultExercise('core'));
    }
  }

  exercises = enforceWorkoutOrder(exercises);
  exercises = alignDuration(exercises, constraints?.targetDurationMinutes ?? Math.round(asNumber(root.durationMinutes, 30)));

  const durationMinutes = exercises.reduce((sum, exercise) => sum + (exercise.durationMinutes ?? 0), 0);
  const strategyUsed = constraints?.strategy ?? 'full_body_fat_loss';
  const readinessAdjustment = constraints?.readinessAdjustment ?? 'normal volume and intensity based on current readiness';

  return {
    name: asString(root.name, 'Today Full-Body Workout'),
    description: asString(root.description, 'Balanced daily training designed from your profile, behavior, and recovery signals.'),
    strategyUsed,
    readinessAdjustment,
    progressionTip: generateProgression(exercises),
    reasoning: `${asString(root.reasoning, 'Plan built from profile, behavior, and recovery.')} Strategy: ${strategyUsed}. Readiness: ${readinessAdjustment}.`,
    exercises,
    estimatedCalories: estimateCaloriesFromMet(exercises, constraints?.weightKg),
    durationMinutes: clamp(Math.round(durationMinutes), 12, 180),
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
