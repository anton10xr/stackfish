import { NextResponse } from 'next/server';
import { SyntheticTest } from '@/app/types/tests';
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH } from '../../config/config';
import { get_synthetic_tests_prompt } from '../../services/prompts';
import llm from '../../services/llm';
import { Model } from '../../types/models';
import * as promptLogger from '../../services/promptLogger';

async function getSyntheticTests(problem: string, model: Model): Promise<SyntheticTest[]> {
    // Read problem data
    const problemDir = path.join(PROBLEMS_PATH, problem);
    const statement = fs.readFileSync(path.join(problemDir, 'statement.txt'), 'utf8').trim();
    const sampleInput = fs.readFileSync(path.join(problemDir, 'sample_in.txt'), 'utf8').trim();
    const sampleOutput = fs.readFileSync(path.join(problemDir, 'sample_out.txt'), 'utf8').trim();

    // Generate the prompt
    const prompt = get_synthetic_tests_prompt(statement, sampleInput, sampleOutput);

    promptLogger.log(problem, 'Synthetic Tests Prompt', prompt);

    // Get synthetic tests from LLM
    const response = await llm(prompt, model, true);

    // Parse the JSON response
    let testsData;
    try {
        testsData = JSON.parse(response);
    } catch (error) {
        console.log('INVALID SYNTHETIC TESTS RESPONSE', response);
        console.error('Failed to parse LLM response:', error);
        throw new Error('Invalid JSON response from LLM');
    }

    if (!testsData.tests || !Array.isArray(testsData.tests)) {
        throw new Error('Invalid response format from LLM');
    }

    // Validate each test matches SyntheticTest type
    for (const test of testsData.tests) {
        if (!test.input || typeof test.input !== 'string' ||
            !test.output || typeof test.output !== 'string' ||
            !test.explanation || typeof test.explanation !== 'string') {
            throw new Error('Invalid test format - missing required string fields');
        }
        test.input = test.input.trim();
        test.output = test.output.trim();
        test.explanation = test.explanation.trim();
    }

    return testsData.tests;
}

export async function GET(request: Request) {
    // Get the problem parameter from the URL
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');
    const model = searchParams.get('model') as Model;

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }
    if (!model) {
        return NextResponse.json({ error: 'Model parameter is required' }, { status: 400 });
    }

    try {
        const tests = await getSyntheticTests(problem, model);
        return NextResponse.json({ tests });
    } catch (error) {
        console.error('Error generating synthetic tests:', error);
        return NextResponse.json(
            { error: 'Failed to generate synthetic tests' },
            { status: 500 }
        );
    }
} 