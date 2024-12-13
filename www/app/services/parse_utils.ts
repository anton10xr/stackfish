import relaxedJson from 'relaxed-json';

export function parseCode(llm_output: string): string {
  const codeBlockRegex = /^[\s\S]*?```(?:\w+\n)?([\s\S]*?)```[\s\S]*$/;
  const match = llm_output.match(codeBlockRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  return llm_output.trim();
}

export function parseJson(content: string): Record<string, any> {
  const trimmedContent = content.substring(
      content.indexOf('{'),
      content.lastIndexOf('}') + 1
  );
  return relaxedJson.parse(trimmedContent);
}