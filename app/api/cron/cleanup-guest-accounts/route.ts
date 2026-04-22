// ============================================
// POST /api/cron/cleanup-guest-accounts
// ============================================
// Runs daily via Vercel Cron (03:00 UTC).
// Deletes guest accounts inactive for > 10 days and cascades
// to their DailyLog and DailyPlan records.

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import DailyLog from '@/models/DailyLog';
import DailyPlan from '@/models/DailyPlan';
import { maskedResponse, errorResponse } from '@/lib/apiMask';

export const dynamic = 'force-dynamic';

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '');
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return errorResponse('Forbidden', 403);
  }

  await connectDB();

  const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

  const stale = await User.find(
    { isGuest: true, updatedAt: { $lt: cutoff } },
    { _id: 1 }
  ).lean();

  if (stale.length === 0) {
    return maskedResponse({ deleted: 0 });
  }

  const ids = stale.map((u) => u._id);

  await Promise.all([
    User.deleteMany({ _id: { $in: ids } }),
    DailyLog.deleteMany({ userId: { $in: ids } }),
    DailyPlan.deleteMany({ userId: { $in: ids } }),
  ]);

  return maskedResponse({ deleted: ids.length });
}
