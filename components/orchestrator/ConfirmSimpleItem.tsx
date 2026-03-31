'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmSimpleItemProps {
  summary: string;
  accentColor?: string; // e.g. 'cyan' | 'amber' | 'violet'
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function ConfirmSimpleItem({
  summary,
  accentColor = 'cyan',
  onConfirm,
  onCancel,
}: ConfirmSimpleItemProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const colorMap: Record<string, { btn: string; bg: string }> = {
    cyan:   { btn: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/25',   bg: 'bg-cyan-500/5 border-cyan-500/10' },
    amber:  { btn: 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25', bg: 'bg-amber-500/5 border-amber-500/10' },
    violet: { btn: 'bg-violet-500/15 text-violet-400 border-violet-500/25 hover:bg-violet-500/25', bg: 'bg-violet-500/5 border-violet-500/10' },
  };
  const colors = colorMap[accentColor] ?? colorMap.cyan;

  return (
    <div className="mt-2 rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className={cn('mb-3 rounded-lg border px-3 py-2 text-xs text-neutral-300', colors.bg)}>
        {summary}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void handleConfirm()}
          disabled={loading}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium border transition-colors',
            colors.btn,
            loading && 'opacity-60'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {loading ? 'Logging...' : 'Log'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex items-center justify-center rounded-xl px-3 py-2 text-xs text-neutral-500 border border-neutral-800 hover:text-neutral-400 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
