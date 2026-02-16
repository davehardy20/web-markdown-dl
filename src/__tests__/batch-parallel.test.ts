import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { BatchProcessor, BatchOptions, BatchSummary } from '../batch.js';
import { groupUrlsByDomain } from '../utils/url.js';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let scrapeMock: jest.Mock;
let closeMock: jest.Mock;

jest.mock('../scraper.js', () => ({
  Scraper: jest.fn().mockImplementation(() => ({
    scrape: (...args: any[]) => scrapeMock(...args),
    close: (...args: any[]) => closeMock(...args),
  })),
}));

jest.mock('../converter.js', () => ({
  Converter: jest.fn().mockImplementation(() => ({
    convert: jest.fn().mockReturnValue('# Test Markdown'),
  })),
}));

jest.mock('../filter.js', () => ({
  ContentFilter: jest.fn().mockImplementation(() => ({
    filterWithFallback: jest.fn().mockReturnValue({
      html: '<html><body>Test</body></html>',
      metadata: { success: true, byline: null, error: null },
    }),
  })),
}));

jest.mock('../metadata.js', () => ({
  MetadataExtractor: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockReturnValue({
      title: 'Test',
      url: 'https://example.com',
      date: new Date().toISOString(),
    }),
  })),
}));

describe('Domain-Parallel Batch Processing', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'batch-parallel-test-'));
    scrapeMock = jest.fn();
    closeMock = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('Domain Grouping', () => {
    it('should group URLs by domain correctly', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://other.com/page1',
        'https://third.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
      });

      const groups = groupUrlsByDomain(urls);

      expect(groups.size).toBe(3);
      expect(groups.get('example.com')).toHaveLength(2);
      expect(groups.get('other.com')).toHaveLength(1);
      expect(groups.get('third.com')).toHaveLength(1);
    });

    it('should handle URLs with subdomains as separate domains', async () => {
      const urls = [
        'https://example.com/page1',
        'https://www.example.com/page1',
        'https://blog.example.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
      });

      const groups = groupUrlsByDomain(urls);

      expect(groups.size).toBe(3);
      expect(groups.get('example.com')).toHaveLength(1);
      expect(groups.get('www.example.com')).toHaveLength(1);
      expect(groups.get('blog.example.com')).toHaveLength(1);
    });

    it('should handle invalid URLs gracefully', async () => {
      const urls = [
        'https://example.com/page1',
        'not-a-valid-url',
        'https://other.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
      });

      const groups = groupUrlsByDomain(urls);

      expect(groups.size).toBe(2);
      expect(groups.get('example.com')).toHaveLength(1);
      expect(groups.get('other.com')).toHaveLength(1);
      expect(groups.has('unknown')).toBe(false);
    });
  });

  describe('Parallel Processing', () => {
    it('should process multiple domains in parallel', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain2.com/page1',
        'https://domain3.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockResolvedValue({
        html: '<html><body>Test</body></html>',
        url: 'https://example.com',
        statusCode: 200,
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      const startTime = Date.now();
      const result = await processor.run();
      const endTime = Date.now();

      expect(result.total).toBe(3);
      expect(result.completed).toBe(3);

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(3000);
    });

    it('should respect global concurrency limit of 5 domains', async () => {
      const urls = Array.from({ length: 7 }, (_, i) => `https://domain${i}.com/page1`);

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      let concurrentDomains = 0;
      let maxConcurrentDomains = 0;
      const activeDomains = new Set<string>();

      scrapeMock.mockImplementation((url: string) => {
        const domain = new URL(url).hostname;
        activeDomains.add(domain);
        concurrentDomains = activeDomains.size;
        maxConcurrentDomains = Math.max(maxConcurrentDomains, concurrentDomains);

        return new Promise((resolve) => {
          setTimeout(() => {
            activeDomains.delete(domain);
            resolve({
              html: '<html><body>Test</body></html>',
              url,
              statusCode: 200,
            });
          }, 50);
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      await processor.run();

      expect(maxConcurrentDomains).toBeLessThanOrEqual(5);
      expect(maxConcurrentDomains).toBeGreaterThan(1);
    });

    it('should process URLs within the same domain sequentially', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const scrapeOrder: string[] = [];
      const scrapeStartTimes = new Map<string, number>();

      scrapeMock.mockImplementation((url: string) => {
        scrapeStartTimes.set(url, Date.now());

        return new Promise((resolve) => {
          setTimeout(() => {
            scrapeOrder.push(url);
            resolve({
              html: '<html><body>Test</body></html>',
              url,
              statusCode: 200,
            });
          }, 50);
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      await processor.run();

      expect(scrapeOrder).toHaveLength(3);
      expect(scrapeOrder[0]).toBe('https://example.com/page1');
      expect(scrapeOrder[1]).toBe('https://example.com/page2');
      expect(scrapeOrder[2]).toBe('https://example.com/page3');

      const start1 = scrapeStartTimes.get('https://example.com/page1')!;
      const start2 = scrapeStartTimes.get('https://example.com/page2')!;
      const start3 = scrapeStartTimes.get('https://example.com/page3')!;

      expect(start2).toBeGreaterThanOrEqual(start1 + 45);
      expect(start3).toBeGreaterThanOrEqual(start2 + 45);
    });
  });

  describe('Per-Domain Rate Limiting', () => {
    it('should apply delay between URLs within the same domain', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const scrapeTimestamps: number[] = [];

      scrapeMock.mockImplementation(() => {
        scrapeTimestamps.push(Date.now());
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url: 'https://example.com/page1',
          statusCode: 200,
        });
      });

      const delay = 200;
      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay,
      });

      await processor.run();

      expect(scrapeTimestamps.length).toBe(2);
      const timeDiff = scrapeTimestamps[1]! - scrapeTimestamps[0]!;
      expect(timeDiff).toBeGreaterThanOrEqual(delay - 10);
    });

    it('should NOT apply delay between different domains', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain2.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const scrapeStartTimes = new Map<string, number>();

      scrapeMock.mockImplementation((url: string) => {
        scrapeStartTimes.set(url, Date.now());
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 500,
      });

      const startTime = Date.now();
      await processor.run();
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(400);
    });
  });

  describe('Progress Callbacks', () => {
    it('should call progress callback for each URL processed', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain2.com/page1',
        'https://domain3.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockResolvedValue({
        html: '<html><body>Test</body></html>',
        url: 'https://example.com',
        statusCode: 200,
      });

      const progressCalls: Array<{ current: number; total: number; url: string }> = [];

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      processor.onProgress((current, total, url) => {
        progressCalls.push({ current, total, url });
      });

      await processor.run();

      expect(progressCalls.length).toBe(3);

      progressCalls.forEach((call) => {
        expect(call.total).toBe(3);
      });

      expect(progressCalls[0]!.current).toBe(1);
      expect(progressCalls[1]!.current).toBe(2);
      expect(progressCalls[2]!.current).toBe(3);
    });

    it('should call error callback for failed URLs', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain2.com/page1',
        'https://domain3.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockImplementation((url: string) => {
        if (url.includes('domain2')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const errorCalls: Array<{ url: string; error: string }> = [];

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      processor.onError((url, error) => {
        errorCalls.push({ url, error });
      });

      const result = await processor.run();

      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0]!.url).toBe('https://domain2.com/page1');
      expect(errorCalls[0]!.error).toContain('Network error');

      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
    });
  });

  describe('Mixed Success/Failure Handling', () => {
    it('should continue processing other domains when one domain fails completely', async () => {
      const urls = [
        'https://fail-domain.com/page1',
        'https://fail-domain.com/page2',
        'https://success-domain.com/page1',
        'https://success-domain.com/page2',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockImplementation((url: string) => {
        if (url.includes('fail-domain')) {
          return Promise.reject(new Error('Domain unreachable'));
        }
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      const result = await processor.run();

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.failures).toHaveLength(2);

      result.failures.forEach((failure) => {
        expect(failure.url).toContain('fail-domain');
        expect(failure.error).toContain('Domain unreachable');
      });
    });

    it('should continue processing when one URL in a domain fails', async () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockImplementation((url: string) => {
        if (url.includes('page2')) {
          return Promise.reject(new Error('Page not found'));
        }
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      const result = await processor.run();

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.failures[0]!.url).toBe('https://example.com/page2');
    });

    it('should handle partial failures in parallel domain processing', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain2.com/page1',
        'https://domain3.com/page1',
        'https://domain4.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockImplementation((url: string) => {
        if (url.includes('domain1') || url.includes('domain3')) {
          return Promise.reject(new Error('Server error'));
        }
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      const result = await processor.run();

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(2);

      const failureUrls = result.failures.map((f) => f.url);
      expect(failureUrls).toContain('https://domain1.com/page1');
      expect(failureUrls).toContain('https://domain3.com/page1');
    });
  });

  describe('Batch Summary Merging', () => {
    it('should correctly merge summaries from multiple domains', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain1.com/page2',
        'https://domain2.com/page1',
        'https://domain3.com/page1',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      scrapeMock.mockImplementation((url: string) => {
        if (url.includes('page2') || url.includes('domain3')) {
          return Promise.reject(new Error('Error'));
        }
        return Promise.resolve({
          html: '<html><body>Test</body></html>',
          url,
          statusCode: 200,
        });
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay: 0,
      });

      const result = await processor.run();

      expect(result.total).toBe(4);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.failures).toHaveLength(2);

      const failureUrls = result.failures.map((f) => f.url);
      expect(failureUrls).toContain('https://domain1.com/page2');
      expect(failureUrls).toContain('https://domain3.com/page1');
    });
  });

  describe('Performance Verification', () => {
    it('should complete multi-domain batch in less than 40% of sequential time', async () => {
      const urls = [
        'https://domain1.com/page1',
        'https://domain1.com/page2',
        'https://domain2.com/page1',
        'https://domain2.com/page2',
        'https://domain3.com/page1',
        'https://domain3.com/page2',
      ];

      const inputFile = join(tempDir, 'urls.txt');
      await writeFile(inputFile, urls.join('\n'));

      const delay = 50;

      scrapeMock.mockResolvedValue({
        html: '<html><body>Test</body></html>',
        url: 'https://example.com',
        statusCode: 200,
      });

      const processor = new BatchProcessor({
        inputFile,
        outputDir: tempDir,
        delay,
      });

      const parallelStart = Date.now();
      await processor.run();
      const parallelTime = Date.now() - parallelStart;

      const sequentialTime = urls.length * delay;
      const maxExpectedTime = sequentialTime * 0.4;

      expect(parallelTime).toBeLessThan(maxExpectedTime);
    });
  });
});
