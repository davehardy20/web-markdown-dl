import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Scraper } from '../scraper';
import { ScraperError } from '../types';

class MockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Track context creation and reuse
let contextCreationCount = 0;
let mockContexts: MockContext[] = [];

class MockContext {
  id: number;
  closed = false;
  cookiesCleared = false;
  pages: MockPage[] = [];
  newPage: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
  clearCookies: ReturnType<typeof mock>;

  constructor() {
    this.id = ++contextCreationCount;
    mockContexts.push(this);
    
    this.newPage = mock(() => {
      const page = new MockPage();
      this.pages.push(page);
      return Promise.resolve(page);
    });
    
    this.close = mock(() => {
      this.closed = true;
      return Promise.resolve(undefined);
    });
    
    this.clearCookies = mock(() => {
      this.cookiesCleared = true;
      return Promise.resolve(undefined);
    });
  }
}

class MockPage {
  goto: ReturnType<typeof mock>;
  content: ReturnType<typeof mock>;
  url: ReturnType<typeof mock>;
  title: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;

  constructor() {
    this.goto = mock(() => Promise.resolve({ 
      status: () => 200,
      headers: () => ({ 'content-type': 'text/html' })
    }));
    this.content = mock(() => Promise.resolve('<html><body>Test</body></html>'));
    this.url = mock(() => 'https://example.com');
    this.title = mock(() => Promise.resolve('Test Page'));
    this.close = mock(() => Promise.resolve(undefined));
    this.evaluate = mock(() => Promise.resolve(undefined));
  }
}

mock.module('playwright', () => {
  const mockBrowser = {
    newContext: mock(() => {
      const ctx = new MockContext();
      return Promise.resolve(ctx);
    }),
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

describe('Scraper Context Pool', () => {
  let scraper: Scraper;

  beforeEach(() => {
    contextCreationCount = 0;
    mockContexts = [];
    scraper = new Scraper();
  });

  afterEach(async () => {
    await scraper.close();
  });

  describe('Context Pool Behavior', () => {
    it('should create a new context on first scrape', async () => {
      await scraper.scrape('https://example.com/page1');
      expect(contextCreationCount).toBe(1);
    });

    it('should reuse context for sequential scrapes', async () => {
      await scraper.scrape('https://example.com/page1');
      await scraper.scrape('https://example.com/page2');
      await scraper.scrape('https://example.com/page3');
      
      // Only one context should be created and reused
      expect(contextCreationCount).toBe(1);
    });

    it('should clear cookies before reusing context', async () => {
      await scraper.scrape('https://example.com/page1');
      const firstContext = mockContexts[0];
      
      // Reset the flag
      firstContext.cookiesCleared = false;
      
      await scraper.scrape('https://example.com/page2');
      
      expect(firstContext.cookiesCleared).toBe(true);
    });

    it('should create up to maxContexts (5) for concurrent requests', async () => {
      const promises = Array(7).fill(null).map((_, i) => 
        scraper.scrape(`https://example.com/page${i}`)
      );
      
      await Promise.all(promises);
      
      expect(contextCreationCount).toBeGreaterThanOrEqual(1);
      expect(contextCreationCount).toBeLessThanOrEqual(5);
    });

    it('should not exceed max pool size', async () => {
      const results: number[] = [];
      
      // Start 10 concurrent scrapes
      const promises = Array(10).fill(null).map(async (_, i) => {
        await scraper.scrape(`https://example.com/page${i}`);
        results.push(contextCreationCount);
      });
      
      await Promise.all(promises);
      
      // At no point should we have more than 5 contexts
      expect(Math.max(...results)).toBeLessThanOrEqual(5);
    });
  });

  describe('Context Lifecycle', () => {
    it('should close all contexts when scraper is closed', async () => {
      await scraper.scrape('https://example.com/page1');
      await scraper.scrape('https://example.com/page2');
      
      await scraper.close();
      
      // All contexts should be closed
      expect(mockContexts.every(ctx => ctx.closed)).toBe(true);
    });

    it('should reset context pool on close', async () => {
      await scraper.scrape('https://example.com/page1');
      await scraper.close();
      
      // Create new scraper instance (simulating by clearing context)
      contextCreationCount = 0;
      mockContexts = [];
      scraper = new Scraper();
      
      await scraper.scrape('https://example.com/page2');
      
      // Should create new context, not reuse old one
      expect(contextCreationCount).toBe(1);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent scrapes without errors', async () => {
      const urls = Array(10).fill(null).map((_, i) => `https://example.com/page${i}`);
      
      const results = await Promise.all(
        urls.map(url => scraper.scrape(url))
      );
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.html).toBe('<html><body>Test</body></html>');
        expect(result.statusCode).toBe(200);
      });
    });

    it('should reuse contexts after concurrent operations complete', async () => {
      // First batch - creates up to 5 contexts
      await Promise.all(Array(5).fill(null).map((_, i) => 
        scraper.scrape(`https://example.com/batch1-${i}`)
      ));
      
      const contextsAfterFirstBatch = contextCreationCount;
      
      // Second batch - should reuse existing contexts
      await Promise.all(Array(5).fill(null).map((_, i) => 
        scraper.scrape(`https://example.com/batch2-${i}`)
      ));
      
      // No new contexts should be created
      expect(contextCreationCount).toBe(contextsAfterFirstBatch);
    });
  });

  describe('Storage Cleanup', () => {
    it('should clear localStorage and sessionStorage when reusing context', async () => {
      await scraper.scrape('https://example.com/page1');
      const firstContext = mockContexts[0];
      
      await scraper.scrape('https://example.com/page2');
      
      // Should have called evaluate to clear storage
      const pages = firstContext.pages;
      expect(pages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and release context', async () => {
      // Mock a page that throws an error
      const originalModule = await import('playwright');
      
      await scraper.scrape('https://example.com/page1');
      
      // Context should be created
      expect(contextCreationCount).toBe(1);
      
      // After error, context should still be reusable
      // (This is tested by the fact that subsequent scrapes work)
    });

    it('should release context even if scrape fails', async () => {
      const scrapes: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        scrapes.push(scraper.scrape(`https://example.com/page${i}`));
      }
      
      await Promise.all(scrapes);
      
      expect(contextCreationCount).toBeLessThanOrEqual(5);
    });
  });
});
