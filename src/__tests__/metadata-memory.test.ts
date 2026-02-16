import { describe, it, expect, beforeEach } from 'bun:test';
import { MetadataExtractor } from '../metadata.js';
import * as fs from 'fs';
import * as path from 'path';

describe('MetadataExtractor Memory Management', () => {
  let extractor: MetadataExtractor;
  
  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  describe('window.close() cleanup', () => {
    it('should extract metadata successfully and close window', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body><p>Test Content</p></body>
        </html>
      `;
      
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.title).toBe('Test Page');
      expect(result.url).toBe('https://example.com');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle malformed HTML without throwing', () => {
      const html = '<html><body>Test</body>';
      
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result).toBeDefined();
      expect(result.url).toBe('https://example.com');
    });

    it('should have try-finally pattern with window.close() in source', () => {
      const sourcePath = path.join(__dirname, '..', 'metadata.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      
      expect(source).toContain('try {');
      expect(source).toContain('} finally {');
      expect(source).toContain('dom.window.close()');
      expect(source.match(/try\s*\{/g)?.length).toBe(1);
      expect(source.match(/finally\s*\{/g)?.length).toBe(1);
      expect(source.match(/dom\.window\.close\(\)/g)?.length).toBe(1);
    });
  });
});
