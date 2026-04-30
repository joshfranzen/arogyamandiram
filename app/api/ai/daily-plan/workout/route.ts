import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { createOpenAiJson } from '@/lib/openaiJson';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';
import { buildWorkoutPrompt, type WorkoutRequestBody, normalizeWorkoutPlan } from '../shared';

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
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const body = await req.json().catch(() => ({})) as WorkoutRequestBody;
    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();
    const systemPrompt = `You are a practical fitness coach. Create a simple workout plan for TODAY based on the user's last-week details.
Return JSON only with this shape:
{
  "workoutPlan": {
    "name": "string",
    "description": "string",
    "exercises": [
      {
        "name": "string",
        "sets": number,
        "reps": "string",
        "durationMinutes": number,
        "restSeconds": number,
        "category": "cardio" | "strength" | "flexibility" | "sports" | "other",
        "intensity": "low" | "medium" | "high"
      }
    ],
    "estimatedCalories": number,
    "progressionTip": "string",
    "reasoning": "string",
    "durationMinutes": number,
    "description": "string"
  }
}
Keep it realistic, beginner-friendly when unclear, and aligned to the user's details.`;
    const userPrompt = buildWorkoutPrompt(body, today);
    const ai = await createOpenAiJson<{ workoutPlan?: Record<string, unknown> }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
    });
    const workoutPlan = normalizeWorkoutPlan(ai.workoutPlan ?? ai);

    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      { $set: { workoutPlan, status: 'ready', generatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();

    return maskedResponse({ workoutPlan: (plan as { workoutPlan?: unknown } | null)?.workoutPlan ?? null });
  } catch (err) {
    console.error('[Workout Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate workout plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
