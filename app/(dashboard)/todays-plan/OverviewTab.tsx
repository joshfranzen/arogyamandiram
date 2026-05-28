'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Loader2, CalendarDays, Zap,
  Flame, Droplets, Moon, Scale, Activity,
  Footprints, HeartPulse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';
import { showToast } from '@/components/ui/Toast';
import type { UserTargets } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TodayLog = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  waterIntake: number;
  workoutMinutes: number;
  sleep: { duration: number; quality: number } | null;
  weight: number | null;
};

type ProjectionEntry = {
  headline?: string;
  coachNote?: string;
  actions?: string[];
};

type Projections = {
  sleep?: ProjectionEntry;
  food?: ProjectionEntry;
  water?: ProjectionEntry;
  workout?: ProjectionEntry;
  steps?: ProjectionEntry;
  heartRate?: ProjectionEntry;
  weight?: ProjectionEntry;
};

type OverviewData = {
  topInsight: string | null;
  projections: Projections | null;
  todayLog: TodayLog | null;
  yesterdayLog: TodayLog | null;
  yesterdayFeedback: { workoutDifficulty?: string } | null;
};

const PROJECTION_ROWS: Array<{
  key: keyof Projections;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'sleep',     label: 'Sleep',      icon: Moon },
  { key: 'food',      label: 'Food',       icon: Flame },
  { key: 'water',     label: 'Water',      icon: Droplets },
  { key: 'workout',   label: 'Workout',    icon: Activity },
  { key: 'steps',     label: 'Steps',      icon: Footprints },
  { key: 'heartRate', label: 'Heart Rate', icon: HeartPulse },
  { key: 'weight',    label: 'Weight',     icon: Scale },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(actual: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}
function metricColor(p: number) {
  if (p >= 100) return 'border-emerald-500/30 bg-emerald-500/5';
  if (p >= 70) return 'border-amber-500/30 bg-amber-500/5';
  if (p > 0) return 'border-rose-500/30 bg-rose-500/5';
  return 'border-zinc-800 bg-zinc-900/50';
}
function recoveryColor(score: number) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}
function recoveryLabel(score: number) {
  if (score >= 75) return 'Ready';
  if (score >= 50) return 'Moderate';
  return 'Rest';
}
export function calcRecoveryScore(
  log: TodayLog | null,
  targets: UserTargets | undefined,
  yesterdayDifficulty?: string
) {
  if (!log || !targets) return 0;
  const sleepScore = Math.min(1, (log.sleep?.duration ?? 0) / (targets.sleepHours ?? 8)) * 40;
  const workoutScore = Math.min(1, log.workoutMinutes / (targets.dailyWorkoutMinutes ?? 30)) * 30;
  const fatiguePenalty = yesterdayDifficulty === 'too_hard' ? 10 : 0;
  return Math.round(sleepScore + workoutScore + 30 - fatiguePenalty);
}
// ─── Component ────────────────────────────────────────────────────────────────

export default function OverviewTab() {
  const { user } = useUser();
  const hasApiKey = user?.hasOpenAiKey;
  const targets = user?.targets;

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/daily-plan/overview', { credentials: 'include' });
      const json: { success: boolean; data?: OverviewData } = await res.json();
      if (json.success && json.data) setData(json.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onFocus = () => { void load(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('orchestrator:log-updated', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('orchestrator:log-updated', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/daily-plan/overview', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json: { success: boolean; error?: string } = await res.json();
      if (json.success) {
        await load();
        showToast('Overview regenerated!', 'success');
      } else {
        showToast(json.error ?? 'Failed to generate overview', 'error');
      }
    } catch {
      showToast('Failed to generate overview', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const todayLog = data?.todayLog ?? null;
  const yesterdayLog = data?.yesterdayLog ?? null;
  const yesterdayFeedback = data?.yesterdayFeedback ?? null;
  const recoveryScore = calcRecoveryScore(todayLog, targets, yesterdayFeedback?.workoutDifficulty);

  const blueprintLog = yesterdayLog;

  return (
    <>
      <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Health Blueprint</h2>
            <p className="mt-0.5 text-xs text-text-muted">Yesterday vs your targets — use this to plan today</p>
          </div>
          {hasApiKey && (data?.topInsight || data?.projections) && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {generating ? 'Generating…' : 'Regenerate'}
            </button>
          )}
        </div>

        {data?.topInsight && (
          <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">Main Focus Today</span>
            </div>
            <p className="mt-2 text-sm font-medium text-text-primary">{data.topInsight}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Sleep */}
          {(() => {
            const actual = blueprintLog?.sleep?.duration ?? 0;
            const target = targets?.sleepHours ?? 8;
            return (
              <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(pct(actual, target)))}>
                <Moon className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-text-primary">
                  {actual > 0 ? actual.toFixed(1) : '—'}
                  <span className="text-xs font-normal text-zinc-500"> / {target}h</span>
                </p>
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Sleep</p>
              </div>
            );
          })()}
          {/* Water */}
          {(() => {
            const actualL = (blueprintLog?.waterIntake ?? 0) / 1000;
            const targetL = (targets?.dailyWater ?? 2500) / 1000;
            return (
              <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(pct(actualL, targetL)))}>
                <Droplets className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-text-primary">
                  {actualL > 0 ? actualL.toFixed(1) : '—'}
                  <span className="text-xs font-normal text-zinc-500"> / {targetL.toFixed(1)}L</span>
                </p>
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Water</p>
              </div>
            );
          })()}
          {/* Calories */}
          {(() => {
            const actual = blueprintLog?.totalCalories ?? 0;
            const target = targets?.dailyCalories ?? 2000;
            return (
              <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(pct(actual, target)))}>
                <Flame className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-text-primary">
                  {actual > 0 ? actual : '—'}
                  <span className="text-xs font-normal text-zinc-500"> / {target}</span>
                </p>
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Calories</p>
              </div>
            );
          })()}
          {/* Workout */}
          {(() => {
            const actual = blueprintLog?.workoutMinutes ?? 0;
            const target = targets?.dailyWorkoutMinutes ?? 30;
            return (
              <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(pct(actual, target)))}>
                <Activity className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-text-primary">
                  {actual > 0 ? actual : '—'}
                  <span className="text-xs font-normal text-zinc-500"> / {target}m</span>
                </p>
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Workout</p>
              </div>
            );
          })()}
          {/* Weight */}
          {(() => {
            const ideal = targets?.idealWeight;
            const current = blueprintLog?.weight;
            return (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                <Scale className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-bold text-text-primary">
                  {current ?? '—'}
                  {ideal && <span className="text-xs font-normal text-zinc-500"> / {ideal}kg</span>}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-text-muted">Weight</p>
              </div>
            );
          })()}
          {/* Recovery */}
          <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <Sparkles className={cn('h-5 w-5', recoveryColor(recoveryScore))} />
            <p className={cn('text-sm font-bold', recoveryColor(recoveryScore))}>
              {todayLog ? `${recoveryScore}%` : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">
              {todayLog ? recoveryLabel(recoveryScore) : 'Recovery'}
            </p>
          </div>
        </div>

        {data?.projections && (
          <div className="mt-4 space-y-3">
            {PROJECTION_ROWS.map(({ key, label, icon: Icon }) => {
              const entry = data.projections?.[key];
              if (!entry || (!entry.headline && !entry.coachNote && !(entry.actions?.length))) return null;
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
                      </div>
                      {entry.headline && (
                        <p className="mt-0.5 text-sm font-semibold text-text-primary">
                          At this rate → {entry.headline}
                        </p>
                      )}
                      {entry.coachNote && (
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{entry.coachNote}</p>
                      )}
                      {Array.isArray(entry.actions) && entry.actions.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {entry.actions.map((step, idx) => (
                            <li key={idx} className="flex gap-2 text-xs text-text-primary">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && !data?.topInsight && !data?.projections && (
        <div className="dashboard-unified-card rounded-2xl border p-5">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CalendarDays className="h-10 w-10 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">No overview generated yet</p>
            <p className="text-xs text-zinc-500">
              Generate your daily overview — AI will pick your #1 focus and predict your weight trend.
            </p>
            {hasApiKey && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <Sparkles className="h-4 w-4 text-black" />}
                {generating ? 'Generating…' : 'Generate Overview'}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
