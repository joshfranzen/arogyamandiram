'use client';

import { useState } from 'react';
import { Check, X, Dumbbell, Flame } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { ParsedWorkoutItem } from '@/contexts/OrchestratorSidebarContext';

interface ConfirmWorkoutItemsProps {
  items: ParsedWorkoutItem[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmWorkoutItems({ items, onConfirm, onCancel }: ConfirmWorkoutItemsProps) {
  const [loading, setLoading] = useState(false);

  const totalCalories = items.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const totalDuration = items.reduce((sum, w) => sum + (w.duration || 0), 0);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm">
      {/* Items list */}
      <div className="mb-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Dumbbell className="h-3 w-3 shrink-0 text-rose-400/60" />
                <span className="truncate text-neutral-300 text-xs font-medium">{item.exercise}</span>
              </div>
              <span className="shrink-0 text-[11px] text-neutral-500 capitalize">{item.category}</span>
            </div>
            <div className="ml-4.5 flex gap-3 text-[11px] text-neutral-500">
              {item.duration > 0 && <span>{formatDuration(item.duration)}</span>}
              {item.sets && item.reps && <span>{item.sets}×{item.reps}</span>}
              {item.weight && <span>{item.weight} kg</span>}
              {item.caloriesBurned > 0 && (
                <span className="flex items-center gap-0.5 text-rose-400/70">
                  <Flame className="h-2.5 w-2.5" />{item.caloriesBurned} cal
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mb-3 flex items-center justify-between rounded-lg bg-rose-500/5 px-3 py-2 border border-rose-500/10">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span>{items.length} exercise{items.length !== 1 ? 's' : ''}</span>
          {totalDuration > 0 && <span>· {formatDuration(totalDuration)}</span>}
        </div>
        {totalCalories > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-rose-400">
            <Flame className="h-3 w-3" />{totalCalories} cal
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => void handleConfirm()}
          disabled={loading}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors',
            'bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25',
            loading && 'opacity-60'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {loading ? 'Logging...' : 'Log These'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs text-neutral-500 border border-neutral-800 hover:text-neutral-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
