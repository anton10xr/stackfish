import { NextResponse } from 'next/server';
import * as prompts from '../../services/prompts';
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH, EXTRACT_KNOWLEDGE_TAGS_MODEL } from '../../config/config';
import llm from '../../services/llm';
import { Model } from '../../types/models';
import * as algo_rag from '../../services/algo_rag';
import * as promptLogger from '../../services/promptLogger';
import { RAG_resource } from '@/app/types/rag';
import { SyntheticTest } from '@/app/types/tests';

async function extractKnowledgeTags(problem: string, editorial: string, resources: RAG_resource[]): Promise<string[]> {
  const attack_vector_prompt = prompts.extract_knowledge_tags_prompt(editorial, resources);
  promptLogger.log(problem, 'Extract Knowledge Tags Prompt', attack_vector_prompt);
  const result = await llm(attack_vector_prompt, EXTRACT_KNOWLEDGE_TAGS_MODEL, true);
  console.log('EXTRACT KNOWLEDGE TAGS RESULT: ', result);
  try {
    const resultJson = JSON.parse(result);
    // Filter knowledge_ids to only include those that exist in resources
    return resultJson.knowledge_ids.filter((id: string) => resources.some((r: RAG_resource) => r.id === id));
  } catch (error) {
    console.error("Error parsing knowledge tags result:", error);
    return [];
  }
}

async function getAttackVector(problem: string, model: Model, tests: SyntheticTest[] | null): Promise<{attack_vector: string, tags: string[]}> {
  const problemDir = path.join(PROBLEMS_PATH, problem);
  const statement = fs.readFileSync(path.join(problemDir, 'statement.txt'), 'utf8').trim();
  const sampleInput = fs.readFileSync(path.join(problemDir, 'sample_in.txt'), 'utf8').trim();
  const sampleOutput = fs.readFileSync(path.join(problemDir, 'sample_out.txt'), 'utf8').trim();
  const resources = algo_rag.get_resources();
  const attack_vector_prompt = prompts.attack_vector_prompt(statement, sampleInput, sampleOutput, resources, tests);
  promptLogger.log(problem, 'Attack Vector Prompt', attack_vector_prompt);
  const attack_vector = await llm(attack_vector_prompt, model);
  const tags = await extractKnowledgeTags(problem, attack_vector, resources);
  console.log('RESPONSE: ', {attack_vector, tags});
  return {
    attack_vector,
    tags
  };
}

export async function POST(request: Request) {
    // Get the parameters from the URL
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');
    const model = searchParams.get('model') as Model;
    const body = await request.json();
    const { tests } = body;

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }

    if (!model) {
        return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
    }

    const {attack_vector, tags} = await getAttackVector(problem, model, tests);
    return NextResponse.json({ attack_vector, tags });
} 