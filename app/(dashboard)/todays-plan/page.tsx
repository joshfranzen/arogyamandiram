'use client';

import { useState } from 'react';
import { CalendarDays, Dumbbell, Flame, Zap } from 'lucide-react';
import DashboardPageShell from '@/components/layout/DashboardPageShell';
import { cn } from '@/lib/utils';
import OverviewTab from './OverviewTab';
import FoodTab from './FoodTab';
import WorkoutTab from './WorkoutTab';

type Tab = 'overview' | 'food' | 'workout';

export default function TodaysPlanPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <DashboardPageShell title="Today's Plan" subtitle="Your personalized daily health plan" icon={CalendarDays}>
      <div className="space-y-4">

        <div className="mt-4 mobile-fade-up mobile-dash-px lg:px-0">
          <div className="flex gap-2">
            {([
              { key: 'overview', label: 'Overview', icon: Zap },
              { key: 'food',     label: 'Food',     icon: Flame },
              { key: 'workout',  label: 'Workout',  icon: Dumbbell },
            ] as const).map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-900/50 text-zinc-400 border border-transparent hover:bg-zinc-800 hover:text-zinc-300'
                )}>
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-4 mobile-fade-up mobile-dash-px lg:px-0">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'food'     && <FoodTab />}
          {activeTab === 'workout'  && <WorkoutTab />}
        </div>

      </div>
    </DashboardPageShell>
  );
}
