import connectDB from '@/lib/db';
import User from '@/models/User';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { getToday, getYesterday, getAgeFromDateOfBirth } from '@/lib/utils';
import { getLatestLoggedWeight } from '@/lib/latestWeight';
import { deriveFitnessLevel } from '@/lib/deriveFitnessLevel';

// ─── OpenAI call ──────────────────────────────────────────────────────────────

export async function callOpenAI(
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

// ─── User context builder ─────────────────────────────────────────────────────

export async function buildUserContext(userId: string, targetDate: string) {
  await connectDB();
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
    ? "Yesterday's workout was too hard — suggest lighter intensity or recovery session."
    : lastWorkoutDifficulty === 'too_easy'
      ? "Yesterday's workout was too easy — increase difficulty slightly."
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

export type UserContext = Awaited<ReturnType<typeof buildUserContext>>;
