'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { useDebugLogs } from '@/contexts/DebugLogsContext';
import InspectorLogEntry from './InspectorLogEntry';

export default function InspectorPanel() {
  const [open, setOpen] = useState(false);
  const { orchestratorLogs } = useDebugLogs();

  return (
    <div className="border-t border-neutral-800/60 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="h-3.5 w-3.5 text-neutral-600" />
          <span className="text-[11px] font-medium text-neutral-500">
            AI Inspector
            {orchestratorLogs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                {orchestratorLogs.length}
              </span>
            )}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-neutral-600" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-neutral-600" />
        )}
      </button>

      {open && (
        <div className="max-h-60 overflow-y-auto border-t border-neutral-800/60">
          {orchestratorLogs.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-neutral-600">
              No AI calls yet. Tool calls will appear here.
            </p>
          ) : (
            orchestratorLogs.map((log) => (
              <InspectorLogEntry key={log.id} log={log} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
