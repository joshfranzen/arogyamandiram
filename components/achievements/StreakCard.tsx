'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakCardProps {
  label: string;
  current: number;
  best?: number;
  variant?: 'default' | 'water';
}

export function StreakCard({ label, current, best, variant = 'default' }: StreakCardProps) {
  const active = current > 0;
  const isWater = variant === 'water';
  const flameColor = isWater ? '#38bdf8' : '#f5d76e';

  return (
    <div
      className={cn(
        'flex h-full w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-all duration-200 sm:h-14 sm:gap-2 sm:p-2.5',
        isWater ? 'bg-sky-500/[0.08]' : 'bg-black/40'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 flex-none items-center justify-center rounded-lg',
          active
            ? 'bg-white/[0.08] text-text-primary'
            : 'bg-white/[0.04] text-text-muted opacity-60'
        )}
      >
        <Flame
          className="h-3.5 w-3.5"
          color={flameColor}
          fill={flameColor}
          strokeWidth={1.8}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium leading-tight text-text-muted">
          {label}
        </p>
        <p className="mt-0.5 text-[13px] font-semibold leading-tight text-text-primary">
          {current} day{current === 1 ? '' : 's'}
          {best != null && best > 0 && (
            <span className="ml-1 text-[10px] font-normal text-text-muted">· Best {best}d</span>
          )}
        </p>
      </div>
    </div>
  );
}

