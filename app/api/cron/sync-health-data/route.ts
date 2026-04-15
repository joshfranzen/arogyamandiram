import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import { runHealthDataSync } from '@/lib/healthDataSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function validateCronSecret(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '');
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

function isSyncDue(lastSyncAt: Date | string | undefined, syncIntervalMinutes: number, now: Date): boolean {
  if (!lastSyncAt) return true;
  const last = new Date(lastSyncAt);
  if (Number.isNaN(last.getTime())) return true;
  return now.getTime() - last.getTime() >= syncIntervalMinutes * 60 * 1000;
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return errorResponse('Unauthorized', 401);
  }

  await connectDB();
  const now = new Date();

  const users = await User.find({
    'settings.healthData.enabled': true,
    'settings.healthData.endpoint': { $exists: true, $ne: '' },
  })
    .select({
      _id: 1,
      'profile.timezone': 1,
      'settings.reminderSchedule.timezone': 1,
      'settings.healthData.endpoint': 1,
      'settings.healthData.syncIntervalMinutes': 1,
      'settings.healthData.lastSyncAt': 1,
      'settings.healthData.apiKeyEncrypted': 1,
    })
    .lean() as Array<{
    _id: { toString(): string };
    settings?: {
      healthData?: {
        endpoint?: string;
        apiKeyEncrypted?: string;
        syncIntervalMinutes?: number;
        lastSyncAt?: Date | string;
      };
      reminderSchedule?: {
        timezone?: string;
      };
    };
    profile?: {
      timezone?: string;
    };
  }>;

  let processed = 0;
  let synced = 0;
  let failed = 0;
  let skippedNotDue = 0;
  const errors: string[] = [];

  for (const user of users) {
    const userId = user._id.toString();
    const healthData = user.settings?.healthData;
    const endpoint = (healthData?.endpoint || '').trim();
    const syncIntervalMinutes = Math.max(5, Math.min(1440, Number(healthData?.syncIntervalMinutes ?? 60)));

    if (!endpoint) {
      skippedNotDue++;
      continue;
    }

    if (!isSyncDue(healthData?.lastSyncAt, syncIntervalMinutes, now)) {
      skippedNotDue++;
      continue;
    }

    processed++;
    const syncResult = await runHealthDataSync({
      userId,
      endpoint,
      apiKeyEncrypted: healthData?.apiKeyEncrypted || '',
      timezone: user.profile?.timezone || user.settings?.reminderSchedule?.timezone || undefined,
    });

    if (!syncResult.ok) {
      failed++;
      const errorMessage = syncResult.error || 'Sync failed';
      errors.push(`${userId}: ${errorMessage}`);
      await User.findByIdAndUpdate(userId, {
        $set: {
          'settings.healthData.lastSyncAt': now,
          'settings.healthData.lastSyncSource': 'auto',
          'settings.healthData.lastSyncStatus': 'error',
          'settings.healthData.lastSyncError': errorMessage,
        },
      });
      continue;
    }

    synced++;
    await User.findByIdAndUpdate(userId, {
      $set: {
        'settings.healthData.lastSyncAt': now,
        'settings.healthData.lastSyncSource': 'auto',
        'settings.healthData.lastSyncStatus': 'ok',
        'settings.healthData.lastSyncError': '',
        'settings.healthData.lastSchemaJson': JSON.stringify(syncResult.schema),
      },
    });
  }

  return maskedResponse({
    usersFound: users.length,
    processed,
    synced,
    failed,
    skippedNotDue,
    at: now.toISOString(),
    ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
  });
}

export { POST as GET };
