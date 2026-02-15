import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  isValidUrl,
  createScrapingResult,
  runCli,
  CliOptions,
} from '../cli';
import type { Metadata } from '../types';

mock.module('../scraper.js', () => {
  const Scraper = class {
    async scrape(url: string) {
      return {
        html: '<html><head><title>Test</title></head><body><h1>Hello World</h1><p>Test content.</p></body></html>',
        url: url,
        title: 'Test Page',
        statusCode: 200,
      };
    }
    async close() {}
  };

  return { Scraper };
});

describe('isValidUrl', () => {
  it('should return true for valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('should return true for valid https URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('should return true for URL with path', () => {
    expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
  });

  it('should return true for URL with query string', () => {
    expect(isValidUrl('https://example.com?query=value')).toBe(true);
  });

  it('should return false for invalid URL', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
  });

  it('should return false for ftp URL', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should return false for file URL', () => {
    expect(isValidUrl('file:///path/to/file')).toBe(false);
  });
});

describe('createScrapingResult', () => {
  it('should create ScrapingResult with all fields', () => {
    const metadata: Metadata = {
      url: 'https://example.com',
      title: 'Test Page',
      timestamp: '2024-01-01T00:00:00.000Z',
      headings: [],
      links: [],
      wordCount: 10,
      contentType: 'text/html',
    };

    const result = createScrapingResult(
      '# Test Page\n\nContent here.',
      metadata,
      '<html></html>'
    );

    expect(result.markdown).toBe('# Test Page\n\nContent here.');
    expect(result.metadata.url).toBe('https://example.com');
    expect(result.metadata.title).toBe('Test Page');
    expect(result.html).toBe('<html></html>');
  });

  it('should work without optional html parameter', () => {
    const metadata: Metadata = {
      url: 'https://example.com',
      title: 'Test',
      timestamp: '2024-01-01T00:00:00.000Z',
      headings: [],
      links: [],
      wordCount: 5,
      contentType: 'text/html',
    };

    const result = createScrapingResult('content', metadata);

    expect(result.markdown).toBe('content');
    expect(result.metadata.title).toBe('Test');
    expect(result.html).toBeUndefined();
  });
});

describe('runCli', () => {
  const defaultOptions: CliOptions = {
    url: 'https://example.com',
    format: 'markdown',
    timeout: 30000,
  };

  it('should return error when URL is missing', async () => {
    const result = await runCli({
      ...defaultOptions,
      url: '',
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('URL is required');
  });

  it('should return error for invalid URL', async () => {
    const result = await runCli({
      ...defaultOptions,
      url: 'not-a-valid-url',
    });

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain('Invalid URL');
  });

  it('should successfully process valid URL', async () => {
    const result = await runCli(defaultOptions);

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.content).toBeDefined();
  });

  it('should return markdown content by default', async () => {
    const result = await runCli(defaultOptions);

    expect(result.success).toBe(true);
    expect(result.content).toContain('Hello World');
  });

  it('should return JSON when format is json', async () => {
    const result = await runCli({
      ...defaultOptions,
      format: 'json',
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();

    const parsed = JSON.parse(result.content!);
    expect(parsed.markdown).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.url).toBe('https://example.com');
    expect(parsed.metadata.title).toBeDefined();
    expect(parsed.metadata.timestamp).toBeDefined();
    expect(parsed.metadata.headings).toBeDefined();
    expect(parsed.metadata.links).toBeDefined();
    expect(parsed.metadata.wordCount).toBeDefined();
    expect(parsed.metadata.contentType).toBeDefined();
  });
});
