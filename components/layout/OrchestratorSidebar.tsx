'use client';

import { X, Sparkles, Maximize2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useOrchestratorSidebar } from '@/contexts/OrchestratorSidebarContext';
import CommandInput from '@/components/orchestrator/CommandInput';
import ConversationHistory from '@/components/orchestrator/ConversationHistory';

export default function OrchestratorSidebar() {
  const {
    isOpen,
    sidebarWidth,
    closeSidebar,
    conversation,
    submitCommand,
    confirmSimpleEntry,
    confirmFoodEntry,
    confirmWorkoutEntry,
    cancelEntry,
  } = useOrchestratorSidebar();

  return (
    <>
      <aside
        className={cn(
          'fixed right-0 top-0 z-[51] flex h-[100dvh] flex-col',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          width: `${sidebarWidth}px`,
          background: 'linear-gradient(160deg, #111712 0%, #0c1410 100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-semibold text-neutral-200">Health Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/ai"
              className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-emerald-400 transition-colors"
              title="Open AI full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button
              onClick={closeSidebar}
              className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation */}
        <ConversationHistory
          entries={conversation}
          onConfirmSimple={confirmSimpleEntry}
          onConfirmFood={(id, mealType) => confirmFoodEntry(id, mealType)}
          onConfirmWorkout={confirmWorkoutEntry}
          onCancel={cancelEntry}
        />

        {/* Command input */}
        <CommandInput open={isOpen} onSubmit={(text, imageBase64, imageMimeType) => submitCommand(text, imageBase64, imageMimeType)} />
      </aside>
    </>
  );
}
