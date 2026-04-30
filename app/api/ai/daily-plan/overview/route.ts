import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { createOpenAiJson } from '@/lib/openaiJson';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday, getYesterday } from '@/lib/utils';
import { buildOverviewPrompt, type OverviewRequestBody, normalizeOverview } from '../shared';

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

    const body = await req.json().catch(() => ({})) as OverviewRequestBody;
    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();
    const systemPrompt = `You are a practical health coach. Generate a simple daily overview for TODAY.
Return JSON only with this shape:
{
  "topInsight": "string",
  "prediction": {
    "weeklyWeightChangeKg": number,
    "projectedWeightKg": number,
    "basis": "string"
  }
}
Keep it short and realistic.`;
    const userPrompt = buildOverviewPrompt(body, today);
    const ai = await createOpenAiJson<{
      topInsight?: string;
      prediction?: { weeklyWeightChangeKg?: number; projectedWeightKg?: number; basis?: string };
    }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1000,
    });
    const overview = normalizeOverview(ai);

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          topInsight: overview.topInsight,
          prediction: overview.prediction,
          status: 'ready',
          generatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return maskedResponse(overview);
  } catch (err) {
    console.error('[Overview POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate overview';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
