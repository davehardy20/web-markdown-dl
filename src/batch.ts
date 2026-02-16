/**
 * Batch processing for URL lists
 * Processes multiple URLs sequentially with configurable delay
 */

import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { Scraper } from './scraper.js';
import { Converter } from './converter.js';
import { ContentFilter } from './filter.js';
import { MetadataExtractor } from './metadata.js';
import { ScraperError, type ScrapingResult } from './types.js';
import { sanitizeUrlForFilename, isPathSafe, PathSecurityError, fileExists, validateUrlForSsrf } from './security.js';
import { FileWriter } from './utils/file-writer.js';
import { UrlProcessor } from './utils/url-processor.js';
import { extractDomain, groupUrlsByDomain } from './utils/url.js';

/**
 * Configuration options for batch processing
 */
export interface BatchOptions {
  /** Path to input file containing URLs (one per line) */
  inputFile: string;
  /** Directory to save output files */
  outputDir: string;
  /** Delay between requests in milliseconds */
  delay?: number;
  /** Output format: markdown or json */
  format?: 'markdown' | 'json';
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Enable content filtering */
  filter?: boolean;
  /** Overwrite existing files without warning */
  overwrite?: boolean;
  /** Allow internal network access (SSRF protection bypass) */
  allowInternal?: boolean;
}

/**
 * Default batch options
 */
export const DEFAULT_BATCH_OPTIONS: Required<Omit<BatchOptions, 'inputFile' | 'outputDir'>> = {
  delay: 1000,
  format: 'markdown',
  timeout: 30000,
  userAgent: 'web-markdown-dl/1.0',
  filter: false,
  overwrite: false,
  allowInternal: false,
};

/**
 * Result of processing a single URL
 */
export interface UrlResult {
  /** Original URL processed */
  url: string;
  /** Whether processing succeeded */
  success: boolean;
  /** Output file path (if saved) */
  outputFile?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Summary of batch processing
 */
export interface BatchSummary {
  /** Total number of URLs */
  total: number;
  /** Number of successful URLs */
  completed: number;
  /** Number of failed URLs */
  failed: number;
  /** List of failed URLs with error messages */
  failures: Array<{ url: string; error: string }>;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (current: number, total: number, url: string) => void;

/**
 * Error callback function type
 */
export type ErrorCallback = (url: string, error: string) => void;

/**
 * BatchProcessor class for processing multiple URLs sequentially
 */
export class BatchProcessor {
  private options: Required<Omit<BatchOptions, 'inputFile' | 'outputDir'>> & Pick<BatchOptions, 'inputFile' | 'outputDir'>;
  private progressCallback?: ProgressCallback;
  private errorCallback?: ErrorCallback;
  private scraper: Scraper;
  private converter: Converter;
  private filter: ContentFilter;
  private metadataExtractor: MetadataExtractor;
  private fileWriter: FileWriter;
  private urlProcessor: UrlProcessor;

  constructor(options: BatchOptions) {
    this.options = {
      ...DEFAULT_BATCH_OPTIONS,
      ...options,
    };
    this.scraper = new Scraper({
      timeout: this.options.timeout,
      userAgent: this.options.userAgent,
    });
    this.converter = new Converter();
    this.filter = new ContentFilter();
    this.metadataExtractor = new MetadataExtractor();
    this.fileWriter = new FileWriter(this.options.outputDir);
    this.urlProcessor = new UrlProcessor(
      this.scraper,
      this.converter,
      this.filter,
      this.metadataExtractor,
      this.fileWriter
    );
  }

  /**
   * Set progress callback for monitoring batch progress
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Set error callback for handling individual URL failures
   */
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Maximum file size for batch input (10MB)
   */
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Maximum number of URLs allowed
   */
  private static readonly MAX_URL_COUNT = 10000;

  /**
   * Read URLs from input file
   */
  async readUrls(): Promise<string[]> {
    const stats = await stat(this.options.inputFile);
    if (stats.size > BatchProcessor.MAX_FILE_SIZE) {
      throw new Error(
        `Input file too large: ${stats.size} bytes (max: ${BatchProcessor.MAX_FILE_SIZE} bytes)`
      );
    }

    const content = await readFile(this.options.inputFile, 'utf-8');
    const lines = content.split('\n');
    
    if (lines.length > BatchProcessor.MAX_URL_COUNT) {
      throw new Error(
        `Too many URLs: ${lines.length} (max: ${BatchProcessor.MAX_URL_COUNT})`
      );
    }
    
    // Filter empty lines and comments
    const urls = lines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .filter(line => {
        try {
          const url = new URL(line);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return false;
          }
          const ssrfCheck = validateUrlForSsrf(line, this.options.allowInternal);
          if (!ssrfCheck.valid) {
            console.error(`Warning: Skipping URL blocked by SSRF policy: ${line} - ${ssrfCheck.error}`);
            return false;
          }
          return true;
        } catch {
          return false;
        }
      });

    return urls;
  }

  /**
   * Sanitize a URL to create a valid filename
   */
  sanitizeUrlForFilename(url: string): string {
    return sanitizeUrlForFilename(url);
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
   * Process a single URL and save the result
   */
  private async processUrl(url: string): Promise<UrlResult> {
    try {
      const result = await this.urlProcessor.process(url, {
        filter: this.options.filter,
        format: this.options.format,
        outputDir: this.options.outputDir,
        overwrite: this.options.overwrite,
      });

      if (result.success) {
        return {
          url: result.url,
          success: true,
          outputFile: result.outputFile,
        };
      } else {
        return {
          url: result.url,
          success: false,
          error: result.error,
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof ScraperError
        ? error.message
        : (error as Error).message;

      return {
        url,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process a single domain sequentially (maintains politeness)
   * @param domain Domain name being processed
   * @param urls List of URLs to process for this domain
   * @param onUrlComplete Callback to invoke after each URL completes (for progress tracking)
   */
  private async processDomain(
    domain: string, 
    urls: string[], 
    onUrlComplete?: (url: string) => void
  ): Promise<BatchSummary> {
    const summary: BatchSummary = {
      total: urls.length,
      completed: 0,
      failed: 0,
      failures: [],
    };

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;

      // Process the URL
      const result = await this.processUrl(url);

      if (result.success) {
        summary.completed++;
      } else {
        summary.failed++;
        summary.failures.push({
          url: result.url,
          error: result.error || 'Unknown error',
        });

        // Report error
        if (this.errorCallback) {
          this.errorCallback(result.url, result.error || 'Unknown error');
        }
      }

      // Invoke progress callback after each URL completes (success or failure)
      if (onUrlComplete) {
        onUrlComplete(url);
      }

      // Add delay between URLs within the same domain (politeness)
      if (i < urls.length - 1 && this.options.delay > 0) {
        await this.sleep(this.options.delay);
      }
    }

    return summary;
  }

  /**
   * Merge multiple batch summaries into one
   */
  private mergeSummaries(summaries: BatchSummary[]): BatchSummary {
    return summaries.reduce(
      (merged, summary) => ({
        total: merged.total + summary.total,
        completed: merged.completed + summary.completed,
        failed: merged.failed + summary.failed,
        failures: [...merged.failures, ...summary.failures],
      }),
      { total: 0, completed: 0, failed: 0, failures: [] }
    );
  }

  /**
   * Run batch processing with domain-parallel execution
   * Processes up to 5 domains concurrently while maintaining
   * sequential processing within each domain for politeness.
   */
  async run(): Promise<BatchSummary> {
    // Ensure output directory exists
    await this.ensureOutputDir();

    // Read URLs from input file
    const urls = await this.readUrls();

    if (urls.length === 0) {
      console.error('No valid URLs found in input file');
      return {
        total: 0,
        completed: 0,
        failed: 0,
        failures: [],
      };
    }

    // Group URLs by domain
    const domainGroups = groupUrlsByDomain(urls);
    
    // Convert to array for batch processing
    const domainEntries = Array.from(domainGroups.entries());
    
    // Track overall progress with atomic counter for parallel processing
    let processedCount = 0;
    const totalUrlCount = urls.length;
    
    // Create progress callback wrapper that tracks global count
    const onUrlComplete = this.progressCallback 
      ? (url: string) => {
          processedCount++;
          this.progressCallback!(processedCount, totalUrlCount, url);
        }
      : undefined;

    // Process domains with concurrency limit
    const MAX_CONCURRENT_DOMAINS = 5;
    const results: BatchSummary[] = [];

    for (let i = 0; i < domainEntries.length; i += MAX_CONCURRENT_DOMAINS) {
      const batch = domainEntries.slice(i, i + MAX_CONCURRENT_DOMAINS);
      
      // Process batch of domains in parallel
      const batchPromises = batch.map(async ([domain, domainUrls]) => {
        return this.processDomain(domain, domainUrls, onUrlComplete);
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Merge all summaries
    const finalSummary = this.mergeSummaries(results);

    // Close browser
    await this.scraper.close();

    return finalSummary;
  }

  /**
   * Close resources (browser, etc.)
   */
  async close(): Promise<void> {
    await this.scraper.close();
  }
}

/**
 * Format batch summary for display
 */
export function formatSummary(summary: BatchSummary): string {
  const lines = [
    `Completed: ${summary.completed}/${summary.total}`,
    `Failed: ${summary.failed}`,
  ];

  if (summary.failures.length > 0) {
    lines.push('');
    lines.push('Failed URLs:');
    for (const failure of summary.failures) {
      lines.push(`  - ${failure.url}`);
      lines.push(`    Error: ${failure.error}`);
    }
  }

  return lines.join('\n');
}
