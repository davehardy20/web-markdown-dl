import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import {
  validateOutputPath,
  fileExists,
  PathSecurityError,
} from '../security.js';

export interface WriteResult {
  success: boolean;
  path: string;
  skipped?: boolean;
}

export interface WriteOptions {
  overwrite?: boolean;
}

export class FileWriter {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async write(
    filename: string,
    content: string,
    options: WriteOptions = {}
  ): Promise<WriteResult> {
    const { overwrite = false } = options;
    const outputPath = this.validatePath(filename);

    const exists = await fileExists(outputPath);
    if (exists && !overwrite) {
      return {
        success: true,
        path: outputPath,
        skipped: true,
      };
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf-8');

    return {
      success: true,
      path: outputPath,
      skipped: false,
    };
  }

  async exists(filename: string): Promise<boolean> {
    const outputPath = this.validatePath(filename);
    return fileExists(outputPath);
  }

  validatePath(filename: string): string {
    return validateOutputPath(filename, this.baseDir);
  }
}
