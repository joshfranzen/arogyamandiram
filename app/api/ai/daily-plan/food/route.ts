// GET  → returns today's stored food plan
// POST → generates / regenerates food plan (max 3/day)

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';
import { buildUserContext } from '../context';
import { generateFoodPlan } from '../food';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;
    await connectDB();

    const plan = await DailyPlan.findOne({ userId, date: getToday() })
      .select('foodPlan status')
      .lean() as { foodPlan?: unknown; status?: string } | null;

    return maskedResponse({ foodPlan: plan?.foodPlan ?? null, status: plan?.status ?? null });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch food plan', 500);
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
      { $inc: { 'regenerationCounts.food': 1 } },
      { upsert: true }
    );

    const ctx = await buildUserContext(userId, today);
    const result = await generateFoodPlan(ctx, apiKey);
    const parsed = result.parsed as { foodPlan?: { suggestions?: unknown[]; reasoning?: string } };

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          'foodPlan.suggestions': parsed.foodPlan?.suggestions ?? [],
          'foodPlan.reasoning': parsed.foodPlan?.reasoning ?? null,
          status: 'ready',
          generatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).lean();

    const body = await req.json().catch(() => ({})) as { debug?: boolean };
    const debugLog = body.debug ? {
      aiRequest: result.request,
      aiResponse: { parsed, rawResponse: result.rawText },
      metadata: { model: 'gpt-4o-mini', usage: result.usage, timestamp: new Date().toISOString() },
    } : null;

    return maskedResponse({ foodPlan: (plan as { foodPlan?: unknown } | null)?.foodPlan ?? null, debugLog });
  } catch (err) {
    console.error('[Food Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate food plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
