// ============================================
// /api/achievements - User streaks & badges
// ============================================

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyLog from '@/models/DailyLog';
import User from '@/models/User';
import { getAuthUserId, isUserId } from '@/lib/session';
import { maskedResponse } from '@/lib/apiMask';
import { calculateAchievements } from '@/lib/gamification';
import { getToday } from '@/lib/utils';
import { getLevelProgress } from '@/lib/level';

export const dynamic = 'force-dynamic';

const EMPTY_STREAKS = {
  current: { logging: 0, healthy: 0, calories: 0, water: 0, workout: 0, sleep: 0, weight: 0, steps: 0, waterGoal: 0 },
  best: { logging: 0, healthy: 0, calories: 0, water: 0, workout: 0, sleep: 0, weight: 0, steps: 0, waterGoal: 0 },
  starts: {} as Record<string, undefined>,
};

/** Safe fallback so the Achievements page always renders (no red banner). */
function safeAchievementsPayload() {
  const xpTotal = 0;
  const { level, xpIntoLevel, xpPercent, xpForCurrentLevel } = getLevelProgress(xpTotal);
  return maskedResponse({
    achievements: {
      badges: [],
      streaks: EMPTY_STREAKS,
      xpTotal: 0,
    },
    newlyEarnedBadges: [],
    xpTotal,
    xpToday: 0,
    level,
    xpIntoLevel,
    xpPercent,
    xpForCurrentLevel,
  });
}

/** Validate YYYY-MM-DD and return the string if valid, otherwise undefined. */
function parseTodayParam(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(value + 'T00:00:00');
  return isNaN(d.getTime()) ? undefined : value;
}

const ACHIEVEMENTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// GET /api/achievements - Get current streaks and badges (and update them)
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const todayOverride = parseTodayParam(req.nextUrl.searchParams.get('today'));

    await connectDB();

    const today = getToday();

    // Fast path: return cached achievements if they were calculated recently
    const userDoc = await User.findById(userId)
      .select('achievements achievementsUpdatedAt')
      .lean<{ achievements?: unknown; achievementsUpdatedAt?: Date } | null>();

    const cacheAge = userDoc?.achievementsUpdatedAt
      ? Date.now() - new Date(userDoc.achievementsUpdatedAt).getTime()
      : Infinity;

    const cachedAchievements = userDoc?.achievements as
      | import('@/types').UserAchievements
      | undefined;
    // Force recompute if the cache predates a streak field we now track,
    // so newly-added streaks (e.g. waterGoal) populate without waiting for TTL.
    const cacheMissingNewFields =
      !!cachedAchievements &&
      cachedAchievements.streaks?.current?.waterGoal === undefined;

    if (
      cacheAge < ACHIEVEMENTS_CACHE_TTL_MS &&
      cachedAchievements &&
      !cacheMissingNewFields
    ) {
      const cached = cachedAchievements;
      const xpTotal = cached.xpTotal ?? 0;
      const { level, xpIntoLevel, xpPercent, xpForCurrentLevel } = getLevelProgress(xpTotal);
      let xpToday = 0;
      try {
        const todayLog = await DailyLog.findOne(
          { userId, date: today },
          { xpAwarded: 1, _id: 0 }
        ).lean<{ xpAwarded?: number } | null>();
        xpToday = todayLog?.xpAwarded ?? 0;
      } catch { /* non-critical */ }

      return maskedResponse({
        achievements: cached,
        newlyEarnedBadges: [],
        xpTotal,
        xpToday,
        level,
        xpIntoLevel,
        xpPercent,
        xpForCurrentLevel,
      });
    }

    // Slow path: full recalculation
    let result;
    try {
      result = await calculateAchievements(userId, todayOverride);
    } catch (calcErr) {
      console.error('[Achievements GET] calculateAchievements failed:', calcErr);
      return safeAchievementsPayload();
    }

    const xpTotal = result.achievements.xpTotal ?? 0;
    const { level, xpIntoLevel, xpPercent, xpForCurrentLevel } = getLevelProgress(xpTotal);

    let xpToday = 0;
    try {
      const todayLog = await DailyLog.findOne(
        { userId, date: today },
        { xpAwarded: 1, _id: 0 }
      ).lean<{ xpAwarded?: number } | null>();
      xpToday = todayLog?.xpAwarded ?? 0;
    } catch (logErr) {
      console.warn('[Achievements GET] todayLog fetch failed:', logErr);
    }

    return maskedResponse({
      achievements: result.achievements,
      newlyEarnedBadges: result.newlyEarnedBadges,
      xpTotal,
      xpToday,
      level,
      xpIntoLevel,
      xpPercent,
      xpForCurrentLevel,
    });
  } catch (err) {
    console.error('[Achievements GET Error]:', err);
    return safeAchievementsPayload();
  }
}

