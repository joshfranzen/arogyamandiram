// GET  → returns today's stored workout plan
// POST → generates / regenerates workout plan with validation (max 3/day)

import { NextRequest } from 'next/server';
import { promises as fsp } from 'fs';
import path from 'path';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import User from '@/models/User';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';
import { buildUserContext } from '../context';
import { generateWorkoutPlanWithValidation } from '../workout';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;
    await connectDB();

    const plan = await DailyPlan.findOne({ userId, date: getToday() })
      .select('workoutPlan status feedback')
      .lean() as { workoutPlan?: unknown; status?: string; feedback?: { workoutDifficulty?: string } } | null;

    return maskedResponse({
      workoutPlan: plan?.workoutPlan ?? null,
      status: plan?.status ?? null,
      feedback: plan?.feedback ? { workoutDifficulty: plan.feedback.workoutDifficulty } : null,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : 'Failed to fetch workout plan', 500);
  }
}

export async function POST(req: NextRequest) {
  void req;
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $inc: { 'regenerationCounts.workout': 1 } },
      { upsert: true }
    );

    const ctx = await buildUserContext(userId, today);
    const result = await generateWorkoutPlanWithValidation(ctx, apiKey);
    const parsed = result.parsed as { workoutPlan?: Record<string, unknown> };

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $set: { workoutPlan: parsed.workoutPlan ?? null, status: 'ready', generatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
      try {
        const user = await User.findById(userId).select('username').lean();
        const userLogId = ((user as { username?: string } | null)?.username?.trim()) || userId;
        const dir = path.join(process.cwd(), '.debug-logs', userLogId, 'today-plan', 'workout');
        await fsp.mkdir(dir, { recursive: true });
        const now = new Date();
        const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 24);
        const id = `${ts}-${Math.random().toString(36).slice(2, 6)}`;
        await fsp.writeFile(
          path.join(dir, `${id}.json`),
          JSON.stringify({
            aiRequest: result.request,
            aiResponse: { parsed, rawResponse: result.rawText },
            metadata: { model: 'gpt-4o-mini', usage: result.usage, timestamp: now.toISOString(), username: userLogId },
          }, null, 2),
          'utf-8'
        );
      } catch (logErr) {
        console.error('[Workout Plan debug log]:', logErr);
      }
    }

    return maskedResponse({ workoutPlan: (plan as { workoutPlan?: unknown } | null)?.workoutPlan ?? null });
  } catch (err) {
    console.error('[Workout Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate workout plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
