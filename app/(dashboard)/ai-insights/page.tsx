'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Sparkles, Dumbbell, Loader2, AlertCircle,
  Settings, Shield, Leaf, Flame, Droplets, Moon, Scale,
  Activity, ChevronDown, ChevronUp, Lightbulb, Zap,
  TrendingDown, TrendingUp, Clock, X, CheckCircle2,
} from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useUser } from '@/hooks/useUser';
import { showToast } from '@/components/ui/Toast';
import api from '@/lib/apiClient';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { DailyPlanData, AiMealSuggestion } from '@/types';

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

type UserTargets = {
  dailyCalories?: number;
  dailyWater?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  idealWeight?: number;
  dailyWorkoutMinutes?: number;
  sleepHours?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeApiError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('openai api key required'))
    return 'Connect your OpenAI API key in Settings → API Keys to generate plans.';
  if (lower.includes('invalid') && lower.includes('api key'))
    return 'Your OpenAI API key looks invalid or expired. Update it in Settings → API Keys.';
  if (lower.includes('unsupported state') || lower.includes('unable to authenticate') || lower.includes('unauthorized'))
    return 'OpenAI could not authenticate your key. Double-check in Settings → API Keys.';
  return raw;
}

function pct(actual: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

function adherenceColor(p: number): string {
  if (p >= 80) return 'text-emerald-400';
  if (p >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

function metricColor(p: number): string {
  if (p >= 100) return 'border-emerald-500/30 bg-emerald-500/5';
  if (p >= 70) return 'border-amber-500/30 bg-amber-500/5';
  if (p > 0) return 'border-rose-500/30 bg-rose-500/5';
  return 'border-zinc-800 bg-zinc-900/50';
}

function getTimeBanner(
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
    return 'You\'ve had very little water so far. Aim for 500ml before your next meal.';
  return null;
}

function calcRecoveryScore(
  log: TodayLog | null,
  targets: UserTargets | undefined,
  yesterdayDifficulty?: string
): number {
  if (!log || !targets) return 0;
  const sleepTarget = targets.sleepHours ?? 8;
  const workoutTarget = targets.dailyWorkoutMinutes ?? 30;
  const sleepScore = Math.min(1, (log.sleep?.duration ?? 0) / sleepTarget) * 40;
  const workoutScore = Math.min(1, log.workoutMinutes / workoutTarget) * 30;
  const fatiguePenalty = yesterdayDifficulty === 'too_hard' ? 10 : 0;
  return Math.round(sleepScore + workoutScore + 30 - fatiguePenalty);
}

function recoveryLabel(score: number): string {
  if (score >= 75) return 'Ready';
  if (score >= 50) return 'Moderate';
  return 'Rest';
}

function recoveryColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-rose-400';
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const INTENSITY_BADGE: Record<string, string> = {
  low: 'bg-zinc-800 text-zinc-400',
  medium: 'bg-amber-500/10 text-amber-400',
  high: 'bg-rose-500/10 text-rose-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MealCard({
  meal,
  onDislike,
  disliked,
}: {
  meal: AiMealSuggestion;
  onDislike: (name: string) => void;
  disliked: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn('rounded-xl border p-4 transition-all', disliked ? 'opacity-40 line-through' : 'border-zinc-800 bg-zinc-900/30')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary">{meal.name}</p>
            {meal.isVegetarian && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                <Leaf className="h-2.5 w-2.5" /> Veg
              </span>
            )}
          </div>
          {meal.description && (
            <p className="mt-0.5 text-xs text-text-muted leading-relaxed">{meal.description}</p>
          )}
          {/* Macro chips */}
          <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
            <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              <Flame className="h-2.5 w-2.5 text-orange-400" /> {meal.calories} kcal
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              P {meal.protein}g
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              C {meal.carbs}g
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
              F {meal.fat}g
            </span>
          </div>
        </div>
        {!disliked && (
          <button
            type="button"
            title="Don't like this"
            onClick={() => onDislike(meal.name)}
            className="shrink-0 rounded-full p-1 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Ingredients toggle */}
      {meal.ingredients && meal.ingredients.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide' : 'Show'} ingredients
        </button>
      )}
      {expanded && (
        <p className="mt-1 text-[10px] text-zinc-400 leading-relaxed">
          {meal.ingredients.join(', ')}
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodaysPlanPage() {
  const { user, loading: userLoading } = useUser();
  const hasApiKey = user?.hasOpenAiKey;
  const targets = user?.targets as UserTargets | undefined;

  const [plan, setPlan] = useState<DailyPlanData | null>(null);
  const [todayLog, setTodayLog] = useState<TodayLog | null>(null);
  const [yesterdayFeedback, setYesterdayFeedback] = useState<{ workoutDifficulty?: string } | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const [generating, setGenerating] = useState<'food' | 'workout' | 'overview' | 'full' | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'food' | 'workout'>('overview');

  // Feedback state
  const [dislikedFoods, setDislikedFoods] = useState<string[]>([]);
  const [workoutDifficulty, setWorkoutDifficulty] = useState<string | null>(null);
  const [skippedWorkoutReason, setSkippedWorkoutReason] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadPlan = useCallback(async () => {
    if (!user) return;
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await api.getTodaysPlan();
      if (res.success && res.data) {
        setPlan((res.data.plan as DailyPlanData | null) ?? null);
        setTodayLog((res.data.todayLog as TodayLog | null) ?? null);
        setYesterdayFeedback((res.data.yesterdayFeedback as { workoutDifficulty?: string } | null) ?? null);
        // Pre-fill feedback from existing plan
        const existingFeedback = (res.data.plan as DailyPlanData | null)?.feedback;
        if (existingFeedback?.workoutDifficulty) setWorkoutDifficulty(existingFeedback.workoutDifficulty);
        if (existingFeedback?.dislikedFoods) setDislikedFoods(existingFeedback.dislikedFoods);
      }
    } catch {
      setPlanError('Failed to load your plan. Please try again.');
    } finally {
      setPlanLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleGenerateNow = async (type: 'food' | 'workout' | 'overview' | 'full' = 'full') => {
    setGenerating(type);
    setPlanError(null);
    try {
      const res = await api.generatePlanNow(type);
      if (res.success && res.data?.plan) {
        setPlan(res.data.plan as unknown as DailyPlanData);
        const label = type === 'food' ? 'Food plan' : type === 'workout' ? 'Workout plan' : type === 'overview' ? 'Overview' : 'Plan';
        showToast(`${label} regenerated!`, 'success');
      } else {
        setPlanError(normalizeApiError(res.error || 'Failed to generate plan'));
      }
    } catch {
      setPlanError('Failed to generate plan. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  const handleDislikeFood = (name: string) => {
    setDislikedFoods((prev) => (prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name]));
    setFeedbackSaved(false);
  };

  const handleSaveFeedback = async () => {
    setFeedbackSaving(true);
    try {
      const res = await api.submitPlanFeedback({
        date: today,
        ...(workoutDifficulty ? { workoutDifficulty } : {}),
        ...(skippedWorkoutReason ? { skippedWorkoutReason } : {}),
        ...(dislikedFoods.length > 0 ? { dislikedFoods } : {}),
      });
      if (res.success) {
        setFeedbackSaved(true);
        showToast('Feedback saved — your next plan will adapt!', 'success');
      } else {
        showToast(res.error || 'Failed to save feedback', 'error');
      }
    } catch {
      showToast('Failed to save feedback', 'error');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const hasFeedbackChanges = dislikedFoods.length > 0 || workoutDifficulty !== null || skippedWorkoutReason !== null;

  // Computed values
  const hour = typeof window !== 'undefined' ? new Date().getHours() : 12;
  const timeBanner = getTimeBanner(hour, todayLog, targets);
  const recoveryScore = calcRecoveryScore(todayLog, targets, yesterdayFeedback?.workoutDifficulty);

  const foodPct = pct(todayLog?.totalCalories ?? 0, targets?.dailyCalories ?? 2000);
  const workoutPct = pct(todayLog?.workoutMinutes ?? 0, targets?.dailyWorkoutMinutes ?? 30);
  const sleepPct = pct(todayLog?.sleep?.duration ?? 0, targets?.sleepHours ?? 8);
  const waterPct = pct((todayLog?.waterIntake ?? 0) / 1000, (targets?.dailyWater ?? 2500) / 1000);

  // Group meals by type
  const mealGroups = (() => {
    const suggestions = plan?.foodPlan?.suggestions ?? [];
    const groups = new Map<string, AiMealSuggestion[]>();
    for (const meal of suggestions) {
      const type = meal.mealType || 'snack';
      const arr = groups.get(type) ?? [];
      arr.push(meal);
      groups.set(type, arr);
    }
    return MEAL_ORDER.filter((t) => groups.has(t)).map((t) => ({ type: t, meals: groups.get(t)! }));
  })();

  if (userLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10" />
        <CardSkeleton className="h-64" />
        <CardSkeleton className="h-48" />
        <CardSkeleton className="h-64" />
      </div>
    );
  }

  return (
    <DashboardPageShell
      title="Today's Plan"
      subtitle="Your personalized daily health plan"
      icon={CalendarDays}
    >
      <div className="space-y-4">

      {/* ── Tab bar ── */}
      <div className="mt-4 mobile-fade-up mobile-dash-px lg:px-0">
        <div className="flex gap-2">
          {([
            { key: 'overview', label: 'Overview', icon: Zap },
            { key: 'food',     label: 'Food', icon: Flame },
            { key: 'workout',  label: 'Workout',   icon: Dumbbell },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-900/50 text-zinc-400 border border-transparent hover:bg-zinc-800 hover:text-zinc-300'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4 mobile-fade-up mobile-dash-px lg:px-0">

        {/* ── No API Key Warning (always visible) ── */}
        {!hasApiKey && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-text-primary">Connect your OpenAI API key</p>
              <p className="mt-1 text-xs text-text-muted">
                Your plan is powered by OpenAI. Add your key in Settings to enable AI-generated plans.
                Your key is encrypted and stored securely.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Open Settings
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ── OVERVIEW TAB ── */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Time-aware context banner */}
            {timeBanner && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-200">{timeBanner}</p>
              </div>
            )}

            {/* Top Insight */}
            {plan?.topInsight && (
              <div className="dashboard-unified-card rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Zap className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Main Focus Today</span>
                </div>
                <p className="mt-2 text-sm font-medium text-text-primary">{plan.topInsight}</p>
              </div>
            )}

            {/* Health Blueprint */}
            <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-text-primary">Health Blueprint</h2>
                <p className="mt-0.5 text-xs text-text-muted">Today&apos;s progress vs your targets</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {/* Sleep */}
                {(() => {
                  const actual = todayLog?.sleep?.duration ?? 0;
                  const target = targets?.sleepHours ?? 8;
                  const p = pct(actual, target);
                  return (
                    <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(p))}>
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
                  const p = pct(actualL, targetL);
                  return (
                    <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(p))}>
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
                  const p = pct(actual, target);
                  return (
                    <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(p))}>
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
                  const p = pct(actual, target);
                  return (
                    <div className={cn('flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center', metricColor(p))}>
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
              {plan?.prediction && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5">
                  {plan.prediction.weeklyWeightChangeKg < 0 ? (
                    <TrendingDown className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : plan.prediction.weeklyWeightChangeKg > 0 ? (
                    <TrendingUp className="h-4 w-4 shrink-0 text-amber-400" />
                  ) : (
                    <Scale className="h-4 w-4 shrink-0 text-zinc-400" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      At this rate →{' '}
                      {plan.prediction.weeklyWeightChangeKg > 0 ? '+' : ''}
                      {plan.prediction.weeklyWeightChangeKg} kg/week
                      {plan.prediction.projectedWeightKg ? ` (≈ ${plan.prediction.projectedWeightKg} kg in 4 weeks)` : ''}
                    </p>
                    <p className="text-[10px] text-text-muted">{plan.prediction.basis}</p>
                  </div>
                </div>
              )}
            </div>

            {/* No plan — overview */}
            {!planLoading && !plan && (
              <div className="dashboard-unified-card rounded-2xl border p-5">
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <CalendarDays className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-300">No plan generated yet</p>
                  <p className="text-xs text-zinc-500">Switch to Food or Workout tab and hit Generate Now.</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Loading skeleton ── */}
        {planLoading && (
          <>
            <CardSkeleton className="h-64" />
            <CardSkeleton className="h-64" />
          </>
        )}

        {/* ── Plan error ── */}
        {!planLoading && planError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <p className="text-xs text-text-secondary">{planError}</p>
          </div>
        )}

        {/* ── No plan state ── */}
        {!planLoading && !plan?.foodPlan && !planError && activeTab === 'food' && (
          <div className="dashboard-unified-card rounded-2xl border p-5">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CalendarDays className="h-12 w-12 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Your plan is being prepared</p>
              <p className="text-xs text-zinc-500">
                Plans are auto-generated at midnight from your daily logs.
              </p>
              {hasApiKey && (
                <button
                  onClick={() => handleGenerateNow('food')}
                  disabled={!!generating}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {generating === 'food' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-black" />
                  )}
                  {generating === 'food' ? 'Generating…' : 'Generate Food Plan'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ── SECTION 1: Today's Food Plan ── */}
        {/* ══════════════════════════════════════════════════ */}
        {!planLoading && plan?.foodPlan && activeTab === 'food' && (
          <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
            {/* Privacy notice */}
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Only anonymized metrics are sent to OpenAI — never your name or email.
            </p>

            <div className="mb-4 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <h2 className="text-base font-semibold text-text-primary">Today&apos;s Food Plan</h2>
            </div>

            {/* AI reasoning */}
            {plan.foodPlan.reasoning && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-200">{plan.foodPlan.reasoning}</p>
              </div>
            )}

            {/* Meal groups */}
            <div className="space-y-5">
              {mealGroups.map(({ type, meals }) => (
                <div key={type}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 capitalize">
                    {type}
                  </p>
                  <div className="space-y-2">
                    {meals.map((meal) => (
                      <MealCard
                        key={meal.name}
                        meal={meal}
                        onDislike={handleDislikeFood}
                        disliked={dislikedFoods.includes(meal.name)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Feedback bar */}
            {(hasFeedbackChanges || dislikedFoods.length > 0) && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3">
                <p className="text-xs text-zinc-400">
                  {dislikedFoods.length > 0
                    ? `${dislikedFoods.length} food${dislikedFoods.length > 1 ? 's' : ''} marked — saves for tomorrow`
                    : 'Feedback ready to save'}
                </p>
                <button
                  onClick={handleSaveFeedback}
                  disabled={feedbackSaving || feedbackSaved}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {feedbackSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : feedbackSaved ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : null}
                  {feedbackSaved ? 'Saved!' : 'Save for tomorrow'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ── SECTION 2: Today's Workout Plan ── */}
        {/* ══════════════════════════════════════════════════ */}
        {!planLoading && plan?.workoutPlan && activeTab === 'workout' && (
          <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-text-primary">Today&apos;s Workout Plan</h2>
            </div>

            {/* AI reasoning */}
            {plan.workoutPlan.reasoning && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-200">{plan.workoutPlan.reasoning}</p>
              </div>
            )}

            {/* Plan header */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-text-primary">{plan.workoutPlan.name}</p>
              {plan.workoutPlan.description && (
                <p className="mt-0.5 text-xs text-text-muted">{plan.workoutPlan.description}</p>
              )}
              <div className="mt-2 flex gap-2">
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300">
                  {plan.workoutPlan.durationMinutes} min
                </span>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300">
                  ~{plan.workoutPlan.estimatedCalories} kcal
                </span>
              </div>
            </div>

            {/* Exercises */}
            <div className="space-y-2">
              {plan.workoutPlan.exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{ex.name}</p>
                    <p className="text-xs text-text-muted">
                      {ex.durationMinutes && ex.durationMinutes > 0
                        ? `${ex.durationMinutes} min`
                        : `${ex.sets} × ${ex.reps}`}
                      {ex.restSeconds ? ` · ${ex.restSeconds}s rest` : ''}
                    </p>
                  </div>
                  {ex.intensity && (
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] capitalize font-medium', INTENSITY_BADGE[ex.intensity] ?? INTENSITY_BADGE.medium)}>
                      {ex.intensity}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Progression tip */}
            {plan.workoutPlan.progressionTip && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <p className="text-xs text-emerald-200">{plan.workoutPlan.progressionTip}</p>
              </div>
            )}

            {/* Workout feedback */}
            <div className="mt-5 space-y-3 border-t border-zinc-800 pt-4">
              <p className="text-xs font-medium text-text-muted">How was today&apos;s workout?</p>
              <div className="flex flex-wrap gap-2">
                {(['too_easy', 'just_right', 'too_hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setWorkoutDifficulty(d); setFeedbackSaved(false); }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs capitalize transition-all',
                      workoutDifficulty === d
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    )}
                  >
                    {d.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <p className="text-xs font-medium text-text-muted">Did you skip it?</p>
              <div className="flex flex-wrap gap-2">
                {(['no_time', 'tired', 'injury', 'other'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setSkippedWorkoutReason(skippedWorkoutReason === r ? null : r); setFeedbackSaved(false); }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs capitalize transition-all',
                      skippedWorkoutReason === r
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    )}
                  >
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {hasFeedbackChanges && (
                <button
                  onClick={handleSaveFeedback}
                  disabled={feedbackSaving || feedbackSaved}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {feedbackSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : feedbackSaved ? <CheckCircle2 className="h-3 w-3" /> : null}
                  {feedbackSaved ? 'Saved!' : 'Save feedback'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── No plan state for workout tab ── */}
        {!planLoading && !plan?.workoutPlan && !planError && activeTab === 'workout' && (
          <div className="dashboard-unified-card rounded-2xl border p-5">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Dumbbell className="h-12 w-12 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">Your workout plan is being prepared</p>
              <p className="text-xs text-zinc-500">Plans auto-generate at midnight from your daily logs.</p>
              {hasApiKey && (
                <button
                  onClick={() => handleGenerateNow('workout')}
                  disabled={!!generating}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  {generating === 'workout' ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <Sparkles className="h-4 w-4 text-black" />}
                  {generating === 'workout' ? 'Generating…' : 'Generate Workout'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Per-tab regenerate buttons when plan exists */}
        {!planLoading && hasApiKey && (
          <div className="flex justify-center pb-4">
            {activeTab === 'food' && plan?.foodPlan && (
              <button
                onClick={() => handleGenerateNow('food')}
                disabled={!!generating}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {generating === 'food' ? 'Regenerating food plan…' : 'Regenerate food plan'}
              </button>
            )}
            {activeTab === 'workout' && plan?.workoutPlan && (
              <button
                onClick={() => handleGenerateNow('workout')}
                disabled={!!generating}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {generating === 'workout' ? 'Regenerating workout…' : 'Regenerate workout'}
              </button>
            )}
            {activeTab === 'overview' && (
              <button
                onClick={() => handleGenerateNow('overview')}
                disabled={!!generating}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {generating === 'overview' ? 'Regenerating overview…' : 'Regenerate overview'}
              </button>
            )}
          </div>
        )}

      </div>
      </div>
    </DashboardPageShell>
  );
}
