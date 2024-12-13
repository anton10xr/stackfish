import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PROBLEMS_PATH } from '../../config/config';

export async function GET() {
  try {
    const directories = fs.readdirSync(PROBLEMS_PATH, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    // Create _state directory in each problem directory if it doesn't exist
    directories.forEach(problemDir => {
      const stateDirPath = path.join(PROBLEMS_PATH, problemDir, '_state');
      if (!fs.existsSync(stateDirPath)) {
        fs.mkdirSync(stateDirPath, { recursive: true });
      }
    });

    return NextResponse.json({ 
      problems: directories,
    });
  } catch (error) {
    console.error('Error in /problems endpoint:', error);
    return NextResponse.json({ error: 'Failed to read or create directories' }, { status: 500 });
  }
}
