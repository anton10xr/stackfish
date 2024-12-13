import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import os from 'os';
import { Storage } from '@google-cloud/storage';
import { CLOUD_EXECUTE_URL } from '../config/config';

interface ExecutionResult {
  output: string;
  error?: string;
  time_limit?: boolean;
}

const storage = new Storage({
  projectId: 'hackercup'
});
const bucketName = 'hacker-bucket'; // Replace with the bucket name you created

const MAX_RETRIES = 2;
const RETRY_DELAY = 5000; // 5 seconds

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getBucketUrlForFilePath(filePath: string): Promise<string> {
  const cacheFilePath = path.join(os.tmpdir(), 'inputUrlCache.json');
  let cache: { [path: string]: string } = {};

  try {
    if (fs.existsSync(cacheFilePath)) {
      const cacheContent = fs.readFileSync(cacheFilePath, 'utf8');
      cache = JSON.parse(cacheContent);
    }

    if (cache[filePath]) {
      return cache[filePath];
    }

    // If not in cache, upload to GCS and update cache
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const newUrl = await uploadToGCS(fileContent, `inputs/${uuidv4()}.txt`);
    cache[filePath] = newUrl;
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache), 'utf8');

    return newUrl;
  } catch (error) {
    console.error('Error managing URL cache:', error);
    throw new Error('Failed to retrieve or upload the file URL.');
  }
}

async function uploadToGCS(data: string, destination: string): Promise<string> {
  const file = storage.bucket(bucketName).file(destination);
  await file.save(data);
  return `gs://${bucketName}/${destination}`;
}

// Function to download output from GCS
async function downloadFromGCS(objectUrl: string): Promise<string> {
  const [scheme, bucketWithPath] = objectUrl.split('://');
  const [bucketName, ...filePathParts] = bucketWithPath.split('/');
  const filePath = filePathParts.join('/');

  const file = storage.bucket(bucketName).file(filePath);
  const contents = await file.download();
  return contents.toString();
}

export async function executeCpp(sourceCode: string, inputString?: string, inputPath?: string): Promise<ExecutionResult> {
  try {
    let inputUrl: string | undefined;
    
    if (inputPath) {
      inputUrl = await getBucketUrlForFilePath(inputPath);
    }

    const payload: any = { sourceCode };

    if (inputString) {
      payload.input = inputString;
    } else if (inputUrl) {
      payload.inputUrl = inputUrl;
    }

    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const response = await axios.post(
          CLOUD_EXECUTE_URL,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            responseType: 'json',
          }
        );

        const responseData = response.data;

        if (responseData.error) {
          return {
            output: '',
            error: responseData.error,
          };
        }

        if (responseData.outputUrl) {
          const output = await downloadFromGCS(responseData.outputUrl);
          return { output };
        } else {
          return {
            output: responseData.output,
          };
        }

      } catch (error) {
        if (axios.isAxiosError(error) && (error.response?.status === 502 || error.response?.status === 429)) {
          attempts++;
          if (attempts <= MAX_RETRIES) {
            console.log(`Attempt ${attempts} failed with status ${error.response.status}. Retrying...`);
            await delay(RETRY_DELAY * attempts);
            continue;
          }
        }
        throw error; // Rethrow if it's not a retriable error or we're out of retries
      }
    }

    throw new Error('Max retries exceeded');

  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 