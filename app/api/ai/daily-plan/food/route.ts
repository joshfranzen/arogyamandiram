import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { createOpenAiJson } from '@/lib/openaiJson';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';
import { writeDebugLog } from '@/lib/debugLogWriter';
import { buildFoodPrompt, type FoodRequestBody, normalizeFoodPlan } from '../shared';

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

    const body = await req.json().catch(() => ({})) as FoodRequestBody;
    const apiKey = await resolveOpenAIKey(userId);
    if (!apiKey) return errorResponse('OpenAI API key required. Add your key in Settings to generate plans.', 403);

    await connectDB();
    const today = getToday();
    const systemPrompt = `You are a practical nutrition coach. Create a simple food plan for TODAY based on the user's last-week food details.
Return JSON only with this shape:
{
  "foodPlan": {
    "suggestions": [
      {
        "name": "string",
        "description": "string",
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "mealType": "breakfast" | "lunch" | "dinner" | "snack"
      }
    ],
    "reasoning": "string"
  }
}
Keep suggestions realistic and easy to follow.`;
    const userPrompt = buildFoodPrompt(body, today);
    const ai = await createOpenAiJson<{
      foodPlan?: { suggestions?: unknown[]; reasoning?: string };
    }>({
      apiKey,
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
    });
    const foodPlan = normalizeFoodPlan(ai.foodPlan ?? ai);

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          'foodPlan.suggestions': foodPlan.suggestions,
          'foodPlan.reasoning': foodPlan.reasoning ?? null,
          status: 'ready',
          generatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).lean();

    await writeDebugLog({
      userId,
      page: 'today-plan',
      agent: 'food',
      payload: {
        userRequest: {
          requestedAt: new Date().toISOString(),
          action: 'generate',
          date: today,
          body,
        },
        systemPrompt,
        userPrompt,
        parsedResult: { foodPlan },
        metadata: {
          status: 'success',
          model: 'gpt-4o-mini',
        },
      },
    });

    return maskedResponse({ foodPlan });
  } catch (err) {
    console.error('[Food Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate food plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
