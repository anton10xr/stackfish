import { attackVectorCallsPerModel, directSolutionCallsPerModel, postAttackVectorSolutionCallsPerModel, postSyntheticTestCallsPerModel, syntheticTestCallsPerModel } from '../config/config';
import { Model } from '../types/models';
import { SyntheticTest } from '../types/tests';

type ApiEndpoint = 
  | 'runtime_error_recovery'
  | 'time_limit_recovery'
  | 'wrong_answer_recovery'
  | 'validate_solution'
  | 'write_solution'
  | 'get_attack_vector'
  | 'is_only_one_output_valid'
  | 'run_all_tests'
  | 'get_synthetic_tests';

const MAX_DEPTH = 4;

type ValidateResponse = {
  is_valid: boolean;
  is_time_limit_exceeded?: boolean;
  runtime_error?: string;
  wrong_answer?: string;
};

type RunQAResponse = {
  is_valid: boolean;
  is_time_limit_exceeded?: boolean;
  runtime_error?: string;
  wrong_answer?: string;
  improved_solution?: string;
};

type SolutionResponse = {
  solution?: string;
  success?: boolean;
};

type AttackVectorResponse = {
  attack_vector: string;
  tags: string[];
};

type SyntheticTestsResponse = {
  tests: SyntheticTest[];
};

type OneOutputValidResponse = {
  is_only_one_output_valid: boolean;
};

type RunAllTestsResponse = {
  success: boolean;
};

function generateId(): number {
  return Math.floor(Math.random() * 100000000);
}

export type Log = {
  id: number;
  depth: number;
  message: string;
  status: 'loading' | 'success' | 'error' | 'done';
  sub_tasks?: Log[];
};

export type ProcessResult = {
  is_only_one_output_valid: boolean;
  attack_vector?: string;
};

export class ProblemService {
  private static problemRequests: Record<string, { llm: number; compute: number }> = {};
  private static listeners: ((problem: string, llm_count: number, compute_count: number) => void)[] = [];
  private static checkIfOnlyOneOutputValidInProgress: Set<string> = new Set();

  static addListener(listener: (problem: string, llm_count: number, compute_count: number) => void) {
    this.listeners.push(listener);
  }

  static removeListener(listener: (problem: string, llm_count: number, compute_count: number) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private static updateActiveLLMRequests(delta: number, problem: string) {
    if (!this.problemRequests[problem]) {
      this.problemRequests[problem] = { llm: 0, compute: 0 };
    }
    this.problemRequests[problem].llm += delta;
    this.listeners.forEach(listener => {
      listener(problem, this.problemRequests[problem].llm, this.problemRequests[problem].compute);
    });
  }

  private static updateActiveComputeRequests(delta: number, problem: string) {
    if (!this.problemRequests[problem]) {
      this.problemRequests[problem] = { llm: 0, compute: 0 };
    }
    this.problemRequests[problem].compute += delta;
    this.listeners.forEach(listener => {
      listener(problem, this.problemRequests[problem].llm, this.problemRequests[problem].compute);
    });
  }

  private static isLLMRequest(endpoint: ApiEndpoint): boolean {
    return !['run_all_tests', 'validate_solution'].includes(endpoint);
  }

  private static isComputeRequest(endpoint: ApiEndpoint): boolean {
    return !this.isLLMRequest(endpoint);
  }

  private static async fetchApi<T>(
    endpoint: ApiEndpoint,
    problemName: string,
    model?: Model,
    postData?: Record<string, any>,
  ): Promise<T> {
    if (this.isLLMRequest(endpoint)) {
      this.updateActiveLLMRequests(1, problemName);
    }
    if (this.isComputeRequest(endpoint)) {
      this.updateActiveComputeRequests(1, problemName);
    }
    try {
      const baseUrl = `/api/${endpoint}?problem=${problemName}`;
      const url = model ? `${baseUrl}&model=${model}` : baseUrl;
      
      const options: RequestInit = {
        method: postData ? 'POST' : 'GET',
        headers: postData ? {
          'Content-Type': 'application/json'
        } : undefined,
        body: postData ? JSON.stringify(postData) : undefined
      };

      const response = await fetch(url, options);
      return response.json();
    } catch (error) {
      console.error('Error in fetchApi:', error);
      return {success: false, error: error} as T;
    } finally {
      if (this.isLLMRequest(endpoint)) {
        this.updateActiveLLMRequests(-1, problemName);
      }
      if (this.isComputeRequest(endpoint)) {
        this.updateActiveComputeRequests(-1, problemName);
      }
    }
  }

  private static async fetchProgressiveAPI<T>(
    endpoint: ApiEndpoint,
    problemName: string,
    model?: Model,
    postData?: Record<string, any>,
    onProgress?: (data: any) => void,
  ): Promise<void> {
    const baseUrl = `/api/${endpoint}?problem=${problemName}`;
    const url = model ? `${baseUrl}&model=${model}` : baseUrl;
    
    const options: RequestInit = {
      method: postData ? 'POST' : 'GET',
      headers: postData
        ? {
            'Content-Type': 'application/json',
          }
        : undefined,
      body: postData ? JSON.stringify(postData) : undefined,
    };

    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      console.log(error)
      onProgress?.({success: false})
      return;
    }

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let accumulatedData = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          accumulatedData += chunk;
          const lines = accumulatedData.split('\n');
          
          // Process all complete lines except the last one (could be incomplete)
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
              onProgress?.(line);
            }
          }
          accumulatedData = lines[lines.length - 1];
        }
      }
      // Process any remaining data
      if (accumulatedData.trim()) {
        onProgress?.(accumulatedData.trim());
      }
    } else {
      const data = await response.json();
      onProgress?.(data);
      return data;
    }
    
  }

  private static async checkIfOnlyOneOutputValid(problemName: string, onLogUpdate: (log: Log) => void): Promise<void> {
    if (this.checkIfOnlyOneOutputValidInProgress.has(problemName)) {
      return;
    }
    this.checkIfOnlyOneOutputValidInProgress.add(problemName);

    const log: Log = {
      id: generateId(),
      depth: 0,
      message: '🕵️ Checking if only one output is possible...',
      status: 'loading'
    };
    onLogUpdate(log);
    
    const result = await this.fetchApi<OneOutputValidResponse>('is_only_one_output_valid', problemName);

    log.status = 'done';
    const subLog: Log = {
      id: generateId(),
      depth: log.depth + 1,
      message: result.is_only_one_output_valid ? '1️⃣ Only one correct answer is possible' : '‼️ Multiple correct answers are possible',
      status: 'done'
    };
    log.sub_tasks = [subLog];
    onLogUpdate(log);
  }

  private static async getAttackVector(problemName: string, model: Model, parentLog: Log | null, onLogUpdate: (log: Log) => void, tests: SyntheticTest[] = []): Promise<void> {
    let log: Log = {
      id: generateId(),
      depth: 0,
      message: `🎯 Generating Hypothesis: ${model}`,
      status: 'loading'
    };
    onLogUpdate(log);
    if (parentLog) {
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), log]
      onLogUpdate(parentLog);
    }
    
    const result = await this.fetchApi<AttackVectorResponse>('get_attack_vector', problemName, model, {
      tests
    });

    Object.entries(postAttackVectorSolutionCallsPerModel).forEach(([model, count]) => {
      for (let i = 0; i < count; i++) {
        this.getSolution(problemName, model as Model, log, onLogUpdate, result.attack_vector, result.tags, tests)
      }
    });
    log.status = 'done';
    onLogUpdate(log);
  }

  private static async getSyntheticTests(problemName: string, model: Model, onLogUpdate: (log: Log) => void): Promise<void> {
    let log: Log = {
      id: generateId(),
      depth: 0,
      message: `🧪 Generating Synthetic Tests: ${model}`,
      status: 'loading'
    };
    onLogUpdate(log);
    
    const result = await this.fetchApi<SyntheticTestsResponse>('get_synthetic_tests', problemName, model);

    if (!result || !result.tests || result.tests.length === 0) {
      log.status = 'error';
      onLogUpdate(log);
      return;
    }
    log.status = 'done';

    Object.entries(postSyntheticTestCallsPerModel).forEach(([model, count]) => {
      for (let i = 0; i < count; i++) {
        this.getAttackVector(problemName, model as Model, log, onLogUpdate, result.tests);
        this.getSolution(problemName, model as Model, log, onLogUpdate, undefined, undefined, result.tests)
      }
    });
    onLogUpdate(log);
  }

  private static async getSolution(
    problemName: string, 
    model: Model, 
    parentLog: Log | null,
    onLogUpdate: (log: Log) => void,
    attack_vector?: string,
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    const log: Log = {
      id: generateId(),
      depth: 0,
      message: `🧠 Writing code: ${model}`,
      status: 'loading'
    }
    if (parentLog) {
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), log]
      onLogUpdate(parentLog);
    } else {
      onLogUpdate(log);
    }
    const result = await this.fetchApi<SolutionResponse>('write_solution', problemName, model, {
      attack_vector,
      tags,
      tests
    });

    log.status = result.solution ? 'done' : 'error';
    onLogUpdate(log);

    if (result.solution) {
      const validationLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '👀 Validating solution...',
        status: 'loading'
      };
      log.sub_tasks = [...(log.sub_tasks || []), validationLog]
      onLogUpdate(log);
      await this.validateSolution(problemName, model, result.solution, validationLog, log, onLogUpdate, attack_vector, tags, tests);
    }
  }

  private static async validateSolution(
    problemName: string,
    model: Model,
    solution: string,
    log: Log,
    parentLog: Log,
    onLogUpdate: (log: Log) => void,
    attack_vector?: string,
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    const timer = setTimeout(() => {
      if (parentLog.depth >= MAX_DEPTH) {
        return;
      }
      const taRecoveryLog: Log = {
        id: generateId(),
        depth: parentLog.depth + 1,
        message: '⏱️ Time limit recovery...',
        status: 'loading'
      }
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), taRecoveryLog]
      onLogUpdate(parentLog);
      this.timeLimitRecovery(problemName, model, solution, taRecoveryLog, parentLog, onLogUpdate, attack_vector, tags);
    }, 15000);
    let result;
    try {
      result = await this.fetchApi<ValidateResponse>('validate_solution', problemName, undefined, {
        solution,
        attack_vector,
        tags,
        tests
      });
    } finally {
      clearTimeout(timer);
    }

    log.status = 'done';

    const statusLog: Log = {
      id: generateId(),
      depth: log.depth + 1,
      message: result.is_valid ? '👌 Validation passed' : '😞 Validation failed',
      status: 'done'
    };
    log.sub_tasks = [...(log.sub_tasks || []), statusLog]
    onLogUpdate(log);

    if (result.is_valid) {
      const runAllTestsLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '🚀 Running full test suite...',
        status: 'loading'
      };
      log.sub_tasks = [...(log.sub_tasks || []), runAllTestsLog]
      onLogUpdate(log);
      this.runAllTests(problemName, model, solution, runAllTestsLog, parentLog, onLogUpdate, tests ? tests.length > 0 : false, attack_vector, tags, tests);
      return;
    }

    if (log.depth >= MAX_DEPTH) {
      const depthLimitLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '🤿 Depth limit reached...',
        status: 'error'
      };
      log = {
        ...log,
        sub_tasks: [...(log.sub_tasks || []), depthLimitLog]
      }
      onLogUpdate(log);
      return;
    }

    if (result.is_time_limit_exceeded) { // will never happen - no need to close the timer
      const timeLimitRecoveryLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '⏱️ Time limit: recovering...',
        status: 'loading'
      };
      log = {
        ...log,
        sub_tasks: [...(log.sub_tasks || []), timeLimitRecoveryLog]
      }
      onLogUpdate(log);
      await this.timeLimitRecovery(problemName, model, solution, timeLimitRecoveryLog, log, onLogUpdate, attack_vector, tags, tests);
    } else if (result.runtime_error) {
      const runtimeErrorRecoveryLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '⚠️ Runtime Error: recovering...',
        status: 'loading'
      };
      log = {
        ...log,
        sub_tasks: [...(log.sub_tasks || []), runtimeErrorRecoveryLog]
      }
      onLogUpdate(log);
      await this.runtimeErrorRecovery(problemName, model, solution, result.runtime_error, runtimeErrorRecoveryLog, log, onLogUpdate, attack_vector, tags, tests);
    } else if (result.wrong_answer && (!tests || tests.length === 0)) {
      const wrongAnswerRecoveryLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '🥅 Wrong answer: recovering...',
        status: 'loading'
      };
      log = {
        ...log,
        sub_tasks: [...(log.sub_tasks || []), wrongAnswerRecoveryLog]
      }
      onLogUpdate(log);
      await this.wrongAnswerRecovery(problemName, model, solution, result.wrong_answer, wrongAnswerRecoveryLog, log, onLogUpdate, attack_vector, tags, tests);
    }
  }

  private static async wrongAnswerRecovery(
    problemName: string,
    model: Model,
    solution: string,
    wrong_answer: string,
    log: Log,
    parentLog: Log,
    onLogUpdate: (log: Log) => void,
    attack_vector?: string,
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    const result = await this.fetchApi<SolutionResponse>('wrong_answer_recovery', problemName, model, {
      solution,
      wrong_answer,
      attack_vector,
      tags,
      tests
    });

    log.status = result.solution ? 'done' : 'error';
    onLogUpdate(log);

    if (result.solution) {
      const validationLog: Log = {
        id: generateId(),
        depth: parentLog.depth + 1,
        message: '👀 Validating solution...',
        status: 'loading'
      };
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), validationLog]
      onLogUpdate(parentLog);
      await this.validateSolution(problemName, model, result.solution, validationLog, parentLog, onLogUpdate, attack_vector, tags, tests);
    }
  }

  private static async timeLimitRecovery(
    problemName: string,
    model: Model,
    solution: string,
    log: Log, 
    parentLog: Log,
    onLogUpdate: (log: Log) => void,
    attack_vector?: string,
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    const result = await this.fetchApi<SolutionResponse>('time_limit_recovery', problemName, model, {
      solution,
      attack_vector,
      tags,
      tests
    });

    log.status = result.solution ? 'done' : 'error';
    onLogUpdate(log);

    if (result.solution) {
      const validationLog: Log = {
        id: generateId(),
        depth: parentLog.depth + 1,
        message: '👀 Validating recovered solution...',
        status: 'loading'
      };
      log.sub_tasks = [...(log.sub_tasks || []), validationLog]
      onLogUpdate(log);
      await this.validateSolution(problemName, model, result.solution, validationLog, log, onLogUpdate, attack_vector, tags);
    }
  }

  private static async runtimeErrorRecovery(
    problemName: string,
    model: Model,
    solution: string,
    runtime_error: string,
    log: Log,
    parentLog: Log,
    onLogUpdate: (log: Log) => void,
    attack_vector?: string, 
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    const result = await this.fetchApi<SolutionResponse>('runtime_error_recovery', problemName, model, {
      solution,
      error: runtime_error,
      attack_vector,
      tags,
      tests
    });

    log.status = result.solution ? 'done' : 'error';
    onLogUpdate(log);

    if (result.solution) {
      const validationLog: Log = {
        id: generateId(),
        depth: parentLog.depth + 1,
        message: '👀 Validating solution...',
        status: 'loading'
      };
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), validationLog]
      onLogUpdate(parentLog);
      await this.validateSolution(problemName, model, result.solution, validationLog, parentLog, onLogUpdate, attack_vector, tags);
    }
  }

  private static async runAllTests(
    problemName: string,
    model: Model,
    solution: string,
    log: Log,
    parentLog: Log,
    onLogUpdate: (log: Log) => void,
    qaValidated: boolean,
    attack_vector?: string,
    tags?: string[],
    tests?: SyntheticTest[]
  ): Promise<void> {
    
    const timer = setTimeout(async () => {
      if (log.depth >= MAX_DEPTH) {
        return;
      }
      
      const taRecoveryLog: Log = {
        id: generateId(),
        depth: log.depth + 1,
        message: '⏱️ Time limit recovery...',
        status: 'loading'
      }
      parentLog.sub_tasks = [...(parentLog.sub_tasks || []), taRecoveryLog]
      onLogUpdate(parentLog);
      
      this.timeLimitRecovery(problemName, model, solution, taRecoveryLog, parentLog, onLogUpdate, attack_vector, tags, tests);
    }, 10000);
    
    let result;
    try {
      result = await this.fetchApi<RunAllTestsResponse>('run_all_tests', problemName, undefined, {
        solution,
        qa_validated: qaValidated
      });
    } finally {
      clearTimeout(timer);
    }
    log.status = result?.success ? 'success' : 'error';
    onLogUpdate(log);
  }

  static async startProcess(problemName: string, onLogUpdate: (log: Log) => void) {
    this.checkIfOnlyOneOutputValid(problemName, onLogUpdate)

    Object.entries(directSolutionCallsPerModel).forEach(([model, count]) => {
      for (let i = 0; i < count; i++) {
        this.getSolution(problemName, model as Model, null, onLogUpdate)
      }
    });

    Object.entries(attackVectorCallsPerModel).forEach(([model, count]) => {
      for (let i = 0; i < count; i++) {
        this.getAttackVector(problemName, model as Model, null, onLogUpdate)
      }
    });

    Object.entries(syntheticTestCallsPerModel).forEach(([model, count]) => {
      for (let i = 0; i < count; i++) {
        this.getSyntheticTests(problemName, model as Model, onLogUpdate)
      }
    });

  }
} 