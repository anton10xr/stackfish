import path from 'path';
import { Model } from '../types/models';

// RECOMMENDED:specify yours CLOUD EXECUTE URL after deploying ./cloud-run-worker to google cloud run
export const CLOUD_EXECUTE_URL = "https://cloud-run-worker-313568160682.us-central1.run.app/compute";

// If use OpenAI models, please specify OPENAI_API_KEY= in config.env file
// If use qwq or llama models, please specify together.ai TOGETHER_API_KEY= in config.env file

// Defines how many parallel LLM calls to launch to generate synthetic tests for a problem
export const syntheticTestCallsPerModel: Record<Model, number> = {
  'o1-preview': 0,
  'o1-mini': 0,
  'gpt-4o': 0,
  'gpt-4o-mini': 1,
  'qwq-32b-preview': 0,
  'llama-3.3-70b': 0,
}

export const postSyntheticTestCallsPerModel: Record<Model, number> = {
  'o1-preview': 0,
  'o1-mini': 0,
  'gpt-4o': 0,
  'gpt-4o-mini': 1,
  'qwq-32b-preview': 0,
  'llama-3.3-70b': 0,
}

// Defines how many parallel LLM calls to launch to generate a hypothesis (aka. attack vector)
export const attackVectorCallsPerModel: Record<Model, number> = {
  'o1-preview': 0,
  'o1-mini': 0,
  'gpt-4o': 0,
  'gpt-4o-mini': 1,
  'qwq-32b-preview': 0,
  'llama-3.3-70b': 0,
}

// Defines how many parallel agents to launch to:
// After hypothesis is generated, how many agents should write a solution code
export const postAttackVectorSolutionCallsPerModel: Record<Model, number> = {
  'o1-preview': 0,
  'o1-mini': 0,
  'gpt-4o': 0,
  'gpt-4o-mini': 1,
  'qwq-32b-preview': 0,
  'llama-3.3-70b': 0,
}

// Defines how many parallel agents to launch to:
// Generate a solution directly, without a hypothesis and tests steps
export const directSolutionCallsPerModel: Record<Model, number> = {
  'o1-preview': 0,
  'o1-mini': 0,
  'gpt-4o': 0,
  'gpt-4o-mini': 0,
  'qwq-32b-preview': 0,
  'llama-3.3-70b': 0,
}

// Some problems accept more than one solution, for example, there can be multiple shortest paths in a graph
// But how can we verify if our solution is correct on test cases?
// We use LLM to analyze the problem statement and determine if only one output is possible or multiple.
// If only one output is possible, we can verify test cases by simply comparing the strings
// If more than one output is possible, we need to use LLM to verify if our solution is correct
// The IS_ONLY_ONE_OUTPUT_VALID_MODEL model reads the problem statement and determines if only one output is possible
export const IS_ONLY_ONE_OUTPUT_VALID_MODEL: Model = 'gpt-4o';

// In case if multiple outputs are possible, we use LLM to guess if the provided output seems correct
export const IS_VALID_OUTPUT_MODEL: Model = 'gpt-4o';

// After a hypothesis is generated, we use LLM to extract knowledge tags - advanced algorithms and data structures,
// which are mentioned in the hypothesis
export const EXTRACT_KNOWLEDGE_TAGS_MODEL: Model = 'gpt-4o';

// A dir with problem statements in hackercup format. Each problem is in a separate dir.
// Files required in each problem dir: statement.txt, sample_in.txt, sample_out.txt, full_in.txt
export const PROBLEMS_PATH = path.join(process.cwd(), '..', 'PROBLEMS'); 

// A dir where the model will place verified solutions
// For every problem a separate dir is created, and both source code and full test cases are placed there
export const SOLUTIONS_PATH = path.join(process.cwd(), '..', 'SOLUTIONS');

