'use client';

import { useState, useEffect } from 'react';
import { ProblemService, type Log } from '@/app/services/problemService';

// New component to handle recursive log rendering
function LogItem({ log }: { log: Log }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1 text-xs">
        <pre className="font-mono whitespace-pre-wrap">{log.message}</pre>
        {log.status === 'loading' && <span className="animate-spin">⚡</span>}
        {log.status === 'success' && <span className="text-green-500">✅</span>}
        {log.status === 'done' && <span className="text-green-500">✔️</span>}
        {log.status === 'error' && <span className="text-red-500">❌</span>}
      </div>
      {log.sub_tasks && log.sub_tasks.length > 0 && (
        <div className="ml-2 border-l border-gray-700 pl-2 space-y-1">
          {log.sub_tasks!.map((subLog, index) => (
            <div key={subLog.id} className="pb-1">
              <LogItem log={subLog} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestStats({ llmCount, computeCount }: { llmCount: number; computeCount: number }) {
  return (
    <div className="flex gap-2">
      <div className="flex items-center gap-1 text-xs bg-gray-800 rounded">
        <div className={`w-1.5 h-1.5 rounded-full ${llmCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span>{llmCount} LLM</span>
      </div>
      <div className="flex items-center gap-1 text-xs bg-gray-800 rounded">
        <div className={`w-1.5 h-1.5 rounded-full ${computeCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span>{computeCount} Computing</span>
      </div>
    </div>
  );
}

export default function ProblemColumn({ name }: { name: string }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeLLMRequests, setActiveLLMRequests] = useState(0);
  const [activeComputeRequests, setActiveComputeRequests] = useState(0);

  useEffect(() => {
    const handleRequestCount = (problem: string, llm_count: number, compute_count: number) => {
      if (problem === name) {
        setActiveLLMRequests(llm_count);
        setActiveComputeRequests(compute_count);
      }
    };
    ProblemService.addListener(handleRequestCount);
    return () => {
      ProblemService.removeListener(handleRequestCount);
    };
  }, [name]);

  const handleStart = async () => {
    try {
      await ProblemService.startProcess(name, (log) => {
        setLogs((prev) => {
          // Helper function to update nested logs
          const updateLogRecursively = (logs: Log[], newLog: Log): Log[] => {
            return logs.map((l) => {
              if (l.id === newLog.id) {
                return newLog;
              }
              if (l.sub_tasks?.length) {
                return {
                  ...l,
                  sub_tasks: updateLogRecursively(l.sub_tasks, newLog)
                };
              }
              return l;
            });
          };

          // Check if the log exists at any level
          const logExists = (logs: Log[], logId: number): boolean => {
            return logs.some((l) => 
              l.id === logId || 
              (l.sub_tasks?.length && logExists(l.sub_tasks, logId))
            );
          };

          if (logExists(prev, log.id)) {
            return updateLogRecursively(prev, log);
          }
          return [...prev, log];
        });
      });
    } catch (error) {
      console.error('Process failed:', error);
    }
  };

  return (
    <div className="flex-shrink-0 w-[400px] border border-gray-700 rounded-lg p-2 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold">{name}</h2>
          <div className="mt-1">
            <RequestStats llmCount={activeLLMRequests} computeCount={activeComputeRequests} />
          </div>
        </div>
        <button
          onClick={() => handleStart()}
          className="py-1 px-3 rounded text-sm bg-gradient-to-r from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-secondary))] hover:opacity-90 whitespace-nowrap"
        >
          Let's go!
        </button>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Press "Let's go!" to get started
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={log.id} className={index < logs.length - 1 ? 'border-b border-gray-800 pb-1' : ''}>
                  <LogItem log={log} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
