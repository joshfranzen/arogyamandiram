'use client';

import { useState } from 'react';
import { Check, X, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedFoodItem } from '@/contexts/OrchestratorSidebarContext';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

interface ConfirmFoodItemsProps {
  items: ParsedFoodItem[];
  total?: Record<string, number>;
  onConfirm: (mealType: string) => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmFoodItems({ items, total, onConfirm, onCancel }: ConfirmFoodItemsProps) {
  const [mealType, setMealType] = useState<MealType>(guessMealType());
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(mealType);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3 text-sm">
      {/* Items list */}
      <div className="mb-3 flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Utensils className="h-3 w-3 shrink-0 text-emerald-500/60" />
              <span className="truncate text-neutral-300 text-xs">
                {item.quantity} {item.unit} {item.name}
              </span>
            </div>
            <span className="shrink-0 text-[11px] text-neutral-500">{item.calories} cal</span>
          </div>
        ))}
      </div>

      {/* Total */}
      {total && total.calories !== undefined && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2 border border-emerald-500/10">
          <span className="text-xs text-neutral-400">Total</span>
          <span className="text-xs font-semibold text-emerald-400">{Math.round(total.calories)} cal</span>
        </div>
      )}

      {/* Meal type selector */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] text-neutral-500 uppercase tracking-wide">Meal type</p>
        <div className="flex gap-1.5 flex-wrap">
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setMealType(t)}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                mealType === t
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:text-neutral-400'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => void handleConfirm()}
          disabled={loading}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors',
            'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25',
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
