import { callOpenAI, type UserContext } from './context';

export async function generateFoodPlan(ctx: UserContext, apiKey: string) {
  const system = `You are an elite AI nutrition coach for Arogyamandiram. Generate ONLY a food plan.

Respond with this exact JSON:
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
        "mealType": "breakfast"|"lunch"|"dinner"|"snack",
        "ingredients": ["string"],
        "isVegetarian": boolean
      }
    ],
    "reasoning": "1-2 sentences explaining WHY this food plan"
  }
}

Rules: Suggest 4-6 foods across meal types. Match the user's goals, preferences, and disliked foods. If protein gap > 20g, prioritize high-protein options. Keep suggestions specific and realistic.`;

  const userPrompt = [
    ctx.profileContext, ctx.recentContext, ctx.yesterdayContext,
    ctx.feedbackContext, `Plan date: ${ctx.targetDate}`,
  ].filter(Boolean).join('\n');

  const ai = await callOpenAI(apiKey, system, userPrompt);
  return { ...ai, request: { systemPrompt: system, userPrompt } };
}
