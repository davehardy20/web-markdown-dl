/**
 * Depth-limited web crawler with domain restrictions and robots.txt support
 */

import { mkdir } from 'fs/promises';
import { JSDOM } from 'jsdom';
import robotsParser from 'robots-parser';
import { Scraper } from './scraper.js';
import { Converter } from './converter.js';
import { ContentFilter } from './filter.js';
import { MetadataExtractor } from './metadata.js';
import { ScraperError, type Metadata, type ScrapingResult } from './types.js';
import { sanitizeUrlForFilename, isPathSafe, PathSecurityError, fileExists } from './security.js';
import { FileWriter } from './utils/file-writer.js';
import { UrlProcessor } from './utils/url-processor.js';
import { normalizeUrl, extractDomain } from './utils/url.js';

/**
 * Configuration options for the crawler
 */
export interface CrawlOptions {
  /** Starting URL for the crawl */
  startUrl: string;
  /** Maximum crawl depth (0 = only startUrl, 1 = startUrl + direct links, etc.) */
  maxDepth?: number;
  /** Maximum number of URLs to crawl */
  limit?: number;
  /** Delay between requests in milliseconds */
  delay?: number;
  /** Whether to respect robots.txt */
  respectRobots?: boolean;
  /** Whether to stay within the original domain */
  stayWithinDomain?: boolean;
  /** Output directory for saved files */
  outputDir?: string;
  /** Output format: markdown or json */
  format?: 'markdown' | 'json';
  /** Enable content filtering */
  filter?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** User agent to use for robots.txt checks (defaults to userAgent) */
  robotsUserAgent?: string;
  /** Overwrite existing files without warning */
  overwrite?: boolean;
}

/**
 * Default crawler options
 */
export const DEFAULT_CRAWL_OPTIONS: Required<Omit<CrawlOptions, 'startUrl'>> = {
  maxDepth: 2,
  limit: 100,
  delay: 1000,
  respectRobots: true,
  stayWithinDomain: true,
  outputDir: './crawl-output',
  format: 'markdown',
  filter: true,
  timeout: 30000,
  userAgent: 'web-markdown-dl/1.0',
  robotsUserAgent: 'web-markdown-dl/1.0',
  overwrite: false,
};

/**
 * Result of crawling a single URL
 */
export interface CrawledPage {
  /** The URL that was crawled */
  url: string;
  /** The depth at which this URL was found */
  depth: number;
  /** Whether the crawl succeeded */
  success: boolean;
  /** Error message if crawl failed */
  error?: string;
  /** Output file path (if saved) */
  outputFile?: string;
  /** Raw HTML content (cached for link extraction, max 5MB) */
  html?: string;
}

/**
 * Summary of the crawl
 */
export interface CrawlResult {
  /** Total number of URLs crawled */
  crawled: number;
  /** Number of failed URLs */
  failed: number;
  /** List of all URLs attempted */
  urls: string[];
  /** Details of each crawled page */
  pages: CrawledPage[];
  /** List of failed URLs with errors */
  failures: Array<{ url: string; error: string }>;
}

/**
 * Internal queue item for BFS traversal
 */
interface QueueItem {
  url: string;
  depth: number;
}

/**
 * Progress callback function type
 */
export type CrawlProgressCallback = (current: number, total: number, url: string, depth: number) => void;

/**
 * Error callback function type
 */
export type CrawlErrorCallback = (url: string, error: string) => void;

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(base: string, relative: string): string | null {
  try {
    const baseUrl = new URL(base);
    const resolved = new URL(relative, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Check if two URLs are on the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  return domain1 !== null && domain1 === domain2;
}

/**
 * Extract links from HTML content
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  
  try {
    const dom = new JSDOM(html, { url: baseUrl });
    const document = dom.window.document;
    
    const anchorElements = document.querySelectorAll('a[href]');
    
    for (const anchor of anchorElements) {
      const href = anchor.getAttribute('href');
      if (href) {
        const resolved = resolveUrl(baseUrl, href);
        if (resolved) {
          links.push(resolved);
        }
      }
    }
    
    dom.window.close();
  } catch (error) {
    console.error(`Error extracting links from ${baseUrl}: ${(error as Error).message}`);
  }
  
  return links;
}

/**
 * Crawler class for depth-limited web crawling
 */
export class Crawler {
  private options: Required<CrawlOptions>;
  private scraper: Scraper;
  private visited: Set<string> = new Set();
  private robotsCache: Map<string, ReturnType<typeof robotsParser>> = new Map();
  private progressCallback?: CrawlProgressCallback;
  private errorCallback?: CrawlErrorCallback;
  private urlProcessor: UrlProcessor;

  constructor(options: CrawlOptions) {
    this.options = {
      ...DEFAULT_CRAWL_OPTIONS,
      ...options,
    };
    this.scraper = new Scraper({
      timeout: this.options.timeout,
      userAgent: this.options.userAgent,
    });

    const converter = new Converter();
    const filter = new ContentFilter();
    const metadataExtractor = new MetadataExtractor();
    const fileWriter = new FileWriter(this.options.outputDir);

    this.urlProcessor = new UrlProcessor(
      this.scraper,
      converter,
      filter,
      metadataExtractor,
      fileWriter
    );
  }

  /**
   * Set progress callback for monitoring crawl progress
   */
  onProgress(callback: CrawlProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Set error callback for handling individual URL failures
   */
  onError(callback: CrawlErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDir(): Promise<void> {
    await mkdir(this.options.outputDir, { recursive: true });
  }

  /**
   * Fetch and parse robots.txt for a domain
   */
  private async getRobots(url: string): Promise<ReturnType<typeof robotsParser> | null> {
    const domain = extractDomain(url);
    if (!domain) return null;

    // Check cache first
    if (this.robotsCache.has(domain)) {
      return this.robotsCache.get(domain)!;
    }

    const robotsUrl = `https://${domain}/robots.txt`;
    
    try {
      // Use a separate scraper instance for robots.txt to avoid context issues
      const robotsScraper = new Scraper({
        timeout: 5000,
        userAgent: this.options.userAgent,
      });
      
      const result = await robotsScraper.scrape(robotsUrl);
      await robotsScraper.close();
      
      if (result.statusCode === 200) {
        const robots = robotsParser(robotsUrl, result.html);
        this.robotsCache.set(domain, robots);
        return robots;
      }
    } catch (error) {
      // If robots.txt doesn't exist or fails, assume everything is allowed
      console.error(`No robots.txt found for ${domain}, proceeding with crawl`);
    }

    // No robots.txt means everything is allowed
    const allowAll = robotsParser(robotsUrl, '');
    this.robotsCache.set(domain, allowAll);
    return allowAll;
  }

  /**
   * Check if a URL is allowed by robots.txt
   */
  private async isAllowedByRobots(url: string): Promise<boolean> {
    if (!this.options.respectRobots) {
      return true;
    }

    const robots = await this.getRobots(url);
    if (!robots) {
      return true;
    }

    return robots.isAllowed(url, this.options.robotsUserAgent) ?? true;
  }

  /**
   * Generate a filename for a URL
   */
  private generateFilename(url: string, depth: number): string {
    const sanitized = sanitizeUrlForFilename(url);

    // Add depth prefix for organization
    const depthPrefix = `d${depth}_`;

    const extension = this.options.format === 'json' ? 'json' : 'md';
    return `${depthPrefix}${sanitized}.${extension}`;
  }

  /**
   * Process a single URL using UrlProcessor
   * Returns HTML for caching (max 5MB) to avoid double-scraping during link extraction
   */
  private async processUrl(url: string, depth: number): Promise<CrawledPage> {
    const result = await this.urlProcessor.process(url, {
      filter: this.options.filter,
      format: this.options.format,
      outputDir: this.options.outputDir,
      overwrite: this.options.overwrite,
      includeHtml: true,
      filenamePrefix: `d${depth}`,
    });

    if (!result.success) {
      return {
        url,
        depth,
        success: false,
        error: result.error,
      };
    }

    // Cache HTML for link extraction, but only if under 5MB (memory safety)
    const MAX_CACHED_HTML_SIZE = 5 * 1024 * 1024; // 5MB
    const shouldCacheHtml = result.html && result.html.length <= MAX_CACHED_HTML_SIZE;

    return {
      url,
      depth,
      success: true,
      outputFile: result.outputFile,
      html: shouldCacheHtml ? result.html : undefined,
    };
  }

  /**
   * Run the crawler starting from the configured startUrl
   */
  async crawl(): Promise<CrawlResult> {
    await this.ensureOutputDir();

    const result: CrawlResult = {
      crawled: 0,
      failed: 0,
      urls: [],
      pages: [],
      failures: [],
    };

    // BFS queue
    const queue: QueueItem[] = [{ url: this.options.startUrl, depth: 0 }];
    const startDomain = extractDomain(this.options.startUrl);

    // Mark start URL as visited
    const normalizedStart = normalizeUrl(this.options.startUrl);
    this.visited.add(normalizedStart);

    while (queue.length > 0 && result.crawled < this.options.limit) {
      const item = queue.shift()!;
      const { url, depth } = item;

      // Check depth limit
      if (depth > this.options.maxDepth) {
        continue;
      }

      // Check domain restriction
      if (this.options.stayWithinDomain && startDomain) {
        const urlDomain = extractDomain(url);
        if (urlDomain !== startDomain) {
          continue;
        }
      }

      // Check robots.txt
      const allowed = await this.isAllowedByRobots(url);
      if (!allowed) {
        console.error(`Skipping ${url} (disallowed by robots.txt)`);
        continue;
      }

      // Report progress
      const currentCount = result.crawled + result.failed + 1;
      if (this.progressCallback) {
        this.progressCallback(currentCount, this.options.limit, url, depth);
      }

      console.error(`Crawling [depth ${depth}]: ${url}`);

      // Process the URL
      const pageResult = await this.processUrl(url, depth);
      result.urls.push(url);
      result.pages.push(pageResult);

      if (pageResult.success) {
        result.crawled++;

        // Extract and queue new links if we haven't reached max depth
        if (depth < this.options.maxDepth && pageResult.outputFile) {
          try {
            let links: string[] = [];

            // Use cached HTML if available (avoids double-scraping)
            // If HTML was too large (>5MB), it won't be cached and we need to rescrape
            if (pageResult.html) {
              links = extractLinks(pageResult.html, url);
            } else {
              // HTML was too large to cache, rescrape for link extraction
              const scrapeResult = await this.scraper.scrape(url);
              links = extractLinks(scrapeResult.html, url);
            }

            for (const link of links) {
              const normalized = normalizeUrl(link);

              // Skip if already visited
              if (this.visited.has(normalized)) {
                continue;
              }

              // Mark as visited
              this.visited.add(normalized);

              // Add to queue
              queue.push({ url: link, depth: depth + 1 });
            }
          } catch {
            // Ignore errors when extracting links for queueing
          }
        }
      } else {
        result.failed++;
        result.failures.push({
          url,
          error: pageResult.error || 'Unknown error',
        });

        if (this.errorCallback) {
          this.errorCallback(url, pageResult.error || 'Unknown error');
        }
      }

      // Add delay between requests (politeness)
      if (result.crawled + result.failed < this.options.limit && queue.length > 0) {
        await this.sleep(this.options.delay);
      }
    }

    // Close browser
    await this.scraper.close();

    console.error(`\nCrawl complete: ${result.crawled} pages, ${result.failed} failures`);

    return result;
  }

  /**
   * Close resources
   */
  async close(): Promise<void> {
    await this.scraper.close();
  }
}

/**
 * Format crawl result for display
 */
export function formatCrawlResult(result: CrawlResult): string {
  const lines = [
    `Crawl Summary:`,
    `  Crawled: ${result.crawled}`,
    `  Failed: ${result.failed}`,
    `  Total URLs: ${result.urls.length}`,
  ];

  if (result.failures.length > 0) {
    lines.push('');
    lines.push('Failed URLs:');
    for (const failure of result.failures) {
      lines.push(`  - ${failure.url}`);
      lines.push(`    Error: ${failure.error}`);
    }
  }

  return lines.join('\n');
}
