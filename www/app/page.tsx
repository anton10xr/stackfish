'use client';

import { useEffect, useState } from 'react';
import ProblemColumn from '@/components/ProblemColumn';
import Image from 'next/image';
import { ProblemService } from './services/problemService';

export default function Home() {
  const [problems, setProblems] = useState<string[]>([]);
  const [problemRequests, setProblemRequests] = useState<Record<string, { llm: number; compute: number }>>({});

  useEffect(() => {
    const fetchProblems = async () => {
      const response = await fetch('/api/problems');
      const data = await response.json();
      setProblems(data.problems);
    };

    fetchProblems();

    // Set up request counter listener
    const handleRequestCount = (problem: string, llm_count: number, compute_count: number) => {
      setProblemRequests(prev => ({
        ...prev,
        [problem]: { llm: llm_count, compute: compute_count }
      }));
    };
    ProblemService.addListener(handleRequestCount);

    return () => {
      ProblemService.removeListener(handleRequestCount);
    };
  }, []);

  // Calculate totals
  const totalLLM = Object.values(problemRequests).reduce((sum, curr) => sum + curr.llm, 0);
  const totalCompute = Object.values(problemRequests).reduce((sum, curr) => sum + curr.compute, 0);

  return (
    <main className="h-screen flex flex-col">
      <div className="flex flex-col items-start gap-4 p-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col ml-[20px]">
            <span className="text-3xl font-bold bg-gradient-to-r from-[rgb(var(--accent-primary))] to-[rgb(var(--accent-secondary))] bg-clip-text text-transparent">
              🐟 STACKFISH
            </span>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${totalLLM > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-xs font-medium">
                {totalLLM} Concurrent LLM requests
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${totalCompute > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-xs font-medium">
                {totalCompute} Concurrent compute requests
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-6 overflow-x-auto p-8 pt-0 flex-1">
        {problems.map((problem) => (
          <ProblemColumn key={problem} name={problem} />
        ))}
      </div>
    </main>
  );
}
