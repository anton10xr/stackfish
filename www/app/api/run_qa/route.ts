import { NextResponse } from 'next/server';
import { Model } from '../../types/models';
import * as prompts from '../../services/prompts';
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH } from '../../config/config';
import llm from '../../services/llm';
import * as algo_rag from '../../services/algo_rag';
import { getEdgeCases, validateSolution } from '@/app/services/solution';
import * as promptLogger from '../../services/promptLogger';
import { SyntheticTest } from '../../types/tests';

async function improveAndValidateSolution(problem: string, model: Model, solution: string, attack_vector?: string, tags?: string[], tests?: SyntheticTest[]): Promise<{
    is_valid: boolean;
    is_time_limit_exceeded: boolean;
    runtime_error: string | null;
    wrong_answer: string | null;
    improved_solution?: string;
}> {
    // Read problem data
    const problemDir = path.join(PROBLEMS_PATH, problem);
    const statement = fs.readFileSync(path.join(problemDir, 'statement.txt'), 'utf8').trim();
    const sampleInput = fs.readFileSync(path.join(problemDir, 'sample_in.txt'), 'utf8').trim();
    const sampleOutput = fs.readFileSync(path.join(problemDir, 'sample_out.txt'), 'utf8').trim();

    // Get relevant algorithmic techniques
    const techniques = algo_rag.get_techniques_from_tags(tags || []);

    const initial_prompt = prompts.main_prompt(statement, sampleInput, sampleOutput, attack_vector, techniques, []);
    const first_messages = Array.isArray(initial_prompt) ? initial_prompt : [{ role: "user" as const, content: initial_prompt }];

    // Generate improved solution using final QA prompt
    // TODO: add edge cases - 10 small examples from the parallelize stuff
    const edge_cases = await getEdgeCases(problem);
    const qa_prompt = prompts.final_qa_prompt(edge_cases);
    const messages = [
        ...first_messages,
        { role: "assistant" as const, content: solution },
        { role: "user" as const, content: qa_prompt },
    ];
    promptLogger.log(problem, 'QA Prompt', messages);

    // Get improved solution from LLM
    const improvedCodeUnformatted = await llm(messages, model);
    const lines = improvedCodeUnformatted.trim().split("\n");
    let improved_solution = improvedCodeUnformatted;
    if (lines[0].includes("```")) {
        lines.shift();
        if (lines[lines.length - 1].includes("```")) {
            lines.pop();
        }
        improved_solution = lines.join("\n");
    }

    // Validate the improved solution
    const validation = await validateSolution(problem, improved_solution, tests || []);

    if (validation.is_valid) {
      // TODO: save the solution

    }

    return {
        is_valid: validation.is_valid,
        is_time_limit_exceeded: validation.is_time_limit_exceeded || false,
        runtime_error: validation.runtime_error || null,
        wrong_answer: validation.wrong_answer || null,
        improved_solution: improved_solution
    };
}

export async function POST(request: Request) {
    // Get the problem and model from URL params
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');
    const model = searchParams.get('model') as Model;

    // Get solution and tags from request body
    const body = await request.json();
    const { solution, attack_vector, tags, tests } = body;

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }

    if (!model) {
        return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
    }

    if (!solution) {
        return NextResponse.json({ error: 'Solution is required' }, { status: 400 });
    }

    try {
        const result = await improveAndValidateSolution(problem, model, solution, attack_vector, tags, tests);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in run_qa:', error);
        return NextResponse.json(
            { error: 'Internal server error during QA process' },
            { status: 500 }
        );
    }
} 