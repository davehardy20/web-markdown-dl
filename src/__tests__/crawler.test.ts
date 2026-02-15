import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  Crawler,
  normalizeUrl,
  extractDomain,
  resolveUrl,
  isSameDomain,
  extractLinks,
  DEFAULT_CRAWL_OPTIONS,
  formatCrawlResult,
  type CrawlOptions,
  type CrawlResult,
} from '../crawler';

class MockTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

mock.module('playwright', () => {
  const mockPage = {
    goto: mock(() => Promise.resolve({ status: () => 200 })),
    content: mock(() => Promise.resolve('<html><body><a href="/page1">Link 1</a><a href="https://other.com/page2">Link 2</a></body></html>')),
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

describe('normalizeUrl', () => {
  it('should remove fragment from URL', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('should sort query parameters', () => {
    expect(normalizeUrl('https://example.com/page?b=2&a=1')).toBe('https://example.com/page?a=1&b=2');
  });

  it('should remove trailing slash (except root)', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('should handle multiple query params with same key', () => {
    const normalized = normalizeUrl('https://example.com?b=1&a=2&a=1');
    expect(normalized).toBe('https://example.com/?a=2&a=1&b=1');
  });

  it('should return original URL on parse error', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('should handle URLs with no path', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });
});

describe('extractDomain', () => {
  it('should extract domain from URL', () => {
    expect(extractDomain('https://example.com/page')).toBe('example.com');
  });

  it('should extract domain with subdomain', () => {
    expect(extractDomain('https://sub.example.com/page')).toBe('sub.example.com');
  });

  it('should return null for invalid URL', () => {
    expect(extractDomain('not-a-url')).toBe(null);
  });

  it('should handle URLs with port', () => {
    expect(extractDomain('https://example.com:8080/page')).toBe('example.com');
  });
});

describe('resolveUrl', () => {
  it('should resolve relative URL', () => {
    expect(resolveUrl('https://example.com/page', '/other')).toBe('https://example.com/other');
  });

  it('should resolve relative URL without leading slash', () => {
    expect(resolveUrl('https://example.com/page/', 'other')).toBe('https://example.com/page/other');
  });

  it('should return absolute URL unchanged', () => {
    expect(resolveUrl('https://example.com/page', 'https://other.com/page')).toBe('https://other.com/page');
  });

  it('should return null for non-http protocols', () => {
    expect(resolveUrl('https://example.com/page', 'mailto:test@example.com')).toBe(null);
    expect(resolveUrl('https://example.com/page', 'javascript:alert(1)')).toBe(null);
  });

  it('should return null for invalid URLs', () => {
    expect(resolveUrl('not-a-url', '/path')).toBe(null);
  });
});

describe('isSameDomain', () => {
  it('should return true for same domain', () => {
    expect(isSameDomain('https://example.com/page1', 'https://example.com/page2')).toBe(true);
  });

  it('should return false for different domains', () => {
    expect(isSameDomain('https://example.com/page1', 'https://other.com/page2')).toBe(false);
  });

  it('should return false for different subdomains', () => {
    expect(isSameDomain('https://example.com/page', 'https://sub.example.com/page')).toBe(false);
  });

  it('should handle invalid URLs', () => {
    expect(isSameDomain('not-a-url', 'https://example.com')).toBe(false);
  });
});

describe('extractLinks', () => {
  it('should extract all links from HTML', () => {
    const html = '<html><body><a href="/page1">Link 1</a><a href="/page2">Link 2</a></body></html>';
    const links = extractLinks(html, 'https://example.com');
    
    expect(links).toHaveLength(2);
    expect(links).toContain('https://example.com/page1');
    expect(links).toContain('https://example.com/page2');
  });

  it('should resolve relative URLs', () => {
    const html = '<html><body><a href="relative">Link</a></body></html>';
    const links = extractLinks(html, 'https://example.com/page/');
    
    expect(links).toContain('https://example.com/page/relative');
  });

  it('should ignore non-http links', () => {
    const html = '<html><body><a href="mailto:test@example.com">Email</a><a href="javascript:void(0)">JS</a></body></html>';
    const links = extractLinks(html, 'https://example.com');
    
    expect(links).toHaveLength(0);
  });

  it('should return empty array for invalid HTML', () => {
    const links = extractLinks('', 'https://example.com');
    expect(links).toEqual([]);
  });

  it('should handle anchors without href', () => {
    const html = '<html><body><a>Link</a><a href="">Empty</a></body></html>';
    const links = extractLinks(html, 'https://example.com');
    
    expect(links).toHaveLength(0);
  });
});

describe('DEFAULT_CRAWL_OPTIONS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_CRAWL_OPTIONS.maxDepth).toBe(2);
    expect(DEFAULT_CRAWL_OPTIONS.limit).toBe(100);
    expect(DEFAULT_CRAWL_OPTIONS.delay).toBe(1000);
    expect(DEFAULT_CRAWL_OPTIONS.respectRobots).toBe(true);
    expect(DEFAULT_CRAWL_OPTIONS.stayWithinDomain).toBe(true);
    expect(DEFAULT_CRAWL_OPTIONS.format).toBe('markdown');
    expect(DEFAULT_CRAWL_OPTIONS.filter).toBe(true);
    expect(DEFAULT_CRAWL_OPTIONS.timeout).toBe(30000);
  });
});

describe('formatCrawlResult', () => {
  it('should format successful crawl result', () => {
    const result: CrawlResult = {
      crawled: 5,
      failed: 0,
      urls: ['url1', 'url2', 'url3', 'url4', 'url5'],
      pages: [],
      failures: [],
    };
    
    const formatted = formatCrawlResult(result);
    
    expect(formatted).toContain('Crawled: 5');
    expect(formatted).toContain('Failed: 0');
    expect(formatted).toContain('Total URLs: 5');
  });

  it('should format result with failures', () => {
    const result: CrawlResult = {
      crawled: 3,
      failed: 2,
      urls: ['url1', 'url2', 'url3', 'url4', 'url5'],
      pages: [],
      failures: [
        { url: 'https://fail1.com', error: 'Timeout' },
        { url: 'https://fail2.com', error: 'Network error' },
      ],
    };
    
    const formatted = formatCrawlResult(result);
    
    expect(formatted).toContain('Failed URLs:');
    expect(formatted).toContain('https://fail1.com');
    expect(formatted).toContain('Timeout');
  });
});

describe('Crawler', () => {
  let crawler: Crawler;

  beforeEach(() => {
    crawler = new Crawler({
      startUrl: 'https://example.com',
      maxDepth: 1,
      limit: 5,
      delay: 0,
    });
  });

  afterEach(async () => {
    await crawler.close();
  });

  describe('constructor', () => {
    it('should use default options when partial options provided', () => {
      const partialCrawler = new Crawler({ startUrl: 'https://example.com' });
      expect(partialCrawler).toBeDefined();
    });

    it('should accept custom options', () => {
      const customCrawler = new Crawler({
        startUrl: 'https://example.com',
        maxDepth: 3,
        limit: 50,
        delay: 500,
        respectRobots: false,
        stayWithinDomain: false,
      });
      expect(customCrawler).toBeDefined();
    });
  });

  describe('onProgress', () => {
    it('should accept progress callback', () => {
      crawler.onProgress((current, total, url, depth) => {
        expect(current).toBeDefined();
        expect(total).toBeDefined();
        expect(url).toBeDefined();
        expect(depth).toBeDefined();
      });
    });
  });

  describe('onError', () => {
    it('should accept error callback', () => {
      crawler.onError((url, error) => {
        expect(url).toBeDefined();
        expect(error).toBeDefined();
      });
    });
  });

  describe('close', () => {
    it('should be safe to call close multiple times', async () => {
      await crawler.close();
      await crawler.close();
    });
  });
});
