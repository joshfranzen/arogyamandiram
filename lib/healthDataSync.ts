import DailyLog from '@/models/DailyLog';
import { decrypt } from '@/lib/encryption';
import { awardDailyXp } from '@/lib/xp';

export type HealthSyncSource = 'manual' | 'auto';

export interface HealthSyncAction {
  field: string;
  status: 'logged' | 'error';
  detail?: string;
}

export interface HealthSyncResult {
  ok: boolean;
  schema: Record<string, string>;
  rowCount: number;
  syncActions: HealthSyncAction[];
  error?: string;
}

function deriveWorkoutCategory(type: string): 'cardio' | 'strength' | 'flexibility' | 'sports' | 'other' {
  const t = type.toLowerCase();
  if (/walk|run|jog|cycl|bike|swim|row|elliptic|treadmill|hik|cardio|jump|aerobic|dance|zumba|stair/.test(t)) return 'cardio';
  if (/lift|weight|strength|bench|squat|deadlift|press|curl|pull.?up|push.?up|dumbbell|barbell|resistance/.test(t)) return 'strength';
  if (/yoga|stretch|pilates|flex|mobility|foam/.test(t)) return 'flexibility';
  if (/football|soccer|basketball|tennis|badminton|cricket|volleyball|rugby|hockey|baseball|golf|sport/.test(t)) return 'sports';
  return 'other';
}

function getSchema(rawData: unknown): Record<string, string> {
  const schema: Record<string, string> = {};
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    for (const [k, v] of Object.entries(rawData as Record<string, unknown>)) {
      schema[k] = Array.isArray(v) ? 'array' : typeof v;
    }
  } else if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'object') {
    for (const [k, v] of Object.entries(rawData[0] as Record<string, unknown>)) {
      schema[k] = Array.isArray(v) ? 'array' : typeof v;
    }
  }
  return schema;
}

function to24hTime(value: Date): string {
  return value.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getValidTimezone(timezone?: string): string | null {
  if (!timezone) return null;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return null;
  }
}

function toDateKey(date: Date, timezone?: string): string {
  const validTimezone = getValidTimezone(timezone);
  if (!validTimezone) return date.toISOString().slice(0, 10);

  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get('year')}-${map.get('month')}-${map.get('day')}`;
}

function getEventTimestamp(record: Record<string, unknown>): number {
  const candidates = [record.receivedAt, record.date, record.timestamp, record.updatedAt, record.createdAt];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const ts = new Date(value).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  return Number.NEGATIVE_INFINITY;
}

function pickLatestRecord(rawData: unknown): Record<string, unknown> | null {
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    return rawData as Record<string, unknown>;
  }
  if (!Array.isArray(rawData) || rawData.length === 0) return null;

  const records = rawData.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (records.length === 0) return null;

  // Use the newest payload entry so dashboard numbers match latest device sample.
  return records.reduce((latest, current) =>
    getEventTimestamp(current) > getEventTimestamp(latest) ? current : latest
  );
}

export async function runHealthDataSync(input: {
  userId: string;
  endpoint: string;
  apiKeyEncrypted?: string;
  timezone?: string;
}): Promise<HealthSyncResult> {
  const syncActions: HealthSyncAction[] = [];
  const endpoint = input.endpoint.trim();
  if (!endpoint) {
    return {
      ok: false,
      schema: {},
      rowCount: 0,
      syncActions,
      error: 'No health data endpoint configured',
    };
  }

  let apiKey = '';
  if (input.apiKeyEncrypted?.trim()) {
    try {
      apiKey = decrypt(input.apiKeyEncrypted.trim());
    } catch {
      apiKey = '';
    }
  }

  let rawData: unknown;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(endpoint, { method: 'GET', headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const detail = `HTTP ${res.status} from ${endpoint}: ${errText.slice(0, 200) || 'Health endpoint request failed'}`;
      console.error('[healthDataSync] HTTP error:', detail);
      return { ok: false, schema: {}, rowCount: 0, syncActions, error: detail };
    }
    rawData = await res.json();
  } catch (err) {
    const base = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
    const causeMsg = cause instanceof Error
      ? ` — cause: ${cause.message}`
      : cause
        ? ` — cause: ${String(cause)}`
        : '';
    const detail = `${base}${causeMsg} [endpoint: ${endpoint}]`;
    console.error('[healthDataSync] fetch error:', detail);
    return {
      ok: false,
      schema: {},
      rowCount: 0,
      syncActions,
      error: detail.slice(0, 400),
    };
  }

  const schema = getSchema(rawData);
  const rowCount = Array.isArray(rawData) ? rawData.length : (rawData == null ? 0 : 1);
  const record = pickLatestRecord(rawData);

  if (!record) {
    return { ok: true, schema, rowCount, syncActions };
  }

  const recordDateStr = typeof record.date === 'string' ? record.date : '';
  const recordReceivedAtStr = typeof record.receivedAt === 'string' ? record.receivedAt : '';
  const primaryTimestamp = recordDateStr || recordReceivedAtStr;
  const parsedPrimaryTimestamp = primaryTimestamp ? new Date(primaryTimestamp) : null;
  const logDate = parsedPrimaryTimestamp && !Number.isNaN(parsedPrimaryTimestamp.getTime())
    ? toDateKey(parsedPrimaryTimestamp, input.timezone)
    : toDateKey(new Date(), input.timezone);
  let mutatedLog = false;

  // New schema: record.sleep.totalHours / .bedtime / .wake
  const sleepBlock = record.sleep && typeof record.sleep === 'object' ? record.sleep as Record<string, unknown> : null;
  const sleepHours = sleepBlock && typeof sleepBlock.totalHours === 'number' ? sleepBlock.totalHours : null;
  if (sleepHours !== null && sleepHours > 0 && sleepHours <= 24) {
    try {
      const rawBedtime = typeof sleepBlock?.bedtime === 'string' ? sleepBlock.bedtime : null;
      const rawWake = typeof sleepBlock?.wake === 'string' ? sleepBlock.wake : null;
      const wakeDate = rawWake ? new Date(rawWake) : null;
      const bedDate = rawBedtime ? new Date(rawBedtime) : null;
      const safeWake = wakeDate && !Number.isNaN(wakeDate.getTime()) ? wakeDate : new Date();
      const safeBed = bedDate && !Number.isNaN(bedDate.getTime())
        ? bedDate
        : new Date(safeWake.getTime() - sleepHours * 60 * 60 * 1000);
      const wakeTime = to24hTime(safeWake);
      const bedtime = to24hTime(safeBed);
      await DailyLog.findOneAndUpdate(
        { userId: input.userId, date: logDate },
        {
          $set: { sleep: { bedtime, wakeTime, duration: sleepHours, quality: 3, notes: '' } },
          $setOnInsert: { userId: input.userId, date: logDate },
        },
        { new: true, upsert: true }
      );
      mutatedLog = true;
      syncActions.push({ field: 'sleep', status: 'logged', detail: `${sleepHours}h sleep logged (bed ${bedtime} → wake ${wakeTime})` });
    } catch (err) {
      syncActions.push({ field: 'sleep', status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }

  const rawDeviceWorkouts = Array.isArray(record.workouts) ? record.workouts : [];
  const mappedDeviceWorkouts = rawDeviceWorkouts
    .filter((w) => w && typeof w === 'object')
    .map((w) => {
      const dw = w as Record<string, unknown>;
      return {
        exercise: typeof dw.type === 'string' ? dw.type.trim() : '',
        duration: typeof dw.durationMin === 'number' ? dw.durationMin : 0,
        caloriesBurned: typeof dw.calories === 'number' ? dw.calories : 0,
        category: deriveWorkoutCategory(typeof dw.type === 'string' ? dw.type : ''),
        source: 'device' as const,
      };
    })
    .filter((w) => w.exercise && w.duration > 0);

  if (mappedDeviceWorkouts.length > 0) {
    try {
      const existingLog = await DailyLog.findOne({ userId: input.userId, date: logDate }).lean();
      type StoredWorkout = { source?: string; exercise: string; duration: number; caloriesBurned: number; category: string };
      const manualWorkouts = existingLog
        ? (existingLog.workouts as StoredWorkout[]).filter((w) => w.source !== 'device')
        : [];

      const log = await DailyLog.findOneAndUpdate(
        { userId: input.userId, date: logDate },
        {
          $set: { workouts: [...manualWorkouts, ...mappedDeviceWorkouts] },
          $setOnInsert: { userId: input.userId, date: logDate },
        },
        { new: true, upsert: true }
      );
      if (log) await log.save();
      mutatedLog = true;
      syncActions.push({
        field: 'workouts',
        status: 'logged',
        detail: `${mappedDeviceWorkouts.length} workout${mappedDeviceWorkouts.length !== 1 ? 's' : ''} replaced (${manualWorkouts.length} manual kept)`,
      });
    } catch (err) {
      syncActions.push({ field: 'workouts', status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }

  // New schema: record.heart.avgBpm / record.activity.{steps,activeCalories,distanceKm}
  const heartBlock = record.heart && typeof record.heart === 'object' ? record.heart as Record<string, unknown> : null;
  const activityBlock = record.activity && typeof record.activity === 'object' ? record.activity as Record<string, unknown> : null;

  const metricsUpdate: Record<string, number> = {};
  if (heartBlock && typeof heartBlock.avgBpm === 'number') metricsUpdate.heartRate = heartBlock.avgBpm;
  if (activityBlock && typeof activityBlock.steps === 'number') metricsUpdate.steps = activityBlock.steps;
  if (activityBlock && typeof activityBlock.activeCalories === 'number') metricsUpdate.activeCalories = activityBlock.activeCalories;
  if (activityBlock && typeof activityBlock.distanceKm === 'number') metricsUpdate.distanceKm = activityBlock.distanceKm;
  if (Object.keys(metricsUpdate).length > 0) {
    try {
      await DailyLog.findOneAndUpdate(
        { userId: input.userId, date: logDate },
        { $set: metricsUpdate, $setOnInsert: { userId: input.userId, date: logDate } },
        { upsert: true, strict: false }
      );
      mutatedLog = true;
      for (const [field, val] of Object.entries(metricsUpdate)) {
        syncActions.push({ field, status: 'logged', detail: `${field}=${val}` });
      }
    } catch (err) {
      syncActions.push({ field: 'metrics', status: 'error', detail: err instanceof Error ? err.message : String(err) });
    }
  }

  if (mutatedLog) {
    await awardDailyXp(input.userId, logDate).catch(() => {});
  }

  return { ok: true, schema, rowCount, syncActions };
}
