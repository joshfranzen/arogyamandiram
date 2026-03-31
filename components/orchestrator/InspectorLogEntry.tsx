'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrchestratorLog } from '@/contexts/DebugLogsContext';

const TOOL_COLORS: Record<string, string> = {
  water:               'text-cyan-400 bg-cyan-500/10',
  weight:              'text-amber-400 bg-amber-500/10',
  sleep:               'text-violet-400 bg-violet-500/10',
  'food-ai-logger':    'text-emerald-400 bg-emerald-500/10',
  'meal-ideas':        'text-emerald-400 bg-emerald-500/10',
  'workout-ai-logger': 'text-rose-400 bg-rose-500/10',
  'workout-plan':      'text-rose-400 bg-rose-500/10',
  'custom-food':       'text-emerald-400 bg-emerald-500/10',
};

interface InspectorLogEntryProps {
  log: OrchestratorLog;
  defaultExpanded?: boolean;
}

export default function InspectorLogEntry({ log, defaultExpanded }: InspectorLogEntryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const toolColor = TOOL_COLORS[log.toolName] ?? 'text-neutral-400 bg-neutral-800';
  const tokens =
    (log.metadata.usage?.prompt_tokens ?? 0) +
    (log.metadata.usage?.completion_tokens ?? 0);

  const time = new Date(log.metadata.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="border-b border-neutral-800/60 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-neutral-600" />
        ) : (
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-neutral-600" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', toolColor)}>
              {log.toolName}
            </span>
            {tokens > 0 && (
              <span className="text-[10px] text-neutral-600">{tokens} tok</span>
            )}
            <span className="text-[10px] text-neutral-600">{log.metadata.latencyMs}ms</span>
            <span className="text-[10px] text-neutral-700 ml-auto">{time}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-neutral-500">{log.userInput}</p>
        </div>
      </button>

      {expanded && (
        <div className="bg-black/20 px-3 pb-3 pt-1 space-y-2">
          <Section label="System Prompt" value={log.intentClassification.systemPrompt} />
          <Section label="User Input" value={log.intentClassification.userPrompt} />
          <Section label="Raw Response" value={log.intentClassification.rawResponse} />
          <Section label="Tool Call Payload" value={JSON.stringify(log.toolCall.payload, null, 2)} />
          <Section
            label={`Tool Response (${log.toolCall.responseStatus})`}
            value={typeof log.toolCall.responseBody === 'string'
              ? log.toolCall.responseBody
              : JSON.stringify(log.toolCall.responseBody, null, 2)}
          />
        </div>
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-600">{label}</p>
      <pre className="whitespace-pre-wrap break-all rounded bg-neutral-950/60 px-2 py-1.5 text-[10px] text-neutral-500 max-h-32 overflow-y-auto">
        {value}
      </pre>
    </div>
  );
}
