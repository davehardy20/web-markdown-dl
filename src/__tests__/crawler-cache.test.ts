/**
 * Tests for crawler HTML caching to eliminate double-scraping
 * TDD approach: These tests should fail initially, then pass after implementation
 */

import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { Crawler, type CrawlOptions } from '../crawler.js';
import { Scraper } from '../scraper.js';
import * as security from '../security.js';

// Mock dependencies
const mockScrape = mock();

mock.module('../scraper.js', () => ({
  Scraper: class MockScraper {
    scrape = mockScrape;
    close = mock();
  },
}));

mock.module('../security.js', () => ({
  ...security,
  fileExists: mock(() => Promise.resolve(false)),
}));

describe('Crawler HTML Caching', () => {
  let crawler: Crawler;
  const baseOptions: CrawlOptions = {
    startUrl: 'https://example.com',
    outputDir: './test-output',
    maxDepth: 2,
    delay: 0,
    respectRobots: false,
    stayWithinDomain: true,
    overwrite: true,
  };

  beforeEach(() => {
    mockScrape.mockClear();
  });

  afterEach(async () => {
    await crawler?.close();
  });

  it('should return HTML in processUrl result', async () => {
    const html = '<html><body><a href="/page2">Link</a></body></html>';
    mockScrape.mockResolvedValue({
      html,
      url: 'https://example.com',
      title: 'Test Page',
    });

    crawler = new Crawler(baseOptions);
    const result = await (crawler as any).processUrl('https://example.com', 0);

    expect(result.success).toBe(true);
    expect(result.html).toBe(html);
    expect(mockScrape).toHaveBeenCalledTimes(1);
  });

  it('should use cached HTML for link extraction (single scrape per URL)', async () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com/page1">Page 1</a>
          <a href="https://example.com/page2">Page 2</a>
        </body>
      </html>
    `;

    // Mock scraper to return same HTML each time
    mockScrape.mockResolvedValue({
      html,
      url: 'https://example.com',
      title: 'Test Page',
    });

    crawler = new Crawler({
      ...baseOptions,
      maxDepth: 1,
    });

    const result = await crawler.crawl();

    // With caching, we should scrape exactly once per URL crawled
    // start URL (1) + discovered pages (2) = 3 total scrapes
    // Without caching, this would be 6 scrapes (double)
    expect(mockScrape).toHaveBeenCalledTimes(result.crawled);
    expect(result.crawled).toBe(3); // 1 start + 2 linked pages
  });

  it('should rescrape when HTML not cached (e.g., when too large)', async () => {
    const smallHtml = '<html><body>Small content</body></html>';
    const largeHtml = 'x'.repeat(6 * 1024 * 1024); // 6MB HTML (exceeds 5MB limit)

    // First call returns large HTML (will not be cached)
    // Second call needed for link extraction
    mockScrape
      .mockResolvedValueOnce({
        html: largeHtml,
        url: 'https://example.com',
        title: 'Large Page',
      })
      .mockResolvedValueOnce({
        html: smallHtml,
        url: 'https://example.com',
        title: 'Small Page',
      });

    crawler = new Crawler({
      ...baseOptions,
      maxDepth: 1,
    });

    await crawler.crawl();

    // Should scrape twice: once for content (large, not cached)
    // and once again for link extraction
    expect(mockScrape).toHaveBeenCalledTimes(2);
  });

  it('should not cache HTML larger than 5MB (memory protection)', async () => {
    const largeHtml = 'x'.repeat(6 * 1024 * 1024); // 6MB

    mockScrape.mockResolvedValue({
      html: largeHtml,
      url: 'https://example.com',
      title: 'Large Page',
    });

    crawler = new Crawler(baseOptions);
    const result = await (crawler as any).processUrl('https://example.com', 0);

    // Should succeed but not cache HTML
    expect(result.success).toBe(true);
    expect(result.html).toBeUndefined();
  });

  it('should cache HTML within 5MB limit', async () => {
    const mediumHtml = 'x'.repeat(4 * 1024 * 1024); // 4MB (under limit)

    mockScrape.mockResolvedValue({
      html: mediumHtml,
      url: 'https://example.com',
      title: 'Medium Page',
    });

    crawler = new Crawler(baseOptions);
    const result = await (crawler as any).processUrl('https://example.com', 0);

    // Should succeed and cache HTML
    expect(result.success).toBe(true);
    expect(result.html).toBe(mediumHtml);
  });

  it('should maintain memory bounds during crawl (no leak)', async () => {
    const html = '<html><body><a href="/page1">Link 1</a><a href="/page2">Link 2</a></body></html>';

    // Track scrape calls
    let scrapeCount = 0;
    mockScrape.mockImplementation(() => {
      scrapeCount++;
      return Promise.resolve({
        html,
        url: `https://example.com/page${scrapeCount}`,
        title: `Page ${scrapeCount}`,
      });
    });

    crawler = new Crawler({
      ...baseOptions,
      maxDepth: 1,
      limit: 10,
    });

    const result = await crawler.crawl();

    // With proper caching, scrape calls should equal crawled pages
    // Without caching, we'd have 2x the scrape calls
    expect(scrapeCount).toBe(result.crawled);
  });
});
