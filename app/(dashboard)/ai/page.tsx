'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useOrchestratorSidebar } from '@/contexts/OrchestratorSidebarContext';
import ConversationHistory from '@/components/orchestrator/ConversationHistory';
import CommandInput from '@/components/orchestrator/CommandInput';

export default function AIPage() {
  const router = useRouter();
  const {
    conversation,
    submitCommand,
    confirmSimpleEntry,
    confirmFoodEntry,
    confirmWorkoutEntry,
    cancelEntry,
  } = useOrchestratorSidebar();

  const isEmpty = conversation.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-2rem)]">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 lg:py-4">
        <Sparkles className="h-4 w-4 text-emerald-400" />
        <h1 className="text-[18px] lg:text-[22px] font-semibold tracking-tight text-neutral-100">
          AI Health Assistant
        </h1>
      </div>

      {/* Conversation or empty state */}
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10">
            <Sparkles className="h-8 w-8 text-emerald-400/60" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-neutral-300">
              Ask me anything about your health
            </p>
            <p className="text-xs text-neutral-600 max-w-xs">
              Try: &ldquo;I drank 500ml of water&rdquo;, &ldquo;I slept 7 hours&rdquo;, or &ldquo;I ran 30 minutes&rdquo;
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {['Log water intake', 'Log a meal', 'Log workout', 'Log weight'].map((hint) => (
              <button
                key={hint}
                onClick={() => submitCommand(hint)}
                className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-400 hover:border-emerald-500/30 hover:text-neutral-200 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ConversationHistory
            entries={conversation}
            onConfirmSimple={confirmSimpleEntry}
            onConfirmFood={(id, mealType) => confirmFoodEntry(id, mealType)}
            onConfirmWorkout={confirmWorkoutEntry}
            onCancel={cancelEntry}
            onConfirmSuccess={(route) => router.push(route)}
          />
        </div>
      )}

      {/* Input pinned to bottom */}
      <div className="shrink-0">
        <CommandInput
          open={true}
          onSubmit={(text, imageBase64, imageMimeType) =>
            submitCommand(text, imageBase64, imageMimeType)
          }
        />
      </div>
    </div>
  );
}
