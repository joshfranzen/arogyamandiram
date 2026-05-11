'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Droplets,
  GlassWater,
  BarChart3,
} from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import WaterGlass from '@/components/water/WaterGlass';
import MetricChart from '@/components/ui/MetricChart';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/Toast';
import { useDailyLog } from '@/hooks/useDailyLog';
import { useUser } from '@/hooks/useUser';
import api from '@/lib/apiClient';
import { getTargetsForUser } from '@/lib/health';
import {
  cn,
  formatWater,
  calcPercent,
  getToday,
  formatDate,
} from '@/lib/utils';
import WaterCard from '@/components/ui/water-card';

type VesselProps = { className?: string };

const vesselStroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ShotGlass = ({ className }: VesselProps) => (
  <svg viewBox="0 0 24 24" className={className} {...vesselStroke}>
    <path d="M8.5 11 L9.6 18 H14.4 L15.5 11 Z" />
    <path d="M8.5 11 H15.5" />
    <path d="M8.85 13.3 L9.6 18 H14.4 L15.15 13.3 Z" fill="#4FC3F7" fillOpacity="0.55" stroke="none" />
  </svg>
);

const Tumbler = ({ className }: VesselProps) => (
  <svg viewBox="0 0 24 24" className={className} {...vesselStroke}>
    <path d="M7.5 6 L8.7 19 H15.3 L16.5 6 Z" />
    <path d="M7.5 6 H16.5" />
    <path d="M8.05 11.5 L8.7 19 H15.3 L15.95 11.5 Z" fill="#4FC3F7" fillOpacity="0.55" stroke="none" />
  </svg>
);

const TallGlass = ({ className }: VesselProps) => (
  <svg viewBox="0 0 24 24" className={className} {...vesselStroke}>
    <path d="M8 3 L8.9 21 H15.1 L16 3 Z" />
    <path d="M8 3 H16" />
    <path d="M8.32 9.5 L8.9 21 H15.1 L15.68 9.5 Z" fill="#4FC3F7" fillOpacity="0.55" stroke="none" />
  </svg>
);

const Bottle = ({ className }: VesselProps) => (
  <svg viewBox="0 0 24 24" className={className} {...vesselStroke}>
    <path d="M10 2.5 H14 V4.5 H10 Z" />
    <path d="M10.2 4.5 V7 Q10.2 8 9.4 8.8 L8.6 9.8 Q8 10.6 8 11.7 V20 Q8 21.5 9.5 21.5 H14.5 Q16 21.5 16 20 V11.7 Q16 10.6 15.4 9.8 L14.6 8.8 Q13.8 8 13.8 7 V4.5" />
    <path d="M8.2 13 V20 Q8.2 21.3 9.5 21.3 H14.5 Q15.8 21.3 15.8 20 V13 Z" fill="#4FC3F7" fillOpacity="0.55" stroke="none" />
  </svg>
);

const DEFAULT_QUICK_AMOUNTS = [
  { label: '100 ml', value: 100, Icon: ShotGlass },
  { label: '250 ml', value: 250, Icon: Tumbler },
  { label: '500 ml', value: 500, Icon: TallGlass },
  { label: '750 ml', value: 750, Icon: Bottle },
] as const;

interface WaterEntry {
  date: string;
  waterIntake: number;
}

const periodOptions = [
  { key: 7, label: '7D' },
  { key: 14, label: '2W' },
  { key: 30, label: '1M' },
  { key: 90, label: '3M' },
];

export default function WaterPage() {
  const { user, loading: userLoading } = useUser();
  const { log, loading: logLoading, refetch } = useDailyLog();

  const [adding, setAdding] = useState(false);
  const [animateWave, setAnimateWave] = useState(false);

  const [waterHistory, setWaterHistory] = useState<WaterEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [period, setPeriod] = useState(7);

  const today = getToday();
  const target = getTargetsForUser(user ?? undefined).dailyWater;
  const current = log?.waterIntake || 0;
  const percent = calcPercent(current, target);
  const remaining = Math.max(target - current, 0);
  const configuredQuickAmounts = user?.settings?.customizations?.water?.quickAmountsMl;
  const quickAmounts = Array.isArray(configuredQuickAmounts) && configuredQuickAmounts.length === 4
    ? DEFAULT_QUICK_AMOUNTS.map((item, index) => ({
        ...item,
        value: configuredQuickAmounts[index],
        label: `${configuredQuickAmounts[index]} ml`,
      }))
    : DEFAULT_QUICK_AMOUNTS;

  const fetchWaterHistory = useCallback(async (days: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.getWaterHistory(days);
      if (res.success && res.data) {
        const data = res.data as { history: WaterEntry[] };
        setWaterHistory(data.history || []);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaterHistory(period);
  }, [period, fetchWaterHistory]);

  // Trigger wave animation after adding
  useEffect(() => {
    if (animateWave) {
      const timer = setTimeout(() => setAnimateWave(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [animateWave]);

  const addWater = useCallback(async (amount: number) => {
    setAdding(true);
    try {
      const res = await api.addWater(today, amount);
      if (res.success) {
        setAnimateWave(true);
        showToast(`Added ${formatWater(amount)}`, 'success');
        refetch();
        fetchWaterHistory(period);
      } else {
        showToast(res.error || 'Failed to add water', 'error');
      }
    } catch {
      showToast('Failed to add water', 'error');
    } finally {
      setAdding(false);
    }
  }, [today, refetch, fetchWaterHistory, period]);

  const loading = userLoading || logLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardSkeleton className="h-96" />
          <CardSkeleton className="h-96" />
        </div>
      </div>
    );
  }

  // Glass size for display (standard 250ml glass; target is from user profile)
  const glassSize = 250;
  const glasses = Math.floor(current / glassSize);
  const targetGlasses = Math.ceil(target / glassSize);

  return (
    <div className="water-page animate-fade-in flex flex-col max-lg:mobile-dash cards-stack-desktop">
      <DashboardPageShell
        title="Water Tracker"
        subtitle="Stay hydrated and maintain your daily flow"
        icon={Droplets}
        mobileVariant="card"
      />

      <div className="water-page-cards mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '80ms' }}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
          {/* Left half: Beaker / Water Visualization */}
          <WaterCard className="flex h-full min-h-[420px] flex-col items-center justify-center p-6">
            <div className="mb-6">
              <WaterGlass
                percent={percent}
                isPouring={animateWave}
                amount={remaining > 0 ? Math.min(250, remaining) : 250}
              />
            </div>

            {/* Amount Display */}
            <div className="text-center">
              <p className="text-3xl font-semibold text-[#A3A3A3]">{formatWater(current)}</p>
              <p className="text-sm text-[#94A3B8]">of {formatWater(target)} goal</p>
              {remaining > 0 && (
                <p className="mt-1 text-xs text-[#94A3B8]">
                  {formatWater(remaining)} remaining
                </p>
              )}
              {percent >= 100 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1 text-xs font-medium text-[#A3A3A3]">
                  🎉 Daily goal reached!
                </div>
              )}
            </div>

            {/* Quick Add Buttons – visible gap between each button */}
            <div className="mt-6 grid w-full grid-cols-4 gap-3">
              {quickAmounts.map((amt) => {
                const Icon = amt.Icon;
                return (
                  <button
                    key={amt.value}
                    onClick={() => addWater(amt.value)}
                    disabled={adding}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.03] px-2 py-3 text-xs font-medium text-[#94A3B8] transition-all hover:bg-white/[0.08] hover:text-[#A3A3A3] active:scale-95 disabled:opacity-50"
                  >
                    <Icon className="h-7 w-7" />
                    <span>{amt.label}</span>
                  </button>
                );
              })}
            </div>

          </WaterCard>

        {/* Right half: Stats (15 glasses, 100% goal, 2.5L, 0ml), Glass Tracker, Recent Water */}
        <div className="flex min-h-[420px] flex-col justify-center space-y-3 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          {/* Glass Indicators – hide on mobile, keep on larger screens */}
          <WaterCard className="hidden p-5 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GlassWater className="h-4 w-4 text-[#4FC3F7]" />
                <h3 className="text-sm font-semibold text-[#A3A3A3]">Glass Tracker</h3>
              </div>
              <div className="flex items-baseline gap-1.5 text-xs">
                <span className="font-semibold text-[#A3A3A3]">{glasses}</span>
                <span className="text-[#94A3B8]">/ {targetGlasses} glasses</span>
                <span className="text-[#4FC3F7]">· {Math.round(percent)}%</span>
              </div>
            </div>

            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#4FC3F7] to-[#06b6d4] transition-all duration-500"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>

            <div className="flex flex-wrap justify-between gap-1.5">
              {Array.from({ length: targetGlasses }, (_, i) => {
                const filled = i < glasses;
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex h-9 flex-1 min-w-[28px] items-center justify-center rounded-lg text-[11px] font-medium transition-all duration-300',
                      filled
                        ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] ring-1 ring-[#4FC3F7]/30'
                        : 'bg-white/[0.03] text-[#94A3B8] ring-1 ring-white/[0.04]',
                    )}
                    style={{ transitionDelay: `${i * 30}ms` }}
                  >
                    {filled ? '💧' : i + 1}
                  </div>
                );
              })}
            </div>
          </WaterCard>

          {/* Recent Water */}
          <WaterCard className="flex min-h-0 flex-1 flex-col p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#A3A3A3]">
              <GlassWater className="h-4 w-4 text-[#A3A3A3]" />
              Recent Water
            </h3>
            {historyLoading ? (
              <div className="flex flex-1 items-center justify-center text-xs text-[#94A3B8]">
                Loading history...
              </div>
            ) : waterHistory.length === 0 ? (
              <p className="py-4 text-xs text-[#94A3B8]">No water entries yet</p>
            ) : (
              <div className="hide-scrollbar w-full min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {waterHistory
                  .slice(-7)
                  .reverse()
                  .map((entry) => {
                    const dayGlasses = Math.floor(entry.waterIntake / glassSize);
                    return (
                      <div
                        key={entry.date}
                        className="flex items-center justify-between rounded-xl bg-[#0B1015] px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#A3A3A3]">
                            {formatWater(entry.waterIntake)}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {dayGlasses} glass{dayGlasses === 1 ? '' : 'es'}
                          </p>
                        </div>
                        <span className="text-[11px] text-[#94A3B8]">
                          {formatDate(entry.date)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </WaterCard>
        </div>
        </div>
      </div>

      {/* Water Intake History Chart – hide on mobile, show on larger screens */}
      <div className="mobile-fade-up mobile-dash-px lg:px-0" style={{ animationDelay: '160ms' }}>
      <WaterCard className="hidden p-6 lg:block">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#A3A3A3]" />
            <h2 className="text-base font-semibold text-[#A3A3A3]">Daily Water Intake</h2>
          </div>
          <div className="flex gap-1.5">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  period === opt.key
                    ? 'bg-white/[0.08] text-[#A3A3A3] ring-1 ring-white/20'
                    : 'bg-white/[0.02] text-[#94A3B8] hover:bg-white/[0.06]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="flex h-56 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4FC3F7] border-t-transparent" />
          </div>
        ) : (
          <>
            <MetricChart
              data={waterHistory.map((e) => ({
                date: e.date,
                value: e.waterIntake,
              }))}
              color="#38bdf8"
              gradientId="waterGrad"
              gradientFrom="#1e293b"
              gradientTo="#020617"
              unit=" ml"
              height={240}
              targetValue={target}
              targetLabel={`Goal: ${formatWater(target)}`}
              formatY={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${v}ml`)}
            />
            {waterHistory.length > 0 && (() => {
              const avg = Math.round(
                waterHistory.reduce((s, e) => s + e.waterIntake, 0) / waterHistory.length
              );
              const daysMetGoal = waterHistory.filter((e) => e.waterIntake >= target).length;
              const best = Math.max(...waterHistory.map((e) => e.waterIntake));
              return (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#0B1015] p-3 text-center shadow-lg">
                    <p className="text-lg font-semibold text-[#A3A3A3]">{formatWater(avg)}</p>
                    <p className="text-[11px] text-[#94A3B8]">Daily Average</p>
                  </div>
                  <div className="rounded-xl bg-[#0B1015] p-3 text-center shadow-lg">
                    <p className="text-lg font-semibold text-[#A3A3A3]">{`${daysMetGoal}/${waterHistory.length}`}</p>
                    <p className="text-[11px] text-[#94A3B8]">Days Goal Met</p>
                  </div>
                  <div className="rounded-xl bg-[#0B1015] p-3 text-center shadow-lg">
                    <p className="text-lg font-semibold text-[#A3A3A3]">{formatWater(best)}</p>
                    <p className="text-[11px] text-[#94A3B8]">Best Day</p>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </WaterCard>
      </div>
    </div>
  );
}
