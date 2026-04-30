import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type FoodRequestBody = {
  lastWeekFoodDetails?: string;
  goal?: string;
  dietaryPreference?: string;
};

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
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
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.error?.message as string) || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const rawText: string = data?.choices?.[0]?.message?.content;
  if (!rawText?.trim()) throw new Error('OpenAI returned an empty response.');
  return JSON.parse(rawText) as Record<string, unknown>;
}

function buildFoodPrompt(body: FoodRequestBody, date: string): string {
  const details = body.lastWeekFoodDetails?.trim() || 'No previous food details provided.';
  const goal = body.goal?.trim() || 'Eat balanced meals for health';
  const dietaryPreference = body.dietaryPreference?.trim() || 'No specific preference';

  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Dietary preference: ${dietaryPreference}`,
    `Last week food details from user: ${details}`,
  ].join('\n');
}

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
        "mealType": "breakfast" | "lunch" | "dinner" | "snack"
      }
    ],
    "reasoning": "string"
  }
}
Keep suggestions realistic and easy to follow.`;
    const userPrompt = buildFoodPrompt(body, today);
    const ai = await callOpenAI(apiKey, systemPrompt, userPrompt) as {
      foodPlan?: { suggestions?: unknown[]; reasoning?: string };
    };

    await DailyPlan.findOneAndUpdate(
      { userId, date: today },
      {
        $set: {
          'foodPlan.suggestions': ai.foodPlan?.suggestions ?? [],
          'foodPlan.reasoning': ai.foodPlan?.reasoning ?? null,
          status: 'ready',
          generatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).lean();

    return maskedResponse({ foodPlan: ai.foodPlan ?? null });
  } catch (err) {
    console.error('[Food Plan POST]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to generate food plan';
    return errorResponse(msg, msg.includes('API key') ? 403 : 500);
  }
}
