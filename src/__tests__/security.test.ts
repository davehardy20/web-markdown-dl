/**
 * Security utility tests
 * Tests for path traversal prevention and filename sanitization
 */

import { describe, it, expect } from 'bun:test';
import {
  isPathSafe,
  sanitizeFilename,
  sanitizeUrlForFilename,
  fileExists,
  validateOutputPath,
  buildSafeOutputPath,
  buildSafeOutputPathWithPrefix,
  PathSecurityError,
} from '../security.js';
import { mkdtemp, writeFile, rmdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Security Utilities', () => {
  describe('isPathSafe', () => {
    it('should allow paths within base directory', () => {
      expect(isPathSafe('/output/file.md', '/output')).toBe(true);
      expect(isPathSafe('/output/subdir/file.md', '/output')).toBe(true);
      expect(isPathSafe('/output/deep/nested/path/file.md', '/output')).toBe(true);
    });

    it('should block path traversal attempts with ../', () => {
      expect(isPathSafe('/output/../etc/passwd', '/output')).toBe(false);
      expect(isPathSafe('/output/subdir/../../../etc/passwd', '/output')).toBe(false);
      expect(isPathSafe('/output/..', '/output')).toBe(false);
    });

    it('should handle edge cases', () => {
      // Exact match should be safe
      expect(isPathSafe('/output', '/output')).toBe(true);
      
      // Different base directory
      expect(isPathSafe('/other/file.md', '/output')).toBe(false);
      
      // Prefix match without separator should be unsafe
      expect(isPathSafe('/output_backup/file.md', '/output')).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should allow safe characters', () => {
      expect(sanitizeFilename('filename')).toBe('filename');
      expect(sanitizeFilename('file-name')).toBe('file-name');
      expect(sanitizeFilename('file_name')).toBe('file_name');
      expect(sanitizeFilename('file.name')).toBe('file.name');
      expect(sanitizeFilename('FileName123')).toBe('FileName123');
    });

    it('should replace dangerous characters with underscore', () => {
      expect(sanitizeFilename('file/name')).toBe('file_name');
      expect(sanitizeFilename('file:name')).toBe('file_name');
      expect(sanitizeFilename('file*name')).toBe('file_name');
      expect(sanitizeFilename('file?name')).toBe('file_name');
      expect(sanitizeFilename('file"name')).toBe('file_name');
      expect(sanitizeFilename("file'name")).toBe('file_name');
      expect(sanitizeFilename('file<name>')).toBe('file_name');
      expect(sanitizeFilename('file|name')).toBe('file_name');
      expect(sanitizeFilename('file\\name')).toBe('file_name');
      expect(sanitizeFilename('file name')).toBe('file_name');
      expect(sanitizeFilename('file\tname')).toBe('file_name');
    });

    it('should block path traversal sequences', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etc_passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('windows_system32');
      expect(sanitizeFilename('..')).toBe('unnamed');
      expect(sanitizeFilename('../')).toBe('unnamed');
    });

    it('should handle URL-encoded traversal attempts', () => {
      expect(sanitizeFilename('..%2f..%2fetc/passwd')).toBe('etc_passwd');
      expect(sanitizeFilename('%2e%2e/%2e%2e/etc/passwd')).toBe('etc_passwd');
    });

    it('should remove null bytes and control characters', () => {
      expect(sanitizeFilename('file\x00name')).toBe('filename');
      expect(sanitizeFilename('file\x01name')).toBe('filename');
      expect(sanitizeFilename('file\x1fname')).toBe('filename');
    });

    it('should prevent hidden files', () => {
      expect(sanitizeFilename('.htaccess')).toBe('htaccess');
      expect(sanitizeFilename('.env')).toBe('env');
      expect(sanitizeFilename('..hidden')).toBe('hidden');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFilename('file___name')).toBe('file_name');
      expect(sanitizeFilename('file_____name')).toBe('file_name');
    });

    it('should trim leading/trailing underscores', () => {
      expect(sanitizeFilename('_filename')).toBe('filename');
      expect(sanitizeFilename('filename_')).toBe('filename');
      expect(sanitizeFilename('_filename_')).toBe('filename');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('unnamed');
      expect(sanitizeFilename('...')).toBe('unnamed');
      expect(sanitizeFilename('___')).toBe('unnamed');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe('sanitizeUrlForFilename', () => {
    it('should remove protocol', () => {
      expect(sanitizeUrlForFilename('https://example.com/page')).toBe('example.com_page');
      expect(sanitizeUrlForFilename('http://example.com/page')).toBe('example.com_page');
    });

    it('should remove trailing slashes', () => {
      expect(sanitizeUrlForFilename('example.com/page/')).toBe('example.com_page');
      expect(sanitizeUrlForFilename('example.com/page///')).toBe('example.com_page');
    });

    it('should sanitize the entire URL', () => {
      expect(sanitizeUrlForFilename('example.com/path?query=1')).toBe('example.com_path_query_1');
      expect(sanitizeUrlForFilename('example.com/page#section')).toBe('example.com_page_section');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'security-test-'));
      const testFile = join(tmpDir, 'test.txt');
      
      await writeFile(testFile, 'test content');
      
      expect(await fileExists(testFile)).toBe(true);
      
      // Cleanup
      await rmdir(tmpDir, { recursive: true });
    });

    it('should return false for non-existing files', async () => {
      expect(await fileExists('/nonexistent/path/file.txt')).toBe(false);
    });
  });

  describe('validateOutputPath', () => {
    it('should return safe path for valid filename', () => {
      const result = validateOutputPath('file.md', '/output');
      expect(result).toBe(join('/output', 'file.md'));
    });

    it('should throw PathSecurityError for traversal attempt', () => {
      expect(() => validateOutputPath('../etc/passwd', '/output')).toThrow(PathSecurityError);
      expect(() => validateOutputPath('../../../etc/passwd', '/output')).toThrow(PathSecurityError);
    });

    it('should sanitize filename before validation', () => {
      const result = validateOutputPath('file<>name.md', '/output');
      expect(result).toContain('file_name.md');
    });
  });

  describe('buildSafeOutputPath', () => {
    it('should build safe path from URL', () => {
      const result = buildSafeOutputPath('https://example.com/page', '/output', 'md');
      expect(result).toContain('example.com_page');
      expect(result).toContain('.md');
    });

    it('should throw for traversal attempt in URL', () => {
      expect(() => 
        buildSafeOutputPath('https://example.com/../../../etc/passwd', '/output', 'md')
      ).toThrow(PathSecurityError);
    });
  });

  describe('buildSafeOutputPathWithPrefix', () => {
    it('should build path with prefix', () => {
      const result = buildSafeOutputPathWithPrefix(
        'https://example.com/page',
        '/output',
        'md',
        'd0_'
      );
      expect(result).toContain('d0_');
      expect(result).toContain('example.com_page');
      expect(result).toContain('.md');
    });

    it('should sanitize prefix as well', () => {
      const result = buildSafeOutputPathWithPrefix(
        'https://example.com/page',
        '/output',
        'md',
        '../d0_'
      );
      expect(result).toContain('d0_');
      expect(result).not.toContain('..');
    });
  });

  describe('PathSecurityError', () => {
    it('should be an instance of Error', () => {
      const error = new PathSecurityError('test message');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PathSecurityError');
      expect(error.message).toBe('test message');
    });
  });
});
