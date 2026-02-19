import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Scraper } from '../scraper';
import { unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

class MockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const testLogDir = join(tmpdir(), 'web-markdown-dl-verbose-test');
const testLogFile = join(testLogDir, 'test.log');

const eventListenersCalled: string[] = [];

mock.module('playwright', () => {
  const mockPage = {
    goto: mock(() => Promise.resolve({ 
      status: () => 200,
      headers: () => ({ 'content-length': '100', 'content-type': 'text/html' }),
    })),
    content: mock(() => Promise.resolve('<html><body>Test</body></html>')),
    url: mock(() => 'https://example.com'),
    title: mock(() => Promise.resolve('Test Page')),
    close: mock(() => Promise.resolve(undefined)),
    on: mock((event: string) => {
      eventListenersCalled.push(event);
    }),
  };

  const mockContext = {
    newPage: mock(() => Promise.resolve(mockPage)),
    close: mock(() => Promise.resolve(undefined)),
    pages: mock(() => []),
    clearCookies: mock(() => Promise.resolve()),
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
    Request: mock(),
    Response: mock(),
  };
});

describe('Scraper Verbose Logging', () => {
  let scraper: Scraper;

  beforeEach(() => {
    eventListenersCalled.length = 0;
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true });
    }
    if (existsSync(testLogFile)) {
      unlinkSync(testLogFile);
    }
  });

  afterEach(async () => {
    if (scraper) {
      await scraper.close();
    }
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('verbose option', () => {
    it('should not attach event listeners when verbose is false', async () => {
      scraper = new Scraper({ verbose: false });
      await scraper.scrape('https://example.com');
      expect(eventListenersCalled).not.toContain('request');
      expect(eventListenersCalled).not.toContain('response');
    });

    it('should attach request and response event listeners when verbose is true', async () => {
      scraper = new Scraper({ verbose: true, logFile: testLogFile });
      await scraper.scrape('https://example.com');
      expect(eventListenersCalled).toContain('request');
      expect(eventListenersCalled).toContain('response');
    });
  });

  describe('logFile option', () => {
    it('should write logs to file when logFile is specified', async () => {
      scraper = new Scraper({ verbose: true, logFile: testLogFile });
      await scraper.scrape('https://example.com');
      
      expect(existsSync(testLogFile)).toBe(true);
      const logContent = require('fs').readFileSync(testLogFile, 'utf-8');
      expect(logContent.length).toBeGreaterThan(0);
    });
  });
});
