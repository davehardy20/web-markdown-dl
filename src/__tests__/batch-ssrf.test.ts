/**
 * SSRF validation tests for batch processing
 * Tests that batch mode properly validates URLs against SSRF attacks
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BatchProcessor, BatchOptions } from '../batch.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Batch SSRF Validation', () => {
  let tempDir: string;
  let inputFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'batch-ssrf-test-'));
    inputFile = join(tempDir, 'urls.txt');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('SSRF Protection', () => {
    it('should reject internal IP URLs (192.168.x.x)', async () => {
      const urls = [
        'https://example.com/valid',
        'http://192.168.1.1/admin',
        'https://example.com/also-valid',
      ];
      await writeFile(inputFile, urls.join('\n'));

      const options: BatchOptions = {
        inputFile,
        outputDir: tempDir,
      };
      const processor = new BatchProcessor(options);
      const result = await processor.readUrls();

      // Should only include valid external URLs
      expect(result).toContain('https://example.com/valid');
      expect(result).toContain('https://example.com/also-valid');
      expect(result).not.toContain('http://192.168.1.1/admin');
      expect(result.length).toBe(2);
    });

    it('should reject localhost URLs', async () => {
      const urls = [
        'https://example.com/valid',
        'http://localhost:8080/admin',
        'http://127.0.0.1:3000/api',
        'https://example.com/also-valid',
      ];
      await writeFile(inputFile, urls.join('\n'));

      const options: BatchOptions = {
        inputFile,
        outputDir: tempDir,
      };
      const processor = new BatchProcessor(options);
      const result = await processor.readUrls();

      // Should only include valid external URLs
      expect(result).toContain('https://example.com/valid');
      expect(result).toContain('https://example.com/also-valid');
      expect(result).not.toContain('http://localhost:8080/admin');
      expect(result).not.toContain('http://127.0.0.1:3000/api');
      expect(result.length).toBe(2);
    });

    it('should reject cloud metadata URLs (169.254.169.254)', async () => {
      const urls = [
        'https://example.com/valid',
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'https://example.com/also-valid',
      ];
      await writeFile(inputFile, urls.join('\n'));

      const options: BatchOptions = {
        inputFile,
        outputDir: tempDir,
      };
      const processor = new BatchProcessor(options);
      const result = await processor.readUrls();

      // Should only include valid external URLs
      expect(result).toContain('https://example.com/valid');
      expect(result).toContain('https://example.com/also-valid');
      expect(result).not.toContain('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
      expect(result.length).toBe(2);
    });

    it('should accept valid external URLs', async () => {
      const urls = [
        'https://example.com/page1',
        'https://google.com/search',
        'https://github.com/user/repo',
        'http://httpbin.org/get',
      ];
      await writeFile(inputFile, urls.join('\n'));

      const options: BatchOptions = {
        inputFile,
        outputDir: tempDir,
      };
      const processor = new BatchProcessor(options);
      const result = await processor.readUrls();

      // All valid external URLs should be included
      expect(result).toContain('https://example.com/page1');
      expect(result).toContain('https://google.com/search');
      expect(result).toContain('https://github.com/user/repo');
      expect(result).toContain('http://httpbin.org/get');
      expect(result.length).toBe(4);
    });

    it('should allow internal URLs when allowInternal is true', async () => {
      const urls = [
        'https://example.com/valid',
        'http://192.168.1.1/admin',
        'http://localhost:8080/admin',
        'http://169.254.169.254/metadata',
        'https://example.com/also-valid',
      ];
      await writeFile(inputFile, urls.join('\n'));

      const options: BatchOptions = {
        inputFile,
        outputDir: tempDir,
        allowInternal: true, // Enable internal URLs
      };
      const processor = new BatchProcessor(options);
      const result = await processor.readUrls();

      // All URLs should be included when allowInternal is true
      expect(result).toContain('https://example.com/valid');
      expect(result).toContain('http://192.168.1.1/admin');
      expect(result).toContain('http://localhost:8080/admin');
      expect(result).toContain('http://169.254.169.254/metadata');
      expect(result).toContain('https://example.com/also-valid');
      expect(result.length).toBe(5);
    });
  });
});
