'use client';

import { useEffect, useRef } from 'react';
import type { ConversationEntry } from '@/contexts/OrchestratorSidebarContext';
import MessageBubble from './MessageBubble';

interface ConversationHistoryProps {
  entries: ConversationEntry[];
  onConfirmSimple: (id: string) => Promise<void>;
  onConfirmFood: (id: string, mealType: string) => Promise<void>;
  onConfirmWorkout: (id: string) => Promise<void>;
  onCancel: (id: string) => void;
}

export default function ConversationHistory({
  entries,
  onConfirmSimple,
  onConfirmFood,
  onConfirmWorkout,
  onCancel,
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
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col pb-2">
        {entries.map((entry) => (
          <MessageBubble
            key={entry.id}
            entry={entry}
            onConfirmSimple={() => onConfirmSimple(entry.id)}
            onConfirmFood={(mealType) => onConfirmFood(entry.id, mealType)}
            onConfirmWorkout={() => onConfirmWorkout(entry.id)}
            onCancel={() => onCancel(entry.id)}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
