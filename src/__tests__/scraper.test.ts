import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Scraper } from '../scraper';
import { ScraperError } from '../types';

class MockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

mock.module('playwright', () => {
  const mockPage = {
    goto: mock(() => Promise.resolve({ status: () => 200 })),
    content: mock(() => Promise.resolve('<html><body>Test</body></html>')),
    url: mock(() => 'https://example.com'),
    title: mock(() => Promise.resolve('Test Page')),
    close: mock(() => Promise.resolve(undefined)),
  };

  const mockContext = {
    newPage: mock(() => Promise.resolve(mockPage)),
    close: mock(() => Promise.resolve(undefined)),
  };

  const mockBrowser = {
    newContext: mock(() => Promise.resolve(mockContext)),
    close: mock(() => Promise.resolve(undefined)),
  };

  return {
    chromium: {
      launch: mock(() => Promise.resolve(mockBrowser)),
    },
    errors: {
      TimeoutError: MockTimeoutError,
    },
    Browser: mock(),
    BrowserContext: mock(),
    Page: mock(),
  };
});

describe('Scraper', () => {
  let scraper: Scraper;

  beforeEach(() => {
    scraper = new Scraper();
  });

  afterEach(async () => {
    await scraper.close();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const defaultScraper = new Scraper();
      expect(defaultScraper).toBeDefined();
    });

    it('should accept custom options', () => {
      const customScraper = new Scraper({
        timeout: 5000,
        userAgent: 'custom-agent/1.0',
        waitUntil: 'load',
      });
      expect(customScraper).toBeDefined();
    });
  });

  describe('scrape', () => {
    it('should successfully scrape a URL and return result', async () => {
      const result = await scraper.scrape('https://example.com');

      expect(result.html).toBe('<html><body>Test</body></html>');
      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('close', () => {
    it('should be safe to call close multiple times', async () => {
      await scraper.close();
      await scraper.close();
    });
  });
});

describe('ScraperError', () => {
  it('should create error with correct properties', () => {
    const error = new ScraperError('Test error', 'timeout', 'https://example.com');
    
    expect(error.message).toBe('Test error');
    expect(error.type).toBe('timeout');
    expect(error.url).toBe('https://example.com');
    expect(error.name).toBe('ScraperError');
  });

  it('should create error with cause', () => {
    const cause = new Error('Original error');
    const error = new ScraperError('Test error', 'network', 'https://example.com', cause);
    
    expect(error.cause).toBe(cause);
  });

  it('should create from timeout error', () => {
    const originalError = new Error('Timeout');
    const error = ScraperError.fromTimeoutError(originalError, 'https://example.com');
    
    expect(error.type).toBe('timeout');
    expect(error.url).toBe('https://example.com');
  });

  it('should create from network error', () => {
    const originalError = new Error('Connection refused');
    const error = ScraperError.fromNetworkError(originalError, 'https://example.com');
    
    expect(error.type).toBe('network');
    expect(error.url).toBe('https://example.com');
  });

  it('should create from navigation error', () => {
    const originalError = new Error('Failed to navigate');
    const error = ScraperError.fromNavigationError(originalError, 'https://example.com');
    
    expect(error.type).toBe('navigation');
    expect(error.url).toBe('https://example.com');
  });

  it('should create from browser error', () => {
    const originalError = new Error('Browser crashed');
    const error = ScraperError.fromBrowserError(originalError);
    
    expect(error.type).toBe('browser');
    expect(error.url).toBeUndefined();
  });
});
