'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, Loader2, Dumbbell, Lightbulb, Plus, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { showToast } from '@/components/ui/Toast';
import api from '@/lib/apiClient';
import type { DailyPlanData } from '@/types';
import { usePlanAutoRefresh } from './usePlanAutoRefresh';

type WorkoutExercise = NonNullable<DailyPlanData['workoutPlan']>['exercises'][number];
type WorkoutPlan = NonNullable<DailyPlanData['workoutPlan']>;

type WorkoutDraft = {
  reps: number;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

const INTENSITY_BADGE: Record<string, string> = {
  low: 'bg-zinc-800 text-zinc-400',
  medium: 'bg-amber-500/10 text-amber-400',
  high: 'bg-rose-500/10 text-rose-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractRepTarget(reps: string): number {
  const match = reps.match(/\d+/);
  if (!match) return 0;
  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function predictFiveMinuteTarget(exercise: WorkoutExercise) {
  const plannedDuration = Math.max(1, Number(exercise.durationMinutes) || 5);
  const plannedSets = Math.max(1, Number(exercise.sets) || 1);
  const plannedRepsPerSet = Math.max(0, extractRepTarget(exercise.reps));
  const plannedTotalReps = plannedRepsPerSet > 0 ? plannedRepsPerSet * plannedSets : 0;
  const sets = Math.max(1, Math.round((plannedSets / plannedDuration) * 5));
  if (plannedTotalReps <= 0) {
    return { sets, repsPerSet: plannedRepsPerSet || 10, totalReps: sets * (plannedRepsPerSet || 10) };
  }
  const totalReps = Math.max(1, Math.round((plannedTotalReps / plannedDuration) * 5));
  const repsPerSet = Math.max(1, Math.round(totalReps / sets));
  return { sets, repsPerSet, totalReps };
}

function getTargetText(exercise: WorkoutExercise): string {
  const sets = Math.max(1, Number(exercise.sets) || 1);
  const repsRaw = String(exercise.reps || '').trim();
  const parsedReps = extractRepTarget(repsRaw);
  const repsLabel = repsRaw || `${parsedReps || 10} reps`;
  const totalReps = parsedReps > 0 ? sets * parsedReps : 0;
  const restPart = exercise.restSeconds ? ` · ${exercise.restSeconds}s rest after each set` : '';
  return `${sets} sets × ${repsLabel}${totalReps > 0 ? ` (${totalReps} total)` : ''}${restPart}`;
}

// ─── WorkoutTab ───────────────────────────────────────────────────────────────

export default function WorkoutTab() {
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [workoutDrafts, setWorkoutDrafts] = useState<Record<string, WorkoutDraft>>({});
  const [workoutDifficulty, setWorkoutDifficulty] = useState<string | null>(null);
  const [skippedWorkoutReason, setSkippedWorkoutReason] = useState<string | null>(null);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/daily-plan/workout', { credentials: 'include' });
      const json = await res.json() as {
        success: boolean;
        data?: { workoutPlan?: WorkoutPlan | null; feedback?: { workoutDifficulty?: string } | null };
      };
      if (json.success) {
        setWorkoutPlan(json.data?.workoutPlan ?? null);
        const fb = json.data?.feedback;
        if (fb?.workoutDifficulty) setWorkoutDifficulty(fb.workoutDifficulty);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  usePlanAutoRefresh(load);

  useEffect(() => {
    const exercises = workoutPlan?.exercises ?? [];
    if (!exercises.length) { setWorkoutDrafts({}); return; }
    setWorkoutDrafts((prev) => {
      const next: Record<string, WorkoutDraft> = {};
      exercises.forEach((ex, index) => {
        const key = String(index);
        const predicted = predictFiveMinuteTarget(ex);
        const aiReps = Math.max(0, Number(ex.sets) || 0) * Math.max(0, extractRepTarget(ex.reps));
        next[key] = prev[key] ?? { reps: aiReps > 0 ? aiReps : predicted.totalReps, saving: false, saved: false, error: null };
      });
      return next;
    });
  }, [workoutPlan?.exercises]);

  const handleGenerate = async () => {
    const hadPlan = (workoutPlan?.exercises?.length ?? 0) > 0;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/daily-plan/workout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        await load();
        showToast(hadPlan ? 'Workout plan regenerated!' : 'Workout plan generated!', 'success');
      } else {
        const msg = json.error ?? 'Failed to generate workout plan';
        showToast(msg.toLowerCase().includes('api key') ? 'Add your OpenAI key in Settings.' : msg, 'error');
      }
    } catch {
      showToast('Failed to generate workout plan', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddExercise = async (exercise: WorkoutExercise, index: number) => {
    const key = String(index);
    const draft = workoutDrafts[key];
    if (draft?.saving) return;

    const predicted = predictFiveMinuteTarget(exercise);
    const safeReps = Math.max(0, Math.round((draft?.reps ?? predicted.totalReps) || 0));
    const category = (['cardio', 'strength', 'flexibility', 'sports'].includes(exercise.category ?? ''))
      ? exercise.category! : 'other';
    const totalDuration = Math.max(1, Number(workoutPlan?.durationMinutes) || 1);
    const totalCalories = Math.max(1, Number(workoutPlan?.estimatedCalories) || 1);
    const estimatedCalories = Math.max(1, Math.round((totalCalories / totalDuration) * 5));

    setWorkoutDrafts((prev) => ({ ...prev, [key]: { ...prev[key], saving: true, saved: false, error: null } }));
    try {
      const response = await api.addWorkout(today, {
        exercise: exercise.name, category, duration: 5, caloriesBurned: estimatedCalories,
        sets: Math.max(1, Number(exercise.sets) || 1),
        ...(safeReps > 0 ? { reps: safeReps } : {}),
        notes: `Planned: ${exercise.sets} x ${exercise.reps}; target: ${predicted.sets} x ${predicted.repsPerSet}${exercise.restSeconds ? `, rest ${exercise.restSeconds}s` : ''}`,
      });
      if (!response.success) {
        setWorkoutDrafts((prev) => ({ ...prev, [key]: { ...prev[key], saving: false, saved: false, error: response.error || 'Failed to add' } }));
        return;
      }
      setWorkoutDrafts((prev) => ({ ...prev, [key]: { ...prev[key], saving: false, saved: true, error: null } }));
      showToast(`${exercise.name} added to workout log`, 'success');
      setTimeout(() => setWorkoutDrafts((prev) => prev[key] ? { ...prev, [key]: { ...prev[key], saved: false } } : prev), 1500);
    } catch (err) {
      setWorkoutDrafts((prev) => ({
        ...prev, [key]: { ...prev[key], saving: false, saved: false, error: err instanceof Error ? err.message : 'Failed to add' },
      }));
    }
  };

  const handleSaveFeedback = async () => {
    setFeedbackSaving(true);
    try {
      const res = await api.submitPlanFeedback({
        date: today,
        ...(workoutDifficulty ? { workoutDifficulty } : {}),
        ...(skippedWorkoutReason ? { skippedWorkoutReason } : {}),
      });
      if (res.success) { setFeedbackSaved(true); showToast('Feedback saved — your next plan will adapt!', 'success'); }
      else showToast(res.error || 'Failed to save feedback', 'error');
    } catch { showToast('Failed to save feedback', 'error'); }
    finally { setFeedbackSaving(false); }
  };

  const hasFeedbackChanges = workoutDifficulty !== null || skippedWorkoutReason !== null;
  const currentWorkoutPlan = workoutPlan;
  const hasWorkoutPlanContent = (currentWorkoutPlan?.exercises?.length ?? 0) > 0;

  if (loading) return null;

  if (!currentWorkoutPlan || !hasWorkoutPlanContent) {
    return (
      <div className="dashboard-unified-card rounded-2xl border p-5">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Dumbbell className="h-12 w-12 text-zinc-600" />
          <p className="text-sm font-medium text-zinc-300">No workout plan generated yet</p>
          <p className="text-xs text-zinc-500">Plans auto-generate at midnight from your daily logs.</p>
          <button onClick={handleGenerate} disabled={generating}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <Sparkles className="h-4 w-4 text-black" />}
            {generating ? 'Generating…' : 'Generate Workout'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {currentWorkoutPlan.reasoning && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-200">{currentWorkoutPlan.reasoning}</p>
        </div>
      )}

      <div className="dashboard-unified-card rounded-2xl border p-5 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-emerald-400" />
          <h2 className="text-base font-semibold text-text-primary">Today&apos;s Workout Plan</h2>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors disabled:opacity-50">
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {/* Plan meta */}
      <div className="mb-4">
          <p className="text-sm font-semibold text-text-primary">{currentWorkoutPlan.name}</p>
        {currentWorkoutPlan.description && (
          <p className="mt-0.5 text-xs text-text-muted">{currentWorkoutPlan.description}</p>
        )}
        <div className="mt-2 flex gap-2">
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300">{currentWorkoutPlan.durationMinutes} min</span>
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300">~{currentWorkoutPlan.estimatedCalories} kcal</span>
        </div>
      </div>

      {/* Exercises */}
      <div className="space-y-2">
        {currentWorkoutPlan.exercises.map((ex, i) => {
          const draft = workoutDrafts[String(i)];
          return (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{ex.name}</p>
                  {ex.steps && ex.steps.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 list-none pl-0">
                      {ex.steps.map((step, si) => (
                        <li key={si} className="flex items-start gap-1.5 text-[11px] text-text-muted leading-relaxed">
                          <span className="mt-0.5 shrink-0 text-emerald-500">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-[11px] text-zinc-500">{getTargetText(ex)}</p>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent('how to perform ' + ex.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors underline underline-offset-2"
                  >
                    Search &ldquo;{ex.name}&rdquo; on Google
                  </a>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {ex.intensity && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] capitalize font-medium whitespace-nowrap', INTENSITY_BADGE[ex.intensity] ?? INTENSITY_BADGE.medium)}>
                      {ex.intensity}
                    </span>
                  )}
                  <button type="button" onClick={() => handleAddExercise(ex, i)} disabled={draft?.saving}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-black whitespace-nowrap hover:bg-emerald-400 disabled:opacity-50">
                    {draft?.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {draft?.saving ? 'Adding…' : 'Add'}
                  </button>
                  {draft?.saved && <span className="text-[11px] font-medium text-emerald-400 whitespace-nowrap">added ✓</span>}
                </div>
              </div>
              {draft?.error && <p className="mt-2 text-xs text-rose-400">{draft.error}</p>}
            </div>
          );
        })}
      </div>

      </div>

      {/* Progression tip */}
      {currentWorkoutPlan.progressionTip && (
        <div className="mt-2">
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p className="text-xs text-emerald-200">{currentWorkoutPlan.progressionTip}</p>
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="dashboard-unified-card rounded-2xl border p-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">How was today&apos;s workout?</p>
          <div className="flex flex-wrap gap-2">
            {(['too_easy', 'just_right', 'too_hard'] as const).map((d) => (
              <button key={d} type="button" onClick={() => { setWorkoutDifficulty(d); setFeedbackSaved(false); }}
                className={cn('rounded-full border px-3 py-1.5 text-xs capitalize transition-all',
                  workoutDifficulty === d
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                {d.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-text-muted">Did you skip it?</p>
          <div className="flex flex-wrap gap-2">
            {(['no_time', 'tired', 'injury', 'other'] as const).map((r) => (
              <button key={r} type="button" onClick={() => { setSkippedWorkoutReason(skippedWorkoutReason === r ? null : r); setFeedbackSaved(false); }}
                className={cn('rounded-full border px-3 py-1.5 text-xs capitalize transition-all',
                  skippedWorkoutReason === r
                    ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>
          {hasFeedbackChanges && (
            <button onClick={handleSaveFeedback} disabled={feedbackSaving || feedbackSaved}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50">
              {feedbackSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : feedbackSaved ? <CheckCircle2 className="h-3 w-3" /> : null}
              {feedbackSaved ? 'Saved!' : 'Save feedback'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
