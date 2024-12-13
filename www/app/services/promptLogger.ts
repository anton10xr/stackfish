import OpenAI from "openai";
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH } from '../config/config';
type Message = OpenAI.Chat.ChatCompletionMessageParam;

export function log(problem: string, title: string, prompt: string | Message[]) {
  const problemDir = path.join(PROBLEMS_PATH, problem);
  const logFilePath = path.join(problemDir, 'prompts.log');
  if (typeof prompt !== 'string') {
    prompt = prompt.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
  }

  const logEntry = `
------------ ${new Date().toISOString()}; TITLE: ${title} ----------


${prompt}
`;

  fs.appendFileSync(logFilePath, logEntry, 'utf8');
  console.log(`Logged "${title}" prompt to "${logFilePath}"`);
} 
