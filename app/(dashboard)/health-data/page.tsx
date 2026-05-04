'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, HeartPulse, Footprints, Flame, MapPin,
  RotateCcw, Loader2,
} from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import MetricChart from '@/components/ui/MetricChart';
import StatCard from '@/components/ui/StatCard';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/Toast';
import { useUser } from '@/hooks/useUser';
import { useAchievements } from '@/hooks/useAchievements';
import api from '@/lib/apiClient';
import type { UserTargets } from '@/types';

interface HealthMetricsEntry {
  date: string;
  heartRate?:      number;
  steps?:          number;
  activeCalories?: number;
  distanceKm?:     number;
}



function GoalBar({ value, goal, color }: { value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="mt-1.5 w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-text-muted">{value.toLocaleString()} / {goal.toLocaleString()}</p>
    </div>
  );
}


export default function HealthDataPage() {
  const { user } = useUser();
  const { achievements } = useAchievements();
  const targets: Partial<UserTargets> = (user?.targets as Partial<UserTargets>) ?? {};
  const stepsStreak = achievements?.streaks?.current?.steps ?? 0;
  const stepsStreakBest = achievements?.streaks?.best?.steps ?? 0;

  const [history, setHistory]   = useState<HealthMetricsEntry[]>([]);
  const [today,   setToday]     = useState<HealthMetricsEntry | null>(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [configured, setConfigured] = useState(false);
  const [period, setPeriod] = useState(7);

  const fetchMetrics = useCallback(async (days: number) => {
    setLoading(true);
    try {
      const res = await api.getHealthMetricsHistory(days);
      if (res.success && res.data) {
        setHistory(res.data.history);
        setToday(res.data.today);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if a health data endpoint is configured
  useEffect(() => {
    api.getHealthDataConfig().then((res) => {
      if (res.success && res.data) {
        setConfigured(!!(res.data.endpoint?.trim()));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { void fetchMetrics(period); }, [fetchMetrics, period]);

  useEffect(() => {
    const handler = () => fetchMetrics(period);
    window.addEventListener('orchestrator:log-updated', handler);
    return () => window.removeEventListener('orchestrator:log-updated', handler);
  }, [fetchMetrics, period]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.triggerHealthDataSync({ source: 'manual' });
      if (res.success && res.data) {
        const logged = res.data.syncActions.filter((a) => a.status === 'logged').length;
        showToast(`Synced — ${logged} field${logged !== 1 ? 's' : ''} updated`, 'success');
        await fetchMetrics(period);
      } else {
        showToast((res as { error?: string }).error || 'Sync failed', 'error');
      }
    } catch {
      showToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toChartData = (field: keyof Omit<HealthMetricsEntry, 'date'>) =>
    history
      .filter((e) => e[field] != null)
      .map((e) => ({ date: e.date, value: e[field] as number }));

  const stepGoal     = targets.dailySteps     ?? 8000;
  const calBurnGoal  = targets.dailyCalorieBurn ?? 400;
  const distanceGoal = targets.idealDistance   ?? 5;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton className="h-48" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} className="h-[250px]" />)}
        </div>
      </div>
    );
  }

  const hasData = history.some(
    (e) => e.heartRate != null || e.steps != null || e.activeCalories != null || e.distanceKm != null
  );

  return (
    <div className="animate-fade-in flex flex-col cards-stack-desktop">
      <DashboardPageShell
        title="Health Data"
        subtitle="Wearable metrics synced from your device"
        icon={Activity}
        mobileVariant="card"
      />

      {/* Sync Now button */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '40ms' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {configured ? 'Endpoint configured' : (
              <>Not configured — <a href="/settings" className="text-accent-emerald underline underline-offset-2">set up in Settings</a></>
            )}
          </p>
          <button
            onClick={handleSync}
            disabled={syncing || !configured}
            title={!configured ? 'Configure a health data endpoint in Settings first' : 'Sync now'}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-primary transition-all hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {syncing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RotateCcw className="h-4 w-4" />}
            Sync Now
          </button>
        </div>
      </div>

      {/* Today's stat cards */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '80ms' }}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

          {/* Heart Rate */}
          <StatCard
            icon={HeartPulse}
            label="Heart Rate"
            value={today?.heartRate != null ? `${today.heartRate} bpm` : '—'}
            subtitle="Today"
            iconColor="text-accent-rose"
          />

          {/* Steps — with goal bar and streak */}
          <div className="dashboard-unified-card rounded-2xl border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted">Steps</p>
                <p className="mt-1 text-xl font-bold text-text-primary">
                  {today?.steps != null ? today.steps.toLocaleString() : '—'}
                </p>
              </div>
              <Footprints className="h-5 w-5 text-accent-emerald" />
            </div>
            {today?.steps != null && (
              <GoalBar value={today.steps} goal={stepGoal} color="bg-accent-emerald" />
            )}
            {today?.steps == null && (
              <p className="mt-1.5 text-[10px] text-text-muted">Goal: {stepGoal.toLocaleString()} steps</p>
            )}
            {stepsStreak > 0 && (
              <div className="mt-1.5 flex items-center gap-1">
                <Footprints className="h-3 w-3 text-accent-emerald" />
                <p className="text-[10px] font-medium text-accent-emerald">
                  {stepsStreak}d streak{stepsStreakBest > stepsStreak ? ` · best ${stepsStreakBest}d` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Active Calories — with goal bar */}
          <div className="dashboard-unified-card rounded-2xl border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted">Active Cal</p>
                <p className="mt-1 text-xl font-bold text-text-primary">
                  {today?.activeCalories != null ? `${today.activeCalories} kcal` : '—'}
                </p>
              </div>
              <Flame className="h-5 w-5 text-accent-amber" />
            </div>
            {today?.activeCalories != null && (
              <GoalBar value={today.activeCalories} goal={calBurnGoal} color="bg-accent-amber" />
            )}
            {today?.activeCalories == null && (
              <p className="mt-1.5 text-[10px] text-text-muted">Goal: {calBurnGoal} kcal</p>
            )}
          </div>

          {/* Distance — with goal bar */}
          <div className="dashboard-unified-card rounded-2xl border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted">Distance</p>
                <p className="mt-1 text-xl font-bold text-text-primary">
                  {today?.distanceKm != null ? `${today.distanceKm.toFixed(2)} km` : '—'}
                </p>
              </div>
              <MapPin className="h-5 w-5 text-accent-cyan" />
            </div>
            {today?.distanceKm != null && (
              <GoalBar value={today.distanceKm} goal={distanceGoal} color="bg-accent-cyan" />
            )}
            {today?.distanceKm == null && (
              <p className="mt-1.5 text-[10px] text-text-muted">Goal: {distanceGoal} km</p>
            )}
          </div>

        </div>
      </div>



      {/* Trend charts */}
      {hasData ? (
        <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
          <div className="mb-3 flex items-center justify-end gap-1.5">
            {[
              { key: 7, label: '7D' },
              { key: 14, label: '2W' },
              { key: 30, label: '1M' },
              { key: 90, label: '3M' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all ' +
                  (period === opt.key
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'bg-white/[0.02] text-text-muted hover:bg-white/[0.06]')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <HeartPulse className="h-4 w-4 text-accent-rose" />
                Heart Rate
              </h2>
              <MetricChart data={toChartData('heartRate')} color="#f43f5e" gradientId="hrGrad" unit=" bpm" height={200} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Footprints className="h-4 w-4 text-accent-emerald" />
                Steps
              </h2>
              <MetricChart data={toChartData('steps')} color="#10b981" gradientId="stepsGrad" unit=" steps" height={200}
                formatY={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Flame className="h-4 w-4 text-accent-amber" />
                Active Calories
              </h2>
              <MetricChart data={toChartData('activeCalories')} color="#f59e0b" gradientId="calGrad" unit=" kcal" height={200} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <MapPin className="h-4 w-4 text-accent-cyan" />
                Distance
              </h2>
              <MetricChart data={toChartData('distanceKm')} color="#06b6d4" gradientId="distGrad" unit=" km" height={200}
                formatY={(v) => v.toFixed(1)} />
            </div>

          </div>
        </div>
      ) : (
        <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
          <div className="dashboard-unified-card flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center">
            <Activity className="h-10 w-10 text-text-muted" />
            <p className="text-sm font-medium text-text-primary">No device data synced yet</p>
            <p className="max-w-xs text-xs leading-relaxed text-text-muted">
              {configured
                ? 'Hit "Sync Now" above to pull the latest data from your device.'
                : <>Configure your health data endpoint in <a href="/settings" className="text-accent-emerald underline underline-offset-2">Settings</a> to start syncing.</>}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
