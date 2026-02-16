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
   * Extract domain from URL for grouping
   */
  private extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return null;
    }
  }

  /**
   * Group URLs by their domain
   */
  private groupUrlsByDomain(urls: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const url of urls) {
      const domain = this.extractDomain(url);
      if (!domain) continue;
      
      if (!groups.has(domain)) {
        groups.set(domain, []);
      }
      groups.get(domain)!.push(url);
    }
    return groups;
  }

  /**
   * Process a single domain sequentially (maintains politeness)
   */
  private async processDomain(
    domain: string, 
    urls: string[], 
    totalUrls: number
  ): Promise<BatchSummary> {
    const summary: BatchSummary = {
      total: urls.length,
      completed: 0,
      failed: 0,
      failures: [],
    };

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;

      // Report progress (current is tracked globally via closure in run())
      // We'll handle progress callback differently for parallel processing

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
    const domainGroups = this.groupUrlsByDomain(urls);
    
    // Convert to array for batch processing
    const domainEntries = Array.from(domainGroups.entries());
    
    // Track overall progress
    let processedCount = 0;
    const totalUrlCount = urls.length;
    
    // Create a wrapper for progress callback that tracks global progress
    const originalProgressCallback = this.progressCallback;
    const domainProgressCallbacks = new Map<string, ProgressCallback>();
    
    if (originalProgressCallback) {
      // Create a per-domain progress tracker that calls the global callback
      for (const [domain] of domainEntries) {
        domainProgressCallbacks.set(domain, () => {
          processedCount++;
          originalProgressCallback(processedCount, totalUrlCount, domain);
        });
      }
    }

    // Process domains with concurrency limit
    const MAX_CONCURRENT_DOMAINS = 5;
    const results: BatchSummary[] = [];

    for (let i = 0; i < domainEntries.length; i += MAX_CONCURRENT_DOMAINS) {
      const batch = domainEntries.slice(i, i + MAX_CONCURRENT_DOMAINS);
      
      // Process batch of domains in parallel
      const batchPromises = batch.map(async ([domain, domainUrls]) => {
        const result = await this.processDomain(domain, domainUrls, totalUrlCount);
        
        // Update progress for each URL in this domain
        if (originalProgressCallback) {
          for (let j = 0; j < domainUrls.length; j++) {
            processedCount++;
            originalProgressCallback(processedCount, totalUrlCount, domainUrls[j]!);
          }
        }
        
        return result;
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
