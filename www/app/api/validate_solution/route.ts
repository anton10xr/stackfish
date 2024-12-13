import { NextResponse } from 'next/server';
import { validateSolution } from '../../services/solution';

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');

    const body = await request.json();
    const { solution, attack_vector, tags, tests } = body;

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }

    if (!solution) {
        return NextResponse.json({ error: 'Solution parameter is required' }, { status: 400 });
    }

    const result = await validateSolution(problem, solution, tests || []);

    return NextResponse.json(result);
} 