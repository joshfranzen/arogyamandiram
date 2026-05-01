'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Loader2, CalendarDays, Zap,
  Flame, Droplets, Moon, Scale, Activity,
  TrendingDown, TrendingUp, Clock,
} from 'lucide-react';
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

type Prediction = {
  weeklyWeightChangeKg: number;
  projectedWeightKg: number;
  basis: string;
};

type OverviewData = {
  topInsight: string | null;
  prediction: Prediction | null;
  todayLog: TodayLog | null;
  yesterdayFeedback: { workoutDifficulty?: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(actual: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}
function adherenceColor(p: number) {
  if (p >= 80) return 'text-emerald-400';
  if (p >= 50) return 'text-amber-400';
  return 'text-rose-400';
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
export function getTimeBanner(
  hour: number,
  log: TodayLog | null,
  targets: UserTargets | undefined
): string | null {
  if (!log || !targets) return null;
  const workoutTarget = targets.dailyWorkoutMinutes ?? 30;
  const calorieTarget = targets.dailyCalories ?? 2000;
  const waterTarget = (targets.dailyWater ?? 2500) / 1000;
  if (hour >= 21 && log.workoutMinutes < workoutTarget * 0.5)
    return "It's late — swap the workout for a 20-min walk or stretching session instead.";
  if (hour >= 14 && log.totalCalories < calorieTarget * 0.4)
    return "You've only hit 40% of your calorie target. A protein-rich meal now will help.";
  if (hour >= 11 && log.waterIntake / 1000 < waterTarget * 0.3)
    return "You've had very little water so far. Aim for 500ml before your next meal.";
  return null;
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
      const json = await res.json() as { success: boolean; data?: OverviewData };
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
      const json = await res.json() as { success: boolean; error?: string };
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
  const yesterdayFeedback = data?.yesterdayFeedback ?? null;
  const hour = typeof window !== 'undefined' ? new Date().getHours() : 12;
  const timeBanner = getTimeBanner(hour, todayLog, targets);
  const recoveryScore = calcRecoveryScore(todayLog, targets, yesterdayFeedback?.workoutDifficulty);

  const foodPct    = pct(todayLog?.totalCalories ?? 0, targets?.dailyCalories ?? 2000);
  const workoutPct = pct(todayLog?.workoutMinutes ?? 0, targets?.dailyWorkoutMinutes ?? 30);
  const sleepPct   = pct(todayLog?.sleep?.duration ?? 0, targets?.sleepHours ?? 8);
  const waterPct   = pct((todayLog?.waterIntake ?? 0) / 1000, (targets?.dailyWater ?? 2500) / 1000);

  return (
    <>
      {timeBanner && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200">{timeBanner}</p>
        </div>
      )}

      {data?.topInsight && (
        <div className="dashboard-unified-card rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">Main Focus Today</span>
          </div>
          <p className="mt-2 text-sm font-medium text-text-primary">{data.topInsight}</p>
        </div>
      )}

      <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Health Blueprint</h2>
            <p className="mt-0.5 text-xs text-text-muted">Today&apos;s progress vs your targets</p>
          </div>
          {hasApiKey && (data?.topInsight || data?.prediction) && (
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Sleep */}
          {(() => {
            const actual = todayLog?.sleep?.duration ?? 0;
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
            const actualL = (todayLog?.waterIntake ?? 0) / 1000;
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
            const actual = todayLog?.totalCalories ?? 0;
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
            const actual = todayLog?.workoutMinutes ?? 0;
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
            const current = todayLog?.weight;
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

        {/* Adherence strip */}
        {todayLog && (
          <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs">
            <span>Food: <span className={cn('font-semibold', adherenceColor(foodPct))}>{foodPct}%</span></span>
            <span>Water: <span className={cn('font-semibold', adherenceColor(waterPct))}>{waterPct}%</span></span>
            <span>Workout: <span className={cn('font-semibold', adherenceColor(workoutPct))}>{workoutPct}%</span></span>
            <span>Sleep: <span className={cn('font-semibold', adherenceColor(sleepPct))}>{sleepPct}%</span></span>
          </div>
        )}

        {/* Prediction */}
        {data?.prediction && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
            {data.prediction.weeklyWeightChangeKg < 0 ? (
              <TrendingDown className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : data.prediction.weeklyWeightChangeKg > 0 ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <Scale className="h-4 w-4 shrink-0 text-zinc-400" />
            )}
            <div>
              <p className="text-xs font-semibold text-text-primary">
                At this rate →{' '}
                {data.prediction.weeklyWeightChangeKg > 0 ? '+' : ''}
                {data.prediction.weeklyWeightChangeKg} kg/week
                {data.prediction.projectedWeightKg ? ` (≈ ${data.prediction.projectedWeightKg} kg in 4 weeks)` : ''}
              </p>
              <p className="text-[10px] text-text-muted">{data.prediction.basis}</p>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && !data?.topInsight && !data?.prediction && (
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
