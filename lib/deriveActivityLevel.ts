import connectDB from '@/lib/db';
import DailyLog from '@/models/DailyLog';
import User from '@/models/User';
import type { ActivityLevel } from '@/types';
import type { Types } from 'mongoose';
import { toLocalDateString } from '@/lib/utils';

const LEVEL_ORDER: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

function downgradeLevel(level: ActivityLevel): ActivityLevel {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return level;
  return LEVEL_ORDER[idx - 1];
}

/**
 * Derive activity level from last completed calendar week (Mon -> Sun).
 * This keeps profile.activityLevel aligned with actual recent behavior.
 */
export async function deriveActivityLevel(
  userId: Types.ObjectId | string
): Promise<ActivityLevel> {
  await connectDB();

  const today = new Date();
  const todayDay = today.getDay(); // 0 = Sun, 1 = Mon
  const daysSinceMonday = (todayDay + 6) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - daysSinceMonday);
  const weekStart = new Date(currentWeekStart);
  weekStart.setDate(currentWeekStart.getDate() - 7);
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() - 1);

  const startDate = toLocalDateString(weekStart);
  const endDate = toLocalDateString(weekEnd);

  const logs = await DailyLog.find({
    userId,
    date: { $gte: startDate, $lte: endDate },
    'workouts.0': { $exists: true },
  })
    .select('workouts')
    .lean();

  const workoutDays = logs.length;

  let level: ActivityLevel;
  if (workoutDays >= 7) level = 'very_active';
  else if (workoutDays >= 5) level = 'active';
  else if (workoutDays >= 3) level = 'moderate';
  else if (workoutDays >= 2) level = 'light';
  else level = 'sedentary';

  let totalDuration = 0;
  let totalWorkouts = 0;
  for (const log of logs) {
    const workouts = log.workouts as { duration?: number }[] | undefined;
    if (!Array.isArray(workouts)) continue;
    for (const workout of workouts) {
      if (typeof workout.duration === 'number' && workout.duration > 0) {
        totalDuration += workout.duration;
        totalWorkouts += 1;
      }
    }
  }

  const avgDuration = totalWorkouts > 0 ? totalDuration / totalWorkouts : 0;
  if (avgDuration > 0 && avgDuration < 20) {
    level = downgradeLevel(level);
  }

  await User.updateOne(
    { _id: userId },
    { $set: { 'profile.activityLevel': level } }
  );

  return level;
}

