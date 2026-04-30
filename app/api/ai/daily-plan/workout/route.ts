import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyPlan from '@/models/DailyPlan';
import { resolveOpenAIKey } from '@/lib/openaiKey';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

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

type WorkoutRequestBody = {
  lastWeekDetails?: string;
  goal?: string;
  fitnessLevel?: string;
  todayAvailableMinutes?: number;
};

function buildWorkoutPrompt(body: WorkoutRequestBody, date: string): string {
  const details = body.lastWeekDetails?.trim() || 'No previous workout details provided.';
  const goal = body.goal?.trim() || 'General fitness and consistency';
  const fitnessLevel = body.fitnessLevel?.trim() || 'beginner';
  const minutes = Number(body.todayAvailableMinutes);
  const durationTarget = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30;

  return [
    `Plan date: ${date}`,
    `Goal: ${goal}`,
    `Fitness level: ${fitnessLevel}`,
    `Today workout target minutes: ${durationTarget}`,
    `Last week details from user: ${details}`,
  ].join('\n');
}

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
        "intensity": "low" | "medium" | "high"
      }
    ],
    "durationMinutes": number,
    "focus": "string"
  }
}
Keep it realistic, beginner-friendly when unclear, and aligned to the user's details.`;
    const userPrompt = buildWorkoutPrompt(body, today);
    const ai = await callOpenAI(apiKey, systemPrompt, userPrompt) as { workoutPlan?: Record<string, unknown> };
    const workoutPlan = ai.workoutPlan ?? ai;

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
