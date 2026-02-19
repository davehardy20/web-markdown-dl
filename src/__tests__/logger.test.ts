import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { readFile, unlink, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { Logger } from '../utils/logger';

const TEST_DIR = join(import.meta.dir, 'fixtures', 'logger');
const TEST_LOG_FILE = join(TEST_DIR, 'test.log');

async function setupTestDir(): Promise<void> {
  try {
    await mkdir(TEST_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

async function cleanupTestDir(): Promise<void> {
  try {
    await rm(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

async function cleanupLogFile(): Promise<void> {
  try {
    await unlink(TEST_LOG_FILE);
  } catch {
    // File may not exist
  }
}

describe('Logger', () => {
  describe('constructor', () => {
    test('creates logger with default options', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    test('creates logger with logFile option', () => {
      const logger = new Logger({ logFile: '/tmp/test.log' });
      expect(logger).toBeInstanceOf(Logger);
    });

    test('creates logger with quiet option', () => {
      const logger = new Logger({ quiet: true });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('stderr output', () => {
    let originalStderrWrite: typeof process.stderr.write;
    let stderrOutput: string[];

    beforeEach(() => {
      stderrOutput = [];
      originalStderrWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk: string | Buffer | Uint8Array) => {
        stderrOutput.push(chunk.toString());
        return true;
      };
    });

    afterEach(() => {
      process.stderr.write = originalStderrWrite;
    });

    test('log() writes to stderr with INFO level', async () => {
      const logger = new Logger();
      await logger.log('test message');
      
      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain('[INFO]');
      expect(stderrOutput[0]).toContain('test message');
    });

    test('info() writes to stderr with INFO level', async () => {
      const logger = new Logger();
      await logger.info('info message');
      
      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain('[INFO]');
      expect(stderrOutput[0]).toContain('info message');
    });

    test('debug() writes to stderr with DEBUG level', async () => {
      const logger = new Logger();
      await logger.debug('debug message');
      
      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain('[DEBUG]');
      expect(stderrOutput[0]).toContain('debug message');
    });

    test('error() writes to stderr with ERROR level', async () => {
      const logger = new Logger();
      await logger.error('error message');
      
      expect(stderrOutput.length).toBe(1);
      expect(stderrOutput[0]).toContain('[ERROR]');
      expect(stderrOutput[0]).toContain('error message');
    });

    test('quiet mode suppresses stderr output', async () => {
      const logger = new Logger({ quiet: true });
      await logger.log('should not appear');
      
      expect(stderrOutput.length).toBe(0);
    });

    test('includes ISO 8601 timestamp', async () => {
      const logger = new Logger();
      await logger.log('timestamped');
      
      const isoPattern = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      expect(stderrOutput[0]).toMatch(isoPattern);
    });

    test('handles multiple arguments', async () => {
      const logger = new Logger();
      await logger.log('part1', 'part2', 'part3');
      
      expect(stderrOutput[0]).toContain('part1 part2 part3');
    });

    test('stringifies objects', async () => {
      const logger = new Logger();
      await logger.log({ key: 'value' });
      
      expect(stderrOutput[0]).toContain('{"key":"value"}');
    });
  });

  describe('file output', () => {
    beforeEach(async () => {
      await setupTestDir();
      await cleanupLogFile();
    });

    afterEach(async () => {
      await cleanupTestDir();
    });

    test('writes to log file when logFile option provided', async () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, quiet: true });
      await logger.log('file message');
      
      const content = await readFile(TEST_LOG_FILE, 'utf-8');
      expect(content).toContain('[INFO]');
      expect(content).toContain('file message');
    });

    test('appends to existing log file', async () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, quiet: true });
      await logger.log('first');
      await logger.log('second');
      
      const content = await readFile(TEST_LOG_FILE, 'utf-8');
      expect(content).toContain('first');
      expect(content).toContain('second');
      expect(content.split('\n').filter(Boolean).length).toBe(2);
    });

    test('writes all log levels to file', async () => {
      const logger = new Logger({ logFile: TEST_LOG_FILE, quiet: true });
      await logger.debug('debug msg');
      await logger.info('info msg');
      await logger.error('error msg');
      
      const content = await readFile(TEST_LOG_FILE, 'utf-8');
      expect(content).toContain('[DEBUG]');
      expect(content).toContain('[INFO]');
      expect(content).toContain('[ERROR]');
    });

    test('writes to both file and stderr when both enabled', async () => {
      let stderrOutput: string[] = [];
      const originalWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk: string | Buffer | Uint8Array) => {
        stderrOutput.push(chunk.toString());
        return true;
      };

      try {
        const logger = new Logger({ logFile: TEST_LOG_FILE });
        await logger.log('dual output');
        
        const fileContent = await readFile(TEST_LOG_FILE, 'utf-8');
        expect(fileContent).toContain('dual output');
        expect(stderrOutput.length).toBe(1);
        expect(stderrOutput[0]).toContain('dual output');
      } finally {
        process.stderr.write = originalWrite;
      }
    });

    test('handles invalid log file path gracefully', async () => {
      const logger = new Logger({ logFile: '/nonexistent/path/test.log', quiet: true });
      
      await expect(logger.log('test')).resolves.toBeUndefined();
    });
  });

  describe('timestamp format', () => {
    test('uses ISO 8601 format', async () => {
      let output = '';
      const originalWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk: string | Buffer | Uint8Array) => {
        output += chunk.toString();
        return true;
      };

      try {
        const logger = new Logger();
        await logger.log('test');
        
        const match = output.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
        expect(match).not.toBeNull();
        
        const parsedDate = new Date(match![1]);
        expect(parsedDate.getTime()).not.toBeNaN();
      } finally {
        process.stderr.write = originalWrite;
      }
    });
  });
});
