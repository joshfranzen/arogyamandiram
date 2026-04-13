// ============================================
// /api/cron/send-reminders — Scheduled reminder emails
// ============================================
// Called by Vercel Cron regularly (every 15 minutes).
// Dispatches reminder emails based on each user's timezone,
// schedule preferences, and notification toggles.
// No defaults — if a user hasn't configured a value, that reminder is skipped.

import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { maskedResponse, errorResponse } from '@/lib/apiMask';
import type { ReminderType } from '@/lib/email/imap';

export const dynamic = 'force-dynamic';

// Map reminder type → notification setting key
const REMINDER_TO_NOTIF: Record<ReminderType, string> = {
  water:    'water',
  breakfast:'meals',
  lunch:    'meals',
  dinner:   'meals',
  workout:  'workout',
  weighIn:  'weighIn',
  sleep:    'sleep',
};

function getValidTimezone(rawTimezone: string | undefined): string | null {
  if (!rawTimezone) return null;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: rawTimezone }).format(new Date());
    return rawTimezone;
  } catch {
    return null;
  }
}

function getLocalDateTimeParts(date: Date, timezone: string): { localDate: string; hour: number; minute: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const localDate = `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
  const hour = parseInt(map.get('hour') ?? '0', 10);
  const minute = parseInt(map.get('minute') ?? '0', 10);
  return { localDate, hour, minute };
}

function parseHourMinute(hhmm: string): { hour: number; minute: number } | null {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const hour = parseInt(hourRaw ?? '', 10);
  const minute = parseInt(minuteRaw ?? '', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function isDueInWindow(
  localHour: number,
  localMinute: number,
  targetTime: string,
  windowMinutes = 15
): boolean {
  const parsed = parseHourMinute(targetTime);
  if (!parsed) return false;
  const nowTotal = localHour * 60 + localMinute;
  const targetTotal = parsed.hour * 60 + parsed.minute;
  const diff = (nowTotal - targetTotal + 24 * 60) % (24 * 60);
  return diff >= 0 && diff < windowMinutes;
}

function sentInSame30MinWindow(lastSentAt: Date | string | undefined, timezone: string, now: Date): boolean {
  if (!lastSentAt) return false;
  const lastDate = new Date(lastSentAt);
  if (Number.isNaN(lastDate.getTime())) return false;
  const lastLocal = getLocalDateTimeParts(lastDate, timezone);
  const nowLocal = getLocalDateTimeParts(now, timezone);
  if (lastLocal.localDate !== nowLocal.localDate) return false;
  if (lastLocal.hour !== nowLocal.hour) return false;
  // Same 30-min block: 0–29 = block 0, 30–59 = block 1
  return Math.floor(lastLocal.minute / 30) === Math.floor(nowLocal.minute / 30);
}

function sameLocalDate(lastSentAt: Date | string | undefined, timezone: string, now: Date): boolean {
  if (!lastSentAt) return false;
  const lastDate = new Date(lastSentAt);
  if (Number.isNaN(lastDate.getTime())) return false;
  const lastLocal = getLocalDateTimeParts(lastDate, timezone);
  const nowLocal = getLocalDateTimeParts(now, timezone);
  return lastLocal.localDate === nowLocal.localDate;
}

function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
    ?? req.headers.get('authorization')?.replace('Bearer ', '');
  return Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
}

export async function POST(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return errorResponse('Unauthorized', 401);
  }
  const now = new Date();

  await connectDB();

  const origin = new URL(req.url).origin;
  const cronSecret = process.env.CRON_SECRET!;

  // Find users with SMTP fully configured (host + user email + encrypted pass)
  const users = await User.find({
    'settings.emailSettings.smtp.host': { $exists: true, $ne: '' },
    'settings.emailSettings.smtp.user': { $exists: true, $ne: '' },
    'settings.emailSettings.smtp.pass': { $exists: true, $ne: '' },
  })
    .select('email profile.name settings.notifications settings.emailSettings.smtp.host settings.reminderSchedule')
    .lean();

  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    const userId = String(user._id);
    const settings = (user.settings as Record<string, unknown>) ?? {};
    const notifications = settings.notifications as Record<string, boolean> | undefined;
    const reminderSchedule = (settings.reminderSchedule as Record<string, unknown> | undefined) ?? {};

    // Skip users without a configured timezone — no default fallback
    const timezone = getValidTimezone(reminderSchedule.timezone as string | undefined);
    if (!timezone) continue;

    const localNow = getLocalDateTimeParts(now, timezone);
    const nowTotalMinutes = localNow.hour * 60 + localNow.minute;
    const lastSentAt = (reminderSchedule.lastSentAt as Record<string, Date | string | undefined> | undefined) ?? {};

    const dueReminderTypes: ReminderType[] = [];
    const mealTimes = (reminderSchedule.mealTimes as Record<string, string> | undefined) ?? {};

    // Water: only between 06:00–09:00 local time, every 30 min
    const waterStart = 6 * 60;
    const waterEnd   = 9 * 60;
    const waterEnabled = (reminderSchedule.waterHourlyEnabled as boolean | undefined) !== false;
    if (
      waterEnabled
      && nowTotalMinutes >= waterStart
      && nowTotalMinutes < waterEnd
      && (localNow.minute < 15 || (localNow.minute >= 30 && localNow.minute < 45))
      && !sentInSame30MinWindow(lastSentAt.water, timezone, now)
    ) {
      dueReminderTypes.push('water');
    }

    // Meal reminders — only if user has configured that time
    if (mealTimes.breakfast && isDueInWindow(localNow.hour, localNow.minute, mealTimes.breakfast)
      && !sameLocalDate(lastSentAt.breakfast, timezone, now)) {
      dueReminderTypes.push('breakfast');
    }
    if (mealTimes.lunch && isDueInWindow(localNow.hour, localNow.minute, mealTimes.lunch)
      && !sameLocalDate(lastSentAt.lunch, timezone, now)) {
      dueReminderTypes.push('lunch');
    }
    if (mealTimes.dinner && isDueInWindow(localNow.hour, localNow.minute, mealTimes.dinner)
      && !sameLocalDate(lastSentAt.dinner, timezone, now)) {
      dueReminderTypes.push('dinner');
    }

    // Sleep — only if user has configured sleepTime
    const sleepTime = reminderSchedule.sleepTime as string | undefined;
    if (sleepTime && isDueInWindow(localNow.hour, localNow.minute, sleepTime)
      && !sameLocalDate(lastSentAt.sleep, timezone, now)) {
      dueReminderTypes.push('sleep');
    }

    // Workout — only if user has configured workoutTime
    const workoutTime = reminderSchedule.workoutTime as string | undefined;
    if (workoutTime && isDueInWindow(localNow.hour, localNow.minute, workoutTime)
      && !sameLocalDate(lastSentAt.workout, timezone, now)) {
      dueReminderTypes.push('workout');
    }

    // WeighIn — only if user has configured weighInTime
    const weighInTime = reminderSchedule.weighInTime as string | undefined;
    if (weighInTime && isDueInWindow(localNow.hour, localNow.minute, weighInTime)
      && !sameLocalDate(lastSentAt.weighIn, timezone, now)) {
      dueReminderTypes.push('weighIn');
    }

    const sentReminders: ReminderType[] = [];
    for (const reminderType of dueReminderTypes) {
      const notifKey = REMINDER_TO_NOTIF[reminderType];
      // Skip if the user has this notification type disabled
      if (notifications && notifKey in notifications && !notifications[notifKey]) {
        continue;
      }

      try {
        const res = await fetch(`${origin}/api/email/send-reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': cronSecret,
          },
          body: JSON.stringify({ userId, reminderType }),
        });

        if (res.ok) {
          sent++;
          sentReminders.push(reminderType);
        } else {
          const json = await res.json() as { error?: string };
          errors.push(`${userId}/${reminderType}: ${json.error ?? res.status}`);
        }
      } catch (err) {
        errors.push(`${userId}/${reminderType}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (sentReminders.length > 0) {
      const sentUpdate: Record<string, Date> = {};
      for (const type of sentReminders) {
        sentUpdate[`settings.reminderSchedule.lastSentAt.${type}`] = now;
      }
      await User.findByIdAndUpdate(userId, { $set: sentUpdate });
    }
  }

  return maskedResponse({ sent, errors, usersFound: users.length, at: now.toISOString() });
}

// Vercel Cron Jobs invoke routes with GET — alias so both GET and POST work
export { POST as GET };
