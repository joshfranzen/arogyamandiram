// ============================================
// /api/todos — Daily todo completions
// ============================================
// GET ?date=YYYY-MM-DD → { templates, completions }
// POST { templateId, date, completed } → toggle completion

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import DailyLog from '@/models/DailyLog';
import User from '@/models/User';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';
import { getToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || getToday();

    await connectDB();

    const [user, log] = await Promise.all([
      User.findById(userId).select('settings.todoTemplates').lean(),
      DailyLog.findOne({ userId, date }, { todoCompletions: 1 }).lean(),
    ]);

    const templates = (
      (user as { settings?: { todoTemplates?: unknown[] } } | null)?.settings?.todoTemplates ?? []
    ) as Array<{ id: string; title: string; note: string; time: string; category: string; enabled: boolean }>;

    const completions = (
      (log as { todoCompletions?: unknown[] } | null)?.todoCompletions ?? []
    ) as Array<{ templateId: string; completedAt: string }>;

    return maskedResponse({
      date,
      templates: templates.filter((t) => t.enabled),
      completions,
    });
  } catch (err) {
    console.error('[Todos GET Error]:', err);
    return errorResponse('Failed to fetch todos', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const body = (await req.json()) as { templateId?: string; date?: string; completed?: boolean };
    const { templateId, completed } = body;
    const date = body.date || getToday();

    if (!templateId) return errorResponse('templateId is required', 400);

    await connectDB();

    if (completed) {
      // Add completion (avoid duplicates)
      await DailyLog.findOneAndUpdate(
        { userId, date, 'todoCompletions.templateId': { $ne: templateId } },
        {
          $push: { todoCompletions: { templateId, completedAt: new Date().toISOString() } },
          $setOnInsert: { userId, date },
        },
        { upsert: true, new: true, strict: false }
      );
    } else {
      // Remove completion
      await DailyLog.findOneAndUpdate(
        { userId, date },
        { $pull: { todoCompletions: { templateId } } },
        { new: true, strict: false }
      );
    }

    return maskedResponse({ ok: true, templateId, date, completed });
  } catch (err) {
    console.error('[Todos POST Error]:', err);
    return errorResponse('Failed to update todo', 500);
  }
}
