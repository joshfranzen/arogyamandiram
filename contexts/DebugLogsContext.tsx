'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface OrchestratorLog {
  id: string;
  userInput: string;
  toolName: string;
  intentClassification: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    parsedTool: string;
  };
  toolCall: {
    endpoint: string;
    payload: unknown;
    responseStatus: number;
    responseBody: unknown;
  };
  metadata: {
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    latencyMs: number;
    timestamp: string;
    status: 'success' | 'error';
  };
}

interface DebugLogsState {
  /** All orchestrator logs (newest first, max 50). */
  orchestratorLogs: OrchestratorLog[];
}

interface DebugLogsContextValue extends DebugLogsState {
  /** Append a new orchestrator log. */
  addOrchestratorLog: (log: OrchestratorLog) => void;
}

const DebugLogsContext = createContext<DebugLogsContextValue | null>(null);

const MAX_ORCHESTRATOR_LOGS = 50;

export function DebugLogsProvider({ children }: { children: ReactNode }) {
  const [orchestratorLogs, setOrchestratorLogs] = useState<OrchestratorLog[]>([]);

  const addOrchestratorLog = useCallback((log: OrchestratorLog) => {
    setOrchestratorLogs((prev) => [log, ...prev].slice(0, MAX_ORCHESTRATOR_LOGS));
  }, []);

  const value: DebugLogsContextValue = {
    orchestratorLogs,
    addOrchestratorLog,
  };
  return (
    <DebugLogsContext.Provider value={value}>
      {children}
    </DebugLogsContext.Provider>
  );
}

export function useDebugLogs(): DebugLogsContextValue {
  const ctx = useContext(DebugLogsContext);
  if (!ctx) {
    return {
      orchestratorLogs: [],
      addOrchestratorLog: () => {},
    };
  }
  return ctx;
}
