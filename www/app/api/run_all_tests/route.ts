import { NextResponse } from 'next/server';
import { saveSolution, calculateFullSolution } from '../../services/solution';

export async function POST(request: Request) {
    // Get the problem from URL params
    const { searchParams } = new URL(request.url);
    const problem = searchParams.get('problem');

    // Get solution from request body
    const body = await request.json();
    const { solution, qa_validated } = body;

    if (!problem) {
        return NextResponse.json({ error: 'Problem parameter is required' }, { status: 400 });
    }

    if (!solution) {
        return NextResponse.json({ error: 'Solution parameter is required' }, { status: 400 });
    }

    try {
        // Calculate the solution for the full input
        const output = await calculateFullSolution(problem, solution);
        
        // Save the solution with the calculated output
        await saveSolution(problem, solution, output, qa_validated);

        return NextResponse.json({ 
          success: true,
        });
    } catch (error) {
        console.error('Error running tests:', error);
        return NextResponse.json({ 
            error: 'Failed to run tests',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 200 });
    }
} 