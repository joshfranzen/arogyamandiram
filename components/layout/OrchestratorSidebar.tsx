'use client';

import { X, Sparkles } from 'lucide-react';
import { useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useOrchestratorSidebar } from '@/contexts/OrchestratorSidebarContext';
import CommandInput from '@/components/orchestrator/CommandInput';
import ConversationHistory from '@/components/orchestrator/ConversationHistory';

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

export default function OrchestratorSidebar() {
  const {
    isOpen,
    sidebarWidth,
    setSidebarWidth,
    closeSidebar,
    conversation,
    submitCommand,
    confirmSimpleEntry,
    confirmFoodEntry,
    confirmWorkoutEntry,
    cancelEntry,
  } = useOrchestratorSidebar();

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(sidebarWidth);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setSidebarWidth(next);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [setSidebarWidth]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[50] bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed right-0 top-0 z-[51] flex h-[100dvh] flex-col',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          'max-lg:w-full max-lg:max-w-[280px]'
        )}
        style={{
          width: `${sidebarWidth}px`,
          background: 'linear-gradient(160deg, #111712 0%, #0c1410 100%)',
        }}
      >
        {/* Drag handle — double-click resets to default 232px */}
        <div
          onMouseDown={onMouseDown}
          onDoubleClick={() => setSidebarWidth(232)}
          className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-emerald-500/10 transition-colors"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-semibold text-neutral-200">Health Assistant</span>
          </div>
          <button
            onClick={closeSidebar}
            className="flex h-7 w-7 items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
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
