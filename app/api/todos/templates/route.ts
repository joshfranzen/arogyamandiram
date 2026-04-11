// ============================================
// /api/todos/templates — Manage recurring todo templates
// ============================================
// GET    → list all templates
// POST   { title, note?, time?, category? } → create template
// PUT    { id, title?, note?, time?, category?, enabled? } → update template
// DELETE ?id= → delete template

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { getAuthUserId, isUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    await connectDB();
    const user = await User.findById(userId).select('settings.todoTemplates').lean();
    const templates =
      (user as { settings?: { todoTemplates?: unknown[] } } | null)?.settings?.todoTemplates ?? [];

    return maskedResponse({ templates });
  } catch (err) {
    console.error('[Todo Templates GET Error]:', err);
    return errorResponse('Failed to fetch todo templates', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const body = (await req.json()) as {
      title?: string;
      note?: string;
      time?: string;
      category?: string;
      frequency?: number;
      baseItems?: unknown[];
    };

    const title = body.title?.trim();
    if (!title) return errorResponse('title is required', 400);

    const rawFreq = typeof body.frequency === 'number' ? body.frequency : 1;
    const frequency = Math.min(5, Math.max(1, Math.round(rawFreq)));

    const newTemplate = {
      id: crypto.randomUUID(),
      title,
      note: body.note?.trim() ?? '',
      time: body.time?.trim() ?? '',
      category: body.category ?? 'other',
      enabled: true,
      frequency,
      baseItems: Array.isArray(body.baseItems) ? body.baseItems : [],
    };

    await connectDB();
    await User.findByIdAndUpdate(userId, {
      $push: { 'settings.todoTemplates': newTemplate },
    });

    return maskedResponse({ template: newTemplate });
  } catch (err) {
    console.error('[Todo Templates POST Error]:', err);
    return errorResponse('Failed to create todo template', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const body = (await req.json()) as {
      id?: string;
      title?: string;
      note?: string;
      time?: string;
      category?: string;
      enabled?: boolean;
      frequency?: number;
    };

    if (!body.id) return errorResponse('id is required', 400);

    await connectDB();

    const updateFields: Record<string, unknown> = {};
    if (body.title !== undefined) updateFields['settings.todoTemplates.$.title'] = body.title.trim();
    if (body.note !== undefined) updateFields['settings.todoTemplates.$.note'] = body.note.trim();
    if (body.time !== undefined) updateFields['settings.todoTemplates.$.time'] = body.time.trim();
    if (body.category !== undefined) updateFields['settings.todoTemplates.$.category'] = body.category;
    if (body.enabled !== undefined) updateFields['settings.todoTemplates.$.enabled'] = body.enabled;
    if (body.frequency !== undefined) {
      const freq = Math.min(5, Math.max(1, Math.round(body.frequency)));
      updateFields['settings.todoTemplates.$.frequency'] = freq;
    }

    await User.findOneAndUpdate(
      { _id: userId, 'settings.todoTemplates.id': body.id },
      { $set: updateFields }
    );

    return maskedResponse({ ok: true });
  } catch (err) {
    console.error('[Todo Templates PUT Error]:', err);
    return errorResponse('Failed to update todo template', 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!isUserId(userId)) return userId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('id is required', 400);

    await connectDB();
    await User.findByIdAndUpdate(userId, {
      $pull: { 'settings.todoTemplates': { id } },
    });

    return maskedResponse({ ok: true });
  } catch (err) {
    console.error('[Todo Templates DELETE Error]:', err);
    return errorResponse('Failed to delete todo template', 500);
  }
}
