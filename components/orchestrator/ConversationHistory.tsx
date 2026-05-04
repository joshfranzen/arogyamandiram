'use client';

import { useEffect, useRef } from 'react';
import type { ConversationEntry } from '@/contexts/OrchestratorSidebarContext';
import MessageBubble from './MessageBubble';

interface ConversationHistoryProps {
  entries: ConversationEntry[];
  onConfirmSimple: (id: string) => Promise<string | undefined>;
  onConfirmFood: (id: string, mealType: string) => Promise<string | undefined>;
  onConfirmWorkout: (id: string) => Promise<string | undefined>;
  onCancel: (id: string) => void;
  onConfirmSuccess?: (route: string) => void;
}

export default function ConversationHistory({
  entries,
  onConfirmSimple,
  onConfirmFood,
  onConfirmWorkout,
  onCancel,
  onConfirmSuccess,
}: ConversationHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length, entries[entries.length - 1]?.status]);

  if (entries.length === 0) {
    return <div className="flex-1" />;
  }

  return (
    <div className="hide-scrollbar flex-1 overflow-y-auto">
      <div className="flex flex-col pb-2">
        {entries.map((entry) => (
          <MessageBubble
            key={entry.id}
            entry={entry}
            onConfirmSimple={async () => {
              const route = await onConfirmSimple(entry.id);
              if (route) onConfirmSuccess?.(route);
            }}
            onConfirmFood={async (mealType) => {
              const route = await onConfirmFood(entry.id, mealType);
              if (route) onConfirmSuccess?.(route);
            }}
            onConfirmWorkout={async () => {
              const route = await onConfirmWorkout(entry.id);
              if (route) onConfirmSuccess?.(route);
            }}
            onCancel={() => onCancel(entry.id)}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
