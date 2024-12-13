import OpenAI from "openai";
import dotenv from "dotenv";
import { Model } from '../types/models';
import Together from 'together-ai';
import * as prompts from './prompts';
import { parseJson } from './parse_utils';

dotenv.config({ path: "./config.env" });


type Message = Together.Chat.Completions.CompletionCreateParams.Message | OpenAI.Chat.ChatCompletionMessageParam;

async function llm(messages: string | Message[], model: Model, isJson: boolean = false): Promise<string> {
    // Convert string input to proper message format
    const formattedMessages = typeof messages === 'string' 
        ? [{ role: "user", content: messages }] as Message[]
        : messages;

    try {
        if (model === 'qwq-32b-preview') {
            const client = new Together({apiKey: process.env.TOGETHER_API_KEY});
            const response = await client.chat.completions.create({
                model: 'Qwen/QwQ-32B-Preview',
                messages: formattedMessages as Together.Chat.Completions.CompletionCreateParams.Message[],
                max_tokens: 8192,
            });
            const answer = response.choices[0].message?.content || '';
            formattedMessages.push({ role: "assistant", content: answer });
            formattedMessages.push({ role: "user", content: prompts.final_answer_prompt() });
            return llm(formattedMessages, 'llama-3.3-70b', isJson);
        } else if (model === 'llama-3.3-70b') {
            const client = new Together({apiKey: process.env.TOGETHER_API_KEY});
            const response = await client.chat.completions.create({
                model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
                messages: formattedMessages as Together.Chat.Completions.CompletionCreateParams.Message[],
                response_format: isJson ? { type: "json_object" } : undefined,
                max_tokens: 8192,
            });
            const content = response.choices[0].message?.content || '';
            // Unfortunately, JSON mode is not yet supported by Together for this model
            // so have to add manual parsing
            if (isJson) {
                return JSON.stringify(parseJson(content));
            }
            return content;
        } else {
            const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
            const response = await client.chat.completions.create({
                model: model,
                messages: formattedMessages as OpenAI.Chat.ChatCompletionMessageParam[],
                response_format: isJson ? { type: "json_object" } : undefined,
            });
            return response.choices[0].message.content || '';
        }
    } catch (error) {
        console.error("Error in LLM call:", error);
        throw error;
    }
}

export default llm; 