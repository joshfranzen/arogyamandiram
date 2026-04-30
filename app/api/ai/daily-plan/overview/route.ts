// GET  → returns today's overview (topInsight, prediction) + live log + yesterday feedback
// POST → generates / regenerates overview

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday, getYesterday } from '@/lib/utils';
import { buildUserContext } from '../context';
import { generateOverview } from '../overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;
    await connectDB();

    const today = getToday();

    const plan = await DailyPlan.findOne({ userId, date: today })
      .select('topInsight prediction status')
      .lean() as { topInsight?: string; prediction?: unknown; status?: string } | null;

    const todayLog = await DailyLog.findOne({ userId, date: today })
      .select('totalCalories totalProtein totalCarbs totalFat waterIntake workouts sleep weight')
      .lean() as {
        totalCalories?: number; totalProtein?: number; totalCarbs?: number; totalFat?: number;
        waterIntake?: number; workouts?: { duration?: number }[];
        sleep?: { duration?: number; quality?: number }; weight?: number;
      } | null;

    const yesterdayPlan = await DailyPlan.findOne({ userId, date: getYesterday() })
      .select('feedback')
      .lean() as { feedback?: { workoutDifficulty?: string } } | null;

    return maskedResponse({
      topInsight: plan?.topInsight ?? null,
      prediction: plan?.prediction ?? null,
      status: plan?.status ?? null,
      todayLog: todayLog ? {
        totalCalories: Number(todayLog.totalCalories) || 0,
        totalProtein: Number(todayLog.totalProtein) || 0,
        totalCarbs: Number(todayLog.totalCarbs) || 0,
        totalFat: Number(todayLog.totalFat) || 0,
        waterIntake: Number(todayLog.waterIntake) || 0,
        workoutMinutes: Array.isArray(todayLog.workouts)
          ? todayLog.workouts.reduce((s, w) => s + (Number(w?.duration) || 0), 0) : 0,
        sleep: todayLog.sleep
          ? { duration: Number(todayLog.sleep.duration) || 0, quality: Number(todayLog.sleep.quality) || 0 }
          : null,
        weight: Number(todayLog.weight) || null,
      } : null,
      yesterdayFeedback: yesterdayPlan?.feedback
        ? { workoutDifficulty: yesterdayPlan.feedback.workoutDifficulty } : null,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch overview', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $inc: { 'regenerationCounts.overview': 1 } },
      { upsert: true }
    );

    const ctx = await buildUserContext(userId, today);
    const result = await generateOverview(ctx, apiKey);
    const parsed = result.parsed as {
      topInsight?: string;
      prediction?: { weeklyWeightChangeKg?: number; projectedWeightKg?: number; basis?: string };
    };

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          topInsight: parsed.topInsight ?? null,
          prediction: parsed.prediction ?? null,
          status: 'ready',
          generatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const body = await req.json().catch(() => ({})) as { debug?: boolean };
    const debugLog = body.debug ? {
      aiRequest: result.request,
      aiResponse: { parsed, rawResponse: result.rawText },
      metadata: { model: 'gpt-4o-mini', usage: result.usage, timestamp: new Date().toISOString() },
    } : null;

    return maskedResponse({ topInsight: parsed.topInsight ?? null, prediction: parsed.prediction ?? null, debugLog });
  } catch (err) {
    console.error('[Overview POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate overview';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
