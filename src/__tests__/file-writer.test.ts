/**
 * FileWriter utility tests
 * Tests for file writing with path validation and overwrite protection
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileWriter } from '../utils/file-writer.js';
import { mkdtemp, rm, readFile, access, constants } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PathSecurityError } from '../security.js';

describe('FileWriter', () => {
  let tempDir: string;
  let writer: FileWriter;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'file-writer-test-'));
    writer = new FileWriter(tempDir);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should create file with correct content', async () => {
      const filename = 'test.md';
      const content = '# Hello World\n\nThis is test content.';

      const result = await writer.write(filename, content);

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(tempDir, filename));

      // Verify file was written correctly
      const written = await readFile(result.path, 'utf-8');
      expect(written).toBe(content);
    });

    it('should respect overwrite option', async () => {
      const filename = 'existing.md';
      const originalContent = 'Original content';
      const newContent = 'New content';

      // Write original file
      await writer.write(filename, originalContent);

      // Try to overwrite with overwrite: false (default)
      const result = await writer.write(filename, newContent, { overwrite: false });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);

      // Verify original content is preserved
      const written = await readFile(join(tempDir, filename), 'utf-8');
      expect(written).toBe(originalContent);

      // Now try with overwrite: true
      const overwriteResult = await writer.write(filename, newContent, { overwrite: true });
      expect(overwriteResult.success).toBe(true);
      expect(overwriteResult.skipped).toBe(false);

      const overwritten = await readFile(join(tempDir, filename), 'utf-8');
      expect(overwritten).toBe(newContent);
    });

    it('should block path traversal attempts', async () => {
      const maliciousFilename = '../../../etc/passwd';

      await expect(writer.write(maliciousFilename, 'malicious'))
        .rejects.toThrow(PathSecurityError);

      // Also test with encoded traversal
      const encodedTraversal = '%2e%2e%2f%2e%2e%2fetc%2fpasswd';
      await expect(writer.write(encodedTraversal, 'malicious'))
        .rejects.toThrow(PathSecurityError);
    });

    it('should create directory if it does not exist', async () => {
      const filename = 'subdir/nested/deep/test.md';
      const content = 'Nested content';

      const result = await writer.write(filename, content);

      expect(result.success).toBe(true);

      // Verify file and directories were created
      const written = await readFile(result.path, 'utf-8');
      expect(written).toBe(content);
    });
  });

  describe('exists', () => {
    it('should return true for existing files', async () => {
      const filename = 'existing.md';

      // Create a file first
      await writer.write(filename, 'content');

      const exists = await writer.exists(filename);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing files', async () => {
      const exists = await writer.exists('non-existent.md');
      expect(exists).toBe(false);
    });
  });

  describe('validatePath', () => {
    it('should return safe absolute path for valid filenames', () => {
      const filename = 'safe-file.md';
      const path = writer.validatePath(filename);

      expect(path).toBe(join(tempDir, 'safe-file.md'));
    });

    it('should throw PathSecurityError for traversal attempts', () => {
      expect(() => writer.validatePath('../outside.md'))
        .toThrow(PathSecurityError);
    });
  });
});
