import { RAG_resource } from '../types/rag';
import OpenAI from "openai";
import { SyntheticTest } from '../types/tests';
type Message = OpenAI.Chat.ChatCompletionMessageParam;

function get_knowledge_list(resources: RAG_resource[]): string{
  return resources.map(resource => `${resource.id} - ${resource.title}`).join('\n');
}

function synthetic_tests_prompt(tests: SyntheticTest[] | null): string{
  if (!tests?.length) {
    return '';
  }
  const all_tests = tests.map((test, i) =>
    `<SAMPLE_INPUT_${i+2}>\n${test.input}\n</SAMPLE_INPUT_${i+2}>\n\n<SAMPLE_OUTPUT_${i+2}>\n${test.output}\n</SAMPLE_OUTPUT_${i+2}>\n\n<SAMPLE_EXPLANATION_${i+2}>\n${test.explanation}\n</SAMPLE_EXPLANATION_${i+2}>\n`);
  return `\nHere are more test cases that you can use to better understand the problem:
${all_tests.join('\n\n')}
`;
}

export function attack_vector_prompt(statement: string, sampleIn: string, sampleOut: string, resources: RAG_resource[], tests: SyntheticTest[] | null): Message[]{
    return [
        {
            role: 'user',
            content: `Please solve the following advanced Codeforce-style competetive programming problem.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>
${synthetic_tests_prompt(tests)}
<CONSTRAINTS>
Time limit: 200 seconds
Memory limit: 8000 MB
</CONSTRAINTS>

At this point I don't need the code, just editorial-style verbal description of the solution.
The student Anton will write the code based on your solution.
Anton is pretty decent competitive programmer, and is familiar with the following algorithms, data structures and techniques, so feel free to refer to them:

<ANTON_KNOWLEDGE>
${get_knowledge_list(resources)}
</ANTON_KNOWLEDGE>

If the solution uses some specific algorithms from the knowledge library, please simply mention the knowledge id just like this (knowledge id: ...).
`
        },
        {
            role: 'user',
            content: `Let's begin! Good luck and think out of the box!

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>
${synthetic_tests_prompt(tests)}
<CONSTRAINTS>
Time limit: 200 seconds
Memory limit: 8000 MB
</CONSTRAINTS>

Please reason deeply how to solve the problem and write concise and clear verbal solution for it in codeforces editorial style.
Don't write the code, just verbal explanation in a couple of paragraphs. Only proffessional competitive programmers will read your solution, so feel free to refer to advanced algorithms and use jargon/slang.
Don't forget to include big O notation for the time and space complexity.`
        }
      ];
}

export function write_solution_with_attack_vector(statement: string, sampleIn: string, sampleOut: string, attackVector: string | undefined, techniques: Record<string, string> | undefined, tests: SyntheticTest[]): Message[] {
  let techniques_str = "";
  if (techniques) {
    for (const [key, value] of Object.entries(techniques)) {
      techniques_str += `\n## Correct and efficient implementation of ${key}.cpp\n<CODE>\n${value}\n</CODE>\n`;
    }
  }
  if (techniques_str) {
    techniques_str = `To help you, here are some potentially useful algorithms, data structures and techniques, feel free to copy-paste them into your code if needed!

${techniques_str}`;
  }

  return [
    {
      role: 'user',
      content: `Write codeforces style C++20 solution code for the given advanced competitive programming problem.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>
${synthetic_tests_prompt(tests)}
<CONSTRAINTS>
Time limit: 200 seconds
Memory limit: 8000 MB
</CONSTRAINTS>

${techniques_str}

## Additionally, here is a hint how to approach the problem:

<HINT>
${attackVector}
</HINT>`
    },
    {
      role: 'user',
      content: `Once again, here is the problem you need to solve:
<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>

<CONSTRAINTS>
Time limit: 200 seconds
Memory limit: 8000 MB
</CONSTRAINTS>

As you know, it's important to exactly match the output format like in the sample output.
Keep in mind the constraints so try to come up with asymptotically fast solution.
Use scanf/printf for read and write from the standard input/output. Always include <bits/stdc++.h> and 'using namespace std;'
Add high level comments only to explain complex/tricky parts of the code.
Go ahead and write the code. Do not output any text before or after the code.
Start with a line: #include <stdio.h>`
    }
  ];
}

export function main_prompt(statement: string, sampleIn: string, sampleOut: string, attackVector: string | undefined, techniques: Record<string, string> | undefined, tests: SyntheticTest[]): Message[] | string {
      if (attackVector) {
        return write_solution_with_attack_vector(statement, sampleIn, sampleOut, attackVector, techniques, tests);
      }
      return `Write codeforces style C++20 solution code for the given advanced competitive programming problem.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>
${synthetic_tests_prompt(tests)}
<CONSTRAINTS>
Time limit: 200 seconds
Memory limit: 8000 MB
</CONSTRAINTS>

As you know, it's important to exactly match the output format like in the sample output.
Keep in mind the constraints so try to come up with asymptotically fast solution.
Use scanf/printf for read and write from the standard input/output. Always include <bits/stdc++.h> and 'using namespace std;'
Add high level comments only to explain complex/tricky parts of the code.
Go ahead and write the code. Do not output any text before or after the code.
Start with a line: #include <stdio.h>`;
}


export function error_recovery_prompt(error: string): string{
  return `Unfortunately, executing your code resulted in the following error:
<ERROR>
${error}
</ERROR>

Please fix the error and rewrite the code completely to pass the sample input.
Do not output anything else besides the fully working code solution.
Immediately start with a line: #include <stdio.h>`;
}


export function wrong_answer_prompt(sampleIn: string, sampleOut: string, wrongAnswer: string): string{
  return `Unfortunately, this code outputs wrong answer for the sample input:
<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<EXPECTED_SAMPLE_OUTPUT>
${sampleOut}
</EXPECTED_SAMPLE_OUTPUT>

<ACTUAL_SAMPLE_OUTPUT>
${wrongAnswer}
</ACTUAL_SAMPLE_OUTPUT>

Please fix the bug and rewrite the code completely to pass the sample input.
Do not output anything else besides the fully working code solution.
Immediately start with a line: #include <stdio.h>`;
}

export function time_limit_prompt(): string{
  return `The solution possibly is correct, but unfortunately, given the constraints, it can not finish in reasonable time.

Please, think hard and try to significantly improve it's asymptotic.

Just for inspiration and brainstorming, here is a list of advanced competitive programming techniques that you might want to consider:

Data Structures: Binary Indexed Trees, Segment Trees (with lazy propagation), Tries, Union Find, Suffix Arrays
Graph Algorithms: BFS/DFS, Dijkstra's, Floyd-Warshall, MST algorithms, Topological Sort
Dynamic Programming: LCS, Knapsack variations, Matrix Chain, Edit Distance, State Space optimization
Math: Prime operations, Modular arithmetic, Euler's Totient, Chinese Remainder, Matrix exponentiation
String Processing: KMP, Rabin-Karp, Z algorithm, Manacher's algorithm
Geometry: Convex Hull, Line Intersection, Sweep Line, Computational Geometry basics
General Techniques: Bit manipulation, Two Pointers, Binary Search variations, Square Root/Heavy-Light Decomposition

Consider if any of these techniques could be useful for solving this problem efficiently. Think out of the box!

Think if there some more advanced data structures or algorithms that can be used here (like segment tree, heap, trie, binary search, dynamic programming, etc).
Do not output anything else besides the fully working code solution.

Immediately start with a line: #include <stdio.h>`;
}

export function final_qa_prompt(edge_cases: string[]): string{
  const edgeCasesSection = edge_cases.length ? `
For example, here are a few potential inputs, just to give you some ideas:

<TRICKY_TEST_CASE>
${edge_cases.length}
${edge_cases.map(edge_case => edge_case.trim()).join('\n')}
</TRICKY_TEST_CASES>` : '';

  return `Wow, the solution above passes the test cases correctly!
Before I submit it, please think really hard if you solution works correctly for all the possible edge cases.${edgeCasesSection}

Please rewrite the full program for me, considering the fixes. Do not output anything else besides the code. Immediately start with a line: #include <stdio.h>`;
}

export function wrong_answer_prompt_with_attack_vector(sampleIn: string, sampleOut: string, wrongAnswer: string): string{
  return `Unfortunately, this approach seems to be not correct.
I implemented it with code and it outputs wrong answer for the sample input:

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<EXPECTED_SAMPLE_OUTPUT>
${sampleOut}
</EXPECTED_SAMPLE_OUTPUT>

<ACTUAL_SAMPLE_OUTPUT>
${wrongAnswer}
</ACTUAL_SAMPLE_OUTPUT>

Please analyze the error and provide working solution. Think hard and try to come up with a new strategy that will lead to the correct solution.
Provide a clear and concise text solution for the problem in one or two paragraphs, suitable for professional competitive programmers.`;
}

export function split_program_prompt(inputFormat: string, sampleInput: string, separator: string): string{
  return `Write a C++20 program that takes input data for codeforces-style problem with multiple (T) test cases and outputs the same input,
but for each test case the T is 1, separated by separator ${separator}.

Use scanf/printf for read and write from the standard input/output. Please keep it simple and short. Also keep in mind that input can be quite large, so please only use dynamic allocated vectors without hardcoding the size.

<INPUT_FORMAT>
${inputFormat}
</INPUT_FORMAT>

<EXAMPLE_INPUT>
${sampleInput}
</EXAMPLE_INPUT>

<EXAMPLE_OUTPUT_FORMAT>
1
...your program should write here the first test case input perfectly the same format as in the input...
${separator}
1
...your program should write here the second test case input perfectly the same format as in the input...
${separator}
1
...your program should write here the third test case input perfectly the same format as in the input...
${separator}
...
</EXAMPLE_OUTPUT_FORMAT>

Do not output anything else besides the code. Immediately start with a line: #include <stdio.h>`;
}

export function is_only_one_output_valid_prompt(statement: string, sampleIn: string, sampleOut: string): string{
  return `Look at the given codeforces-style problem statement.
Your goal is to read the problem and examples and determine one simple thing: if for any provided test case input, there only one correct answer, or there more than one correct answer are accepted?
For example, if the problem is how long is the shortest path in the graph - there is only one correct answer, so the answer is SINGLE. But if the problem is to find SOME shortest path in the graph - there might be multiple shortest paths, so the answer is MULTIPLE.

Output only one word: "SINGLE" if there is only one correct output, or "MULTIPLE" if there more than one valid output is accepted.
One exception is float numbers, if the solution expects one number with some absolute/relative error allowed, it still should be considered as a single valid solution.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>

Please think hard and then directly output one word: "SINGLE" if there is only one correct output for each test case, or "MULTIPLE" if the task validator can accept multiple outputs.`;
}

export function llm_sample_comparison(statement: string, sampleInput: string, sampleOutput: string, resultOutput: string): string{
  return `Take a look at the following codeforces-style problem statement, official sample input and output examples.
Also look at the sample output, produced by my program.
I'm not sure if my program is correct, so I need you to verify if the output of my program is correct.
Because the problem statement accepts multiple correct answers, I need your help to verify if the output of my program is valid.
I know it can be quite hard, but please do your best and give me answer: "CORRECT" if the output of my output is likely valid, or "INCORRECT" otherwise.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<OFFICIAL_SAMPLE_INPUT>
${sampleInput}
</OFFICIAL_SAMPLE_INPUT>

<OFFICIAL_SAMPLE_OUTPUT>
${sampleOutput}
</OFFICIAL_SAMPLE_OUTPUT>

<MY_PROGRAM_SAMPLE_OUTPUT>
${resultOutput}
</MY_PROGRAM_SAMPLE_OUTPUT>

Please think hard and then directly output one word: "CORRECT" if the output of my program is likely valid, or "INCORRECT" otherwise. Do not output anything else.`;
}

export function final_answer_prompt(): string{
  return `Please remove all the reasoning and output the clear final answer in a format as required in the original request.`;
}

function get_rag_resource_list(resources: RAG_resource[]): string{
  return resources.map(resource => `| ID ${resource.id} | Title: ${resource.title} | END ID ${resource.id} |`).join('\n');
}

export function extract_knowledge_tags_prompt(editorial: string, resources: RAG_resource[]): Message[]{
  const resources_str = get_rag_resource_list(resources);
  // given the codeforces editorial and list of resources, extract all the knowledge tags
  return [
    {
      role: 'user',
      content: `You will be given two things:
1) EDITORIAL - codeforces editorial for an advanced competitive programming problem.
2) LIBRARY - list of iconic algorithms, data structures and techniques that are awailable in the knowledge library.

Your task is to extract all the knowledge tags from the editorial that are present in the list of resources.

<EDITORIAL>
${editorial}
</EDITORIAL>

<LIBRARY>
${resources_str}
</LIBRARY>`,
    },
    {
      role: 'user',
      content: `Once again, here is the Editorial you need to extract the knowledge library references from:

<EDITORIAL>
${editorial}
</EDITORIAL>

Please output JSON in the following format:
{
  "reasoning": "...", 
  "knowledge_ids": ["..."]
}

Where:
"reasoning" - is short chain of thought reasoning where you are noticing which exact algorithms and techniques
  are reffered to in the editorial, what are the best most relevant candidates for that in the library,
  end eventually come up with the final accurate list of knowledge tags to use.
"knowledge_ids" - is a list of IDs of the knowledge tags that are present in the library.

Please go ahead and directly output the JSON without any extra symbols:`,
    }
  ];
}

export function get_synthetic_tests_prompt(statement: string, sampleIn: string, sampleOut: string): string{
  return `Look at the given codeforces-style problem statement.
Your goal is to read the problem and samples, understand the problem well and produce 4 more sample test cases.
Each test case should be small, because you are going to be able to calculate the solution on the fly.
Please focus on edge cases, corner cases, but staying within the problem constraints.
Each test case should start from a line 1, (like T = 1) because it will include only one test case input.
Each test case output should start with "Case #1: " and only have one Case because the T is 1.
Each test should have a short explanation of the test and the output, because the goal is essentially help user to understand the problem statement better and all the possible pitfalls.
Do not duplicate test cases with the sample input/output, but make sure to cover all the edge cases.

<PROBLEM_STATEMENT>
${statement}
</PROBLEM_STATEMENT>

<SAMPLE_INPUT>
${sampleIn}
</SAMPLE_INPUT>

<SAMPLE_OUTPUT>
${sampleOut}
</SAMPLE_OUTPUT>

Please directly output JSON with the additional test cases in the following format:
{
  "tests": [{"input": "...", "output": "...", "explanation": "..."}, ...]
}
Do not output anything else.`;
}
