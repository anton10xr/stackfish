import { executeCpp } from './cppExecutor';
import llm from './llm';
import { IS_VALID_OUTPUT_MODEL, PROBLEMS_PATH, SOLUTIONS_PATH } from '../config/config';
import path from 'path';
import fs  from 'fs';
import * as prompts from './prompts';
import { mkdir } from 'fs/promises';
import * as promptLogger from './promptLogger';
import { SyntheticTest } from '../types/tests';

function compareNumbers(a: number, b: number): boolean {
  const absoluteError = Math.abs(a - b);
  const maxAbs = Math.max(Math.abs(a), Math.abs(b));
  let relativeError;
  if (maxAbs > 0) {
    relativeError = absoluteError / maxAbs;
  } else {
    relativeError = 0;
  }
  return absoluteError <= 1e-6 || relativeError <= 1e-6;
}

function compareStrings(str1: string, str2: string): boolean {
  const lines1 = str1.trim().split('\n');
  const lines2 = str2.trim().split('\n');

  if (lines1.length !== lines2.length) {
    return false;
  }

  for (let i = 0; i < lines1.length; i++) {
    const tokens1 = lines1[i].trim().split(/\s+/);
    const tokens2 = lines2[i].trim().split(/\s+/);

    if (tokens1.length !== tokens2.length) {
      return false;
    }

    for (let j = 0; j < tokens1.length; j++) {
      const token1 = tokens1[j];
      const token2 = tokens2[j];

      if (token1 === token2) {
        continue;
      }

      const num1 = parseFloat(token1);
      const num2 = parseFloat(token2);

      if (!isNaN(num1) && !isNaN(num2)) {
        if (!compareNumbers(num1, num2)) {
          return false;
        }
      } else {
        return false;
      }
    }
  }
  return true;
}

async function isValidOutput(
  problem: string,
  statement: string,
  sampleInput: string,
  sampleOutput: string,
  resultOutput: string,
  is_only_one_output_valid: boolean
): Promise<boolean> {
  if (is_only_one_output_valid) {
    return compareStrings(resultOutput, sampleOutput);
  } else {
    const prompt = prompts.llm_sample_comparison(
      statement,
      sampleInput,
      sampleOutput,
      resultOutput
    );
    promptLogger.log(problem, 'Sample Comparison Prompt', prompt);

    const result = await llm(prompt, IS_VALID_OUTPUT_MODEL);
    console.log('RESULT:', result);
    return result.trim() === 'CORRECT';
  }
}

function isOnlyOneOutputValid(problem: string): boolean {
  try {
    const cacheFilePath = path.join(PROBLEMS_PATH, problem, '_state', 'is_only_one_output_valid.json');
    const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
    return JSON.parse(cacheData).is_only_one_output_valid;
  } catch (error) {
    console.error('Is only one output valid operation failed:', error);
    return true;
  }
}

async function validateSolutionAgainstATest(
  problem: string,
  statement: string,
  sampleInput: string,
  sampleOutput: string,
  solution: string,
): Promise<{
  is_valid: boolean;
  is_time_limit_exceeded?: boolean;
  runtime_error?: string;
  wrong_answer?: string;
}> {
  console.log('VALIDATING AGAINST A TEST: ', sampleInput, sampleOutput);
  const result = await executeCpp(solution, sampleInput);
  if (result.time_limit) {
    return { is_valid: false, is_time_limit_exceeded: true };
  }
  
  if (result.error) {
    return { is_valid: false, runtime_error: result.error.toString() };
  }

  const is_only_one_output_valid = isOnlyOneOutputValid(problem);
  const is_valid = await isValidOutput(
    problem,
    statement,
    sampleInput,
    sampleOutput,
    result.output.trim(),
    is_only_one_output_valid
  );

  if (!is_valid) {
    return { is_valid: false, wrong_answer: result.output.trim() };
  }

  return { is_valid: true };
}

export async function validateSolution(
  problem: string,
  solution: string,
  tests: SyntheticTest[]
): Promise<{
  is_valid: boolean;
  is_time_limit_exceeded?: boolean;
  runtime_error?: string;
  wrong_answer?: string;
}> {
  const problemDir = path.join(PROBLEMS_PATH, problem);
  const statement = fs.readFileSync(path.join(problemDir, 'statement.txt'), 'utf8').trim();
  const sampleInput = fs.readFileSync(path.join(problemDir, 'sample_in.txt'), 'utf8').trim();
  const sampleOutput = fs.readFileSync(path.join(problemDir, 'sample_out.txt'), 'utf8').trim();

  const full_tests = [{input: sampleInput, output: sampleOutput}].concat(tests);

  const results = await Promise.all(full_tests.map(test => validateSolutionAgainstATest(problem, statement, test.input, test.output, solution)));

  for (const result of results) {
    if (!result || !result.is_valid) {
      return result;
    }
  }

  return { is_valid: true };
}

export async function saveSolution(problem: string, solution: string, output: string, qaValidated: boolean): Promise<void> {
  const qaPrefix = qaValidated ? 'QA_' : '';
  const dateString: string = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
  const problemDir = path.join(SOLUTIONS_PATH, problem);
  const solutionDir = path.join(problemDir, `${qaPrefix}${dateString}`);

  try {
    // Create directory recursively if it doesn't exist
    await mkdir(solutionDir, { recursive: true });

    // Save solution.txt
    fs.writeFileSync(path.join(solutionDir, 'SOLUTION.cpp'), solution);
    
    // Save full_out.txt
    fs.writeFileSync(path.join(solutionDir, 'OUTPUT.txt'), output);
  } catch (error) {
    console.error('Error saving solution:', error);
    throw new Error(`Failed to save solution for problem ${problem}`);
  }
}

export async function calculateFullSolution(problem: string, solution: string): Promise<string> {
  try {
    // Read the full input file for the problem
    const fullInputPath = path.join(PROBLEMS_PATH, problem, 'full_in.txt');

    // Execute the C++ solution with the full input
    const result = await executeCpp(solution, undefined, fullInputPath);

    if (result.time_limit) {
      throw new Error('Time limit exceeded');
    }

    if (result.error) {
      throw new Error(`Runtime error: ${result.error}`);
    }

    return result.output.trim();

  } catch (error) {
    console.error('Error calculating full solution:', error);
    throw new Error(`Failed to calculate solution for problem ${problem}: ${error}`);
  }
}

export async function getEdgeCases(problem: string): Promise<string[]> {
  const count = 10;
  const problemDir = path.join(PROBLEMS_PATH, problem);
  const stateDir = path.join(problemDir, '_state');
  const isParallelizablePath = path.join(stateDir, 'is_parallelizable.json');

  try {
    const isParallelizable = JSON.parse(fs.readFileSync(isParallelizablePath, 'utf-8'));
    if (isParallelizable.status !== 'ready') {
      return [];
    }
    const subtasksDir = path.join(stateDir, 'subtasks');
    const files = fs.readdirSync(subtasksDir)
      .map(file => ({
        name: file,
        path: path.join(subtasksDir, file),
        size: fs.statSync(path.join(subtasksDir, file)).size
      }))
      .sort((a, b) => a.size - b.size)
      .slice(0, count);

    const filesContent = await Promise.all(
      files.map(file => fs.readFileSync(file.path, 'utf-8'))
    );
    return filesContent.map(content => {
      const lines = content.split('\n');
      return lines.slice(1).join('\n').trim();
    });
  } catch (error) {
    console.error('Error checking parallelizable status');
    return [];
  }

}