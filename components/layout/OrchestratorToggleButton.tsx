'use client';

import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrchestratorSidebar } from '@/contexts/OrchestratorSidebarContext';

export default function OrchestratorToggleButton() {
  const { isOpen, sidebarWidth, toggleSidebar } = useOrchestratorSidebar();

  return (
    <button
      onClick={toggleSidebar}
      aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
      style={isOpen ? { right: `${sidebarWidth}px` } : undefined}
      className={cn(
        'fixed top-1/2 -translate-y-1/2 z-50',
        'transition-[right] duration-300 ease-in-out',
        !isOpen && 'right-0',
        'flex items-center gap-1.5 rounded-l-xl px-3 py-2.5',
        'bg-neutral-900',
        'hover:bg-neutral-800 transition-colors',
        'hidden lg:flex'
      )}
    >
      {isOpen ? (
        <X className="h-3.5 w-3.5 text-neutral-400" />
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400">AI</span>
        </>
      )}
    </button>
  );
}
