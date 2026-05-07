'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, HeartPulse, Footprints, Flame, MapPin,
  RotateCcw, Loader2, TrendingUp, TrendingDown,
} from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import MetricChart from '@/components/ui/MetricChart';
import ActivityRings from '@/components/ui/ActivityRings';
import Sparkline from '@/components/ui/Sparkline';
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

type MetricKey = 'heartRate' | 'steps' | 'activeCalories' | 'distanceKm';

interface SummaryCardProps {
  Icon: typeof Activity;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  valueColor?: string;
  iconBg: string;
  iconColor: string;
  spark?: { data: number[]; color: string };
  delta?: { value: number; goodDirection: 'up' | 'down' } | null;
}

function SummaryCard({
  Icon, label, value, unit, sub, valueColor = 'text-text-primary', iconBg, iconColor, spark, delta,
}: SummaryCardProps) {
  let deltaPositive: boolean | null = null;
  if (delta) {
    const isUp = delta.value >= 0;
    deltaPositive = delta.goodDirection === 'up' ? isUp : !isUp;
  }
  return (
    <div className="dashboard-unified-card flex flex-col justify-between rounded-2xl border p-5">
      <div>
        <div className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}>
            <Icon className="h-4 w-4" />
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <p className={`text-3xl font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
          {unit && <p className="text-xs font-medium text-text-muted">{unit}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {(spark || delta) && (
          <div className="flex items-center justify-between gap-2">
            {spark && spark.data.length >= 2 ? (
              <Sparkline data={spark.data} color={spark.color} width={96} height={26} />
            ) : <span />}
            {delta && (
              <span
                className={
                  'inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ' +
                  (deltaPositive
                    ? 'bg-accent-emerald/10 text-accent-emerald'
                    : 'bg-accent-rose/10 text-accent-rose')
                }
              >
                {delta.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(delta.value).toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function computeDelta(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const fAvg = first.reduce((s, v) => s + v, 0) / first.length;
  const sAvg = second.reduce((s, v) => s + v, 0) / second.length;
  if (fAvg === 0) return null;
  return ((sAvg - fAvg) / fAvg) * 100;
}

interface ChartCardProps {
  title: string;
  Icon: typeof Activity;
  data: { date: string; value: number }[];
  color: string;
  gradFrom: string;
  gradTo: string;
  glow: string;
  unit: string;
  formatY?: (v: number) => string;
  formatStat?: (v: number) => string;
  gradientId: string;
}

function ChartCard({
  title, Icon, data, color, gradFrom, gradTo, glow, unit, formatY, formatStat, gradientId,
}: ChartCardProps) {
  // In-period stats: avg/max + first-half vs second-half trend
  const { avg, max, delta } = useMemo(() => {
    if (data.length === 0) return { avg: 0, max: 0, delta: 0 };
    const values = data.map((d) => d.value);
    const a = values.reduce((s, v) => s + v, 0) / values.length;
    const m = Math.max(...values);
    if (values.length < 4) return { avg: a, max: m, delta: 0 };
    const mid = Math.floor(values.length / 2);
    const first = values.slice(0, mid);
    const second = values.slice(mid);
    const fAvg = first.reduce((s, v) => s + v, 0) / first.length;
    const sAvg = second.reduce((s, v) => s + v, 0) / second.length;
    const d = fAvg === 0 ? 0 : ((sAvg - fAvg) / fAvg) * 100;
    return { avg: a, max: m, delta: d };
  }, [data]);

  const fmt = formatStat ?? ((v: number) => `${v.toFixed(0)}${unit}`);
  const deltaUp = delta >= 0;
  const showDelta = data.length >= 4;

  return (
    <div className="dashboard-unified-card relative overflow-hidden rounded-2xl border p-5">
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${gradFrom}33, ${gradTo}14)`,
              color: gradTo,
              boxShadow: `0 0 16px -6px ${glow}`,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>

        {data.length > 0 && (
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-text-muted">Avg</p>
              <p className="text-xs font-semibold tabular-nums text-text-primary">{fmt(avg)}</p>
            </div>
            <div className="hidden h-6 w-px bg-white/[0.06] sm:block" />
            <div className="hidden sm:block">
              <p className="text-[9px] uppercase tracking-wider text-text-muted">Max</p>
              <p className="text-xs font-semibold tabular-nums text-text-primary">{fmt(max)}</p>
            </div>
            {showDelta && (
              <>
                <div className="hidden h-6 w-px bg-white/[0.06] sm:block" />
                <div
                  className={
                    'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ' +
                    (deltaUp
                      ? 'bg-accent-emerald/10 text-accent-emerald'
                      : 'bg-accent-rose/10 text-accent-rose')
                  }
                >
                  {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(delta).toFixed(0)}%
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative mt-3">
        <MetricChart
          data={data}
          color={color}
          gradientFrom={gradFrom}
          gradientTo={gradTo}
          gradientId={gradientId}
          unit={unit}
          height={200}
          formatY={formatY}
        />
      </div>
    </div>
  );
}


export default function HealthDataPage() {
  const { user } = useUser();
  const { achievements } = useAchievements();
  const targets: Partial<UserTargets> = (user?.targets as Partial<UserTargets>) ?? {};
  const stepsStreak = achievements?.streaks?.current?.steps ?? 0;

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

  const toChartData = (field: MetricKey) =>
    history
      .filter((e) => e[field] != null)
      .map((e) => ({ date: e.date, value: e[field] as number }));

  const sparkValues = (field: MetricKey) =>
    history.filter((e) => e[field] != null).map((e) => e[field] as number);

  const stepGoal     = targets.dailySteps     ?? 8000;
  const calBurnGoal  = targets.dailyCalorieBurn ?? 400;
  const distanceGoal = targets.idealDistance   ?? 5;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10" />
        <CardSkeleton className="h-[280px]" />
        <CardSkeleton className="h-12" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} className="h-[260px]" />)}
        </div>
      </div>
    );
  }

  const hasData = history.some(
    (e) => e.heartRate != null || e.steps != null || e.activeCalories != null || e.distanceKm != null
  );

  const hrSpark    = sparkValues('heartRate').slice(-7);
  const stepsSpark = sparkValues('steps').slice(-7);
  const calSpark   = sparkValues('activeCalories').slice(-7);
  const distSpark  = sparkValues('distanceKm').slice(-7);

  const hrLatest = today?.heartRate ?? hrSpark[hrSpark.length - 1] ?? null;
  const hrAvg7 = hrSpark.length > 0 ? hrSpark.reduce((s, v) => s + v, 0) / hrSpark.length : null;
  const hrDelta = hrLatest != null && hrAvg7 != null && hrAvg7 > 0
    ? ((hrLatest - hrAvg7) / hrAvg7) * 100
    : null;

  const stepsDelta = computeDelta(stepsSpark);
  const calDelta   = computeDelta(calSpark);
  const distDelta  = computeDelta(distSpark);

  return (
    <div className="animate-fade-in flex flex-col cards-stack-desktop">
      <DashboardPageShell
        title="Health Data"
        subtitle="Wearable metrics synced from your device"
        icon={Activity}
        mobileVariant="card"
        rightDesktop={
          <>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={
                    'absolute inline-flex h-full w-full rounded-full opacity-75 ' +
                    (configured ? 'animate-ping bg-accent-emerald' : 'bg-text-muted')
                  }
                />
                <span
                  className={
                    'relative inline-flex h-2 w-2 rounded-full ' +
                    (configured ? 'bg-accent-emerald' : 'bg-text-muted')
                  }
                />
              </span>
              <p className="text-xs text-text-muted">
                {configured ? (
                  <>Endpoint live · {history.length} day{history.length !== 1 ? 's' : ''}</>
                ) : (
                  <>Not configured — <a href="/settings" className="text-accent-emerald underline underline-offset-2">set up</a></>
                )}
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || !configured}
              title={!configured ? 'Configure a health data endpoint in Settings first' : 'Sync now'}
              className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3.5 py-1.5 text-sm font-medium text-text-primary transition-all hover:border-accent-emerald/30 hover:bg-accent-emerald/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {syncing
                ? <Loader2 className="h-4 w-4 animate-spin text-accent-emerald" />
                : <RotateCcw className="h-4 w-4 transition-transform group-hover:-rotate-180 group-hover:text-accent-emerald" />}
              Sync Now
            </button>
          </>
        }
      />

      {/* Top row: 5 cards — Rings, Steps, Active Cal, Distance, Heart Rate */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '40ms' }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

          {/* Rings card — full width on mobile, spans 2 cols on tablet, 1 col on desktop */}
          <div className="dashboard-unified-card flex items-center justify-center rounded-2xl border p-5 sm:col-span-2 lg:col-span-1">
            <ActivityRings
              steps={today?.steps ?? null}
              stepsGoal={stepGoal}
              calories={today?.activeCalories ?? null}
              caloriesGoal={calBurnGoal}
              distanceKm={today?.distanceKm ?? null}
              distanceGoal={distanceGoal}
              size={170}
            />
          </div>

          {/* Steps */}
          <SummaryCard
            Icon={Footprints}
            label="Steps"
            value={today?.steps != null ? today.steps.toLocaleString() : '—'}
            sub={
              stepsStreak > 0
                ? `${stepsStreak}d streak · ${stepGoal.toLocaleString()} goal`
                : today?.steps != null
                  ? `${Math.min(100, Math.round((today.steps / stepGoal) * 100))}% of ${stepGoal.toLocaleString()} goal`
                  : `${stepGoal.toLocaleString()} goal`
            }
            iconBg="bg-accent-emerald/15"
            iconColor="text-accent-emerald"
            spark={{ data: stepsSpark, color: '#10b981' }}
            delta={stepsDelta != null ? { value: stepsDelta, goodDirection: 'up' } : null}
          />

          {/* Active Cal */}
          <SummaryCard
            Icon={Flame}
            label="Active Cal"
            value={today?.activeCalories != null ? String(today.activeCalories) : '—'}
            unit={today?.activeCalories != null ? 'kcal' : ''}
            sub={today?.activeCalories != null
              ? `${Math.min(100, Math.round((today.activeCalories / calBurnGoal) * 100))}% of ${calBurnGoal} kcal goal`
              : `${calBurnGoal} kcal goal`}
            iconBg="bg-accent-amber/15"
            iconColor="text-accent-amber"
            spark={{ data: calSpark, color: '#f59e0b' }}
            delta={calDelta != null ? { value: calDelta, goodDirection: 'up' } : null}
          />

          {/* Distance */}
          <SummaryCard
            Icon={MapPin}
            label="Distance"
            value={today?.distanceKm != null ? today.distanceKm.toFixed(2) : '—'}
            unit={today?.distanceKm != null ? 'km' : ''}
            sub={today?.distanceKm != null
              ? `${Math.min(100, Math.round((today.distanceKm / distanceGoal) * 100))}% of ${distanceGoal.toFixed(2)} km goal`
              : `${distanceGoal.toFixed(2)} km goal`}
            iconBg="bg-accent-cyan/15"
            iconColor="text-accent-cyan"
            spark={{ data: distSpark, color: '#06b6d4' }}
            delta={distDelta != null ? { value: distDelta, goodDirection: 'up' } : null}
          />

          {/* Heart Rate */}
          <SummaryCard
            Icon={HeartPulse}
            label="Heart Rate"
            value={hrLatest != null ? String(Math.round(hrLatest)) : '—'}
            unit={hrLatest != null ? 'bpm' : ''}
            valueColor="text-accent-rose"
            iconBg="bg-accent-rose/15"
            iconColor="text-accent-rose"
            spark={{ data: hrSpark, color: '#f43f5e' }}
            delta={hrDelta != null ? { value: hrDelta, goodDirection: 'down' } : null}
            sub={hrAvg7 != null ? `7-day avg ${Math.round(hrAvg7)} bpm` : undefined}
          />

        </div>
      </div>

      {/* Trend charts */}
      {hasData ? (
        <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
          {/* Period selector */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">Trends</h2>
            <div className="inline-flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-0.5">
              {[
                { key: 7,  label: '7D' },
                { key: 14, label: '2W' },
                { key: 30, label: '1M' },
                { key: 90, label: '3M' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPeriod(opt.key)}
                  className={
                    'relative rounded-lg px-3 py-1 text-[11px] font-semibold transition-all ' +
                    (period === opt.key
                      ? 'bg-white/[0.10] text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                      : 'text-text-muted hover:text-text-primary')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ChartCard
              title="Heart Rate"
              Icon={HeartPulse}
              data={toChartData('heartRate')}
              color="#f43f5e"
              gradFrom="#fb7185"
              gradTo="#f43f5e"
              glow="rgba(244,63,94,0.45)"
              unit=" bpm"
              gradientId="hrGrad"
              formatStat={(v) => `${Math.round(v)} bpm`}
            />

            <ChartCard
              title="Steps"
              Icon={Footprints}
              data={toChartData('steps')}
              color="#10b981"
              gradFrom="#34d399"
              gradTo="#10b981"
              glow="rgba(52,211,153,0.45)"
              unit=" steps"
              gradientId="stepsGrad"
              formatY={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              formatStat={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`}
            />

            <ChartCard
              title="Active Calories"
              Icon={Flame}
              data={toChartData('activeCalories')}
              color="#f59e0b"
              gradFrom="#fbbf24"
              gradTo="#f59e0b"
              glow="rgba(245,158,11,0.45)"
              unit=" kcal"
              gradientId="calGrad"
              formatStat={(v) => `${Math.round(v)} kcal`}
            />

            <ChartCard
              title="Distance"
              Icon={MapPin}
              data={toChartData('distanceKm')}
              color="#06b6d4"
              gradFrom="#22d3ee"
              gradTo="#06b6d4"
              glow="rgba(6,182,212,0.45)"
              unit=" km"
              gradientId="distGrad"
              formatY={(v) => v.toFixed(1)}
              formatStat={(v) => `${v.toFixed(2)} km`}
            />
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
