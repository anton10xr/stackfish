import { NextResponse } from 'next/server';
import { Model } from '../../types/models';

import * as prompts from '../../services/prompts';
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH } from '../../config/config';
import llm from '../../services/llm';
import * as algo_rag from '../../services/algo_rag';
import * as promptLogger from '../../services/promptLogger';
import {parseCode} from '../../services/parse_utils'

async function obtainFixedSolution(problem: string, model: Model, solution: string, wrong_answer: string, attack_vector?: string, tags?: string[]): Promise<string> {
    const problemDir = path.join(PROBLEMS_PATH, problem);
    const statement = fs.readFileSync(path.join(problemDir, 'statement.txt'), 'utf8').trim();
    const sampleInput = fs.readFileSync(path.join(problemDir, 'sample_in.txt'), 'utf8').trim();
    const sampleOutput = fs.readFileSync(path.join(problemDir, 'sample_out.txt'), 'utf8').trim();

    const techniques = algo_rag.get_techniques_from_tags(tags || []);

    const initial_prompt = prompts.main_prompt(statement, sampleInput, sampleOutput, attack_vector, techniques, []);

    const wrong_answer_prompt = prompts.wrong_answer_prompt(sampleInput, sampleOutput, wrong_answer);
    const first_messages = Array.isArray(initial_prompt) ? initial_prompt : [{ role: "user" as const, content: initial_prompt }];
    const messages = [
      ...first_messages,
      { role: "assistant" as const, content: solution },
      { role: "user" as const, content: wrong_answer_prompt },
    ]
    promptLogger.log(problem, 'Wrong Answer Recovery Prompt', messages);
    const cppCodeUnformated = await llm(messages, model);
    return parseCode(cppCodeUnformated);
}

export async function POST(request: Request) {
    // Get the problem from URL params
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');
    const model = searchParams.get('model') as Model;

    // Get solution, wrong_answer, attack_vector and tags from request body
    const body = await request.json();
    const { solution, wrong_answer, attack_vector, tags } = body;

    if (!model) {
        return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
    }

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }

    if (!solution) {
        return NextResponse.json({ error: 'Solution parameter is required' }, { status: 400 });
    }

    if (!wrong_answer) {
        return NextResponse.json({ error: 'Wrong answer parameter is required' }, { status: 400 });
    }

    // Simulate a delay of 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    const fixed_solution = await obtainFixedSolution(problem, model, solution, wrong_answer, attack_vector, tags);

    // Return the response
    return NextResponse.json({ solution: fixed_solution });
} 