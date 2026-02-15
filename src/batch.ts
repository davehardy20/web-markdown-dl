/**
 * Batch processing for URL lists
 * Processes multiple URLs sequentially with configurable delay
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Scraper } from './scraper.js';
import { Converter } from './converter.js';
import { ContentFilter } from './filter.js';
import { MetadataExtractor } from './metadata.js';
import { ScraperError, type Metadata, type ScrapingResult } from './types.js';
import { sanitizeUrlForFilename, isPathSafe, PathSecurityError, fileExists } from './security.js';

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

  constructor(options: BatchOptions) {
    this.options = {
      ...DEFAULT_BATCH_OPTIONS,
      ...options,
    };
    this.scraper = new Scraper({
      timeout: this.options.timeout,
      userAgent: this.options.userAgent,
    });
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
   * Read URLs from input file
   */
  async readUrls(): Promise<string[]> {
    const content = await readFile(this.options.inputFile, 'utf-8');
    const lines = content.split('\n');
    
    // Filter empty lines and comments
    const urls = lines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .filter(line => {
        try {
          const url = new URL(line);
          return url.protocol === 'http:' || url.protocol === 'https:';
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
      // Scrape the URL
      const result = await this.scraper.scrape(url);

      let htmlToConvert = result.html;
      let filterMetadata = { filtered: false, author: null as string | null };

      // Apply content filtering if enabled
      if (this.options.filter) {
        const contentFilter = new ContentFilter();
        const filterResult = contentFilter.filterWithFallback(result.html, result.url);
        htmlToConvert = filterResult.html;
        filterMetadata = {
          filtered: filterResult.metadata.success,
          author: filterResult.metadata.byline,
        };

        if (!filterResult.metadata.success) {
          console.error(`Warning: Content filtering failed for ${url}, using raw HTML. ${filterResult.metadata.error}`);
        }
      }

      // Convert to markdown
      const converter = new Converter();
      const markdown = converter.convert(htmlToConvert);

      // Extract metadata
      const metadataExtractor = new MetadataExtractor();
      const metadata = metadataExtractor.extract(htmlToConvert, result.url, markdown);

      // Add author from filter if not already set
      if (filterMetadata.author && !metadata.author) {
        metadata.author = filterMetadata.author;
      }

      // Generate output filename
      const sanitizedUrl = this.sanitizeUrlForFilename(url);
      const extension = this.options.format === 'json' ? 'json' : 'md';
      const outputFilename = `${sanitizedUrl}.${extension}`;
      const outputPath = `${this.options.outputDir}/${outputFilename}`;

      // Validate output path is within output directory (prevent path traversal)
      if (!isPathSafe(outputPath, this.options.outputDir)) {
        throw new PathSecurityError(
          `Path traversal detected: output path "${outputPath}" resolves outside the output directory`
        );
      }

      // Prepare output content
      let outputContent: string;
      if (this.options.format === 'json') {
        const scrapingResult: ScrapingResult = {
          markdown,
          metadata,
        };
        outputContent = JSON.stringify(scrapingResult, null, 2);
      } else {
        outputContent = markdown;
      }

      // Check if file exists and respect overwrite option
      const exists = await fileExists(outputPath);
      if (exists && !this.options.overwrite) {
        console.error(`Skipping ${url}: file already exists (use --force to overwrite)`);
        return {
          url,
          success: true,
          outputFile: outputPath,
        };
      }

      // Write output file
      await writeFile(outputPath, outputContent, 'utf-8');

      return {
        url,
        success: true,
        outputFile: outputPath,
      };
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
   * Run batch processing
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

    const summary: BatchSummary = {
      total: urls.length,
      completed: 0,
      failed: 0,
      failures: [],
    };

    // Process URLs sequentially
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      const current = i + 1;

      // Report progress
      if (this.progressCallback) {
        this.progressCallback(current, urls.length, url);
      }

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

      // Add delay between requests (except after last URL)
      if (i < urls.length - 1 && this.options.delay > 0) {
        await this.sleep(this.options.delay);
      }
    }

    // Close browser
    await this.scraper.close();

    return summary;
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
