'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, HeartPulse, Footprints, Flame, MapPin, RotateCcw, Loader2 } from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import MetricChart from '@/components/ui/MetricChart';
import StatCard from '@/components/ui/StatCard';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/Toast';
import api from '@/lib/apiClient';

interface HealthMetricsEntry {
  date: string;
  heartRate?:      number;
  steps?:          number;
  activeCalories?: number;
  distanceKm?:     number;
}

export default function HealthDataPage() {
  const [history, setHistory]     = useState<HealthMetricsEntry[]>([]);
  const [today,   setToday]       = useState<HealthMetricsEntry | null>(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [configured, setConfigured] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getHealthMetricsHistory(7);
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

  useEffect(() => { void fetchMetrics(); }, [fetchMetrics]);

  useEffect(() => {
    window.addEventListener('orchestrator:log-updated', fetchMetrics);
    return () => window.removeEventListener('orchestrator:log-updated', fetchMetrics);
  }, [fetchMetrics]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.triggerHealthDataSync({ source: 'manual' });
      if (res.success && res.data) {
        const logged = res.data.syncActions.filter((a) => a.status === 'logged').length;
        showToast(`Synced — ${logged} field${logged !== 1 ? 's' : ''} updated`, 'success');
        await fetchMetrics();
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  // Only show charts when at least one metric field has real data
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
          <StatCard
            icon={HeartPulse}
            label="Heart Rate"
            value={today?.heartRate != null ? `${today.heartRate} bpm` : '—'}
            subtitle="Today"
            iconColor="text-accent-rose"
          />
          <StatCard
            icon={Footprints}
            label="Steps"
            value={today?.steps != null ? today.steps.toLocaleString() : '—'}
            subtitle="Today"
            iconColor="text-accent-emerald"
          />
          <StatCard
            icon={Flame}
            label="Active Cal"
            value={today?.activeCalories != null ? `${today.activeCalories} kcal` : '—'}
            subtitle="Today"
            iconColor="text-accent-amber"
          />
          <StatCard
            icon={MapPin}
            label="Distance"
            value={today?.distanceKm != null ? `${today.distanceKm.toFixed(2)} km` : '—'}
            subtitle="Today"
            iconColor="text-accent-cyan"
          />
        </div>
      </div>

      {/* 7-day trend charts */}
      {hasData ? (
        <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <HeartPulse className="h-4 w-4 text-accent-rose" />
                Heart Rate (7d)
              </h2>
              <MetricChart data={toChartData('heartRate')} color="#f43f5e" gradientId="hrGrad" unit=" bpm" height={200} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Footprints className="h-4 w-4 text-accent-emerald" />
                Steps (7d)
              </h2>
              <MetricChart data={toChartData('steps')} color="#10b981" gradientId="stepsGrad" unit=" steps" height={200}
                formatY={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Flame className="h-4 w-4 text-accent-amber" />
                Active Calories (7d)
              </h2>
              <MetricChart data={toChartData('activeCalories')} color="#f59e0b" gradientId="calGrad" unit=" kcal" height={200} />
            </div>

            <div className="dashboard-unified-card rounded-2xl border p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <MapPin className="h-4 w-4 text-accent-cyan" />
                Distance (7d)
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
