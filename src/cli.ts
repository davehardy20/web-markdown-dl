#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { Scraper } from './scraper.js';
import { ScraperError, type Metadata, type ScrapingResult } from './types.js';
import { Converter, ConverterError } from './converter.js';
import { ContentFilter } from './filter.js';
import { MetadataExtractor } from './metadata.js';
import { BatchProcessor, formatSummary } from './batch.js';
import { Crawler, formatCrawlResult } from './crawler.js';

export interface CliOptions {
  url?: string;
  output?: string;
  format: 'markdown' | 'json';
  timeout: number;
  userAgent?: string;
  filter: boolean;
  inputFile?: string;
  outputDir?: string;
  delay: number;
  crawl?: boolean;
  maxDepth?: number;
  limit?: number;
  ignoreRobots?: boolean;
  allowExternal?: boolean;
}

export interface CliResult {
  success: boolean;
  content?: string;
  error?: string;
  exitCode: number;
}

/**
 * Validates a URL string
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface FilterMetadata {
  filtered: boolean;
  originalTitle?: string | null;
  author?: string | null;
  excerpt?: string | null;
  siteName?: string | null;
}

export function createScrapingResult(
  markdown: string,
  metadata: Metadata,
  html?: string
): ScrapingResult {
  return {
    markdown,
    metadata,
    html,
  };
}

/**
 * Run crawl mode
 */
export async function runCrawl(options: CliOptions): Promise<CliResult> {
  if (!options.url) {
    return {
      success: false,
      error: 'Error: URL is required for crawl mode. Use --url <url>',
      exitCode: 1,
    };
  }

  if (!options.outputDir) {
    return {
      success: false,
      error: 'Error: --output-dir is required for crawl mode',
      exitCode: 1,
    };
  }

  if (!isValidUrl(options.url)) {
    return {
      success: false,
      error: `Error: Invalid URL "${options.url}". Must be a valid http or https URL.`,
      exitCode: 1,
    };
  }

  const crawler = new Crawler({
    startUrl: options.url,
    outputDir: options.outputDir,
    maxDepth: options.maxDepth ?? 2,
    limit: options.limit ?? 100,
    delay: options.delay,
    format: options.format,
    filter: options.filter,
    timeout: options.timeout,
    userAgent: options.userAgent,
    respectRobots: !options.ignoreRobots,
    stayWithinDomain: !options.allowExternal,
  });

  crawler.onProgress((current, total, url, depth) => {
    console.error(`Crawling ${current}/${total} [depth ${depth}]: ${url}`);
  });

  crawler.onError((url, error) => {
    console.error(`Failed: ${url} - ${error}`);
  });

  try {
    const result = await crawler.crawl();
    console.error(formatCrawlResult(result));

    return {
      success: result.failed === 0,
      content: formatCrawlResult(result),
      exitCode: result.failed > 0 ? 1 : 0,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      error: `Error: ${err.message}`,
      exitCode: 1,
    };
  }
}

/**
 * Run batch processing mode
 */
export async function runBatch(options: CliOptions): Promise<CliResult> {
  if (!options.inputFile) {
    return {
      success: false,
      error: 'Error: --input-file is required for batch mode',
      exitCode: 1,
    };
  }

  if (!options.outputDir) {
    return {
      success: false,
      error: 'Error: --output-dir is required for batch mode',
      exitCode: 1,
    };
  }

  const batchProcessor = new BatchProcessor({
    inputFile: options.inputFile,
    outputDir: options.outputDir,
    delay: options.delay,
    format: options.format,
    timeout: options.timeout,
    userAgent: options.userAgent,
    filter: options.filter,
  });

  batchProcessor.onProgress((current, total, url) => {
    console.error(`Processing ${current}/${total}: ${url}`);
  });

  batchProcessor.onError((url, error) => {
    console.error(`Failed: ${url} - ${error}`);
  });

  try {
    const summary = await batchProcessor.run();
    console.error(formatSummary(summary));

    return {
      success: summary.failed === 0,
      content: formatSummary(summary),
      exitCode: summary.failed > 0 ? 1 : 0,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      error: `Error: ${err.message}`,
      exitCode: 1,
    };
  }
}

/**
 * Main CLI execution logic
 */
export async function runCli(options: CliOptions): Promise<CliResult> {
  if (options.crawl && options.outputDir) {
    return runCrawl(options);
  }

  if (options.inputFile && options.outputDir) {
    return runBatch(options);
  }

  if (!options.url) {
    return {
      success: false,
      error: 'Error: URL is required. Use --url <url>',
      exitCode: 1,
    };
  }

  if (!isValidUrl(options.url)) {
    return {
      success: false,
      error: `Error: Invalid URL "${options.url}". Must be a valid http or https URL.`,
      exitCode: 1,
    };
  }

  const scraper = new Scraper({
    timeout: options.timeout,
    userAgent: options.userAgent,
  });

  try {
    const result = await scraper.scrape(options.url);

    let htmlToConvert = result.html;
    let filterMetadata: FilterMetadata = { filtered: false };

    if (options.filter) {
      const contentFilter = new ContentFilter();
      const filterResult = contentFilter.filterWithFallback(result.html, result.url);
      htmlToConvert = filterResult.html;
      filterMetadata = {
        filtered: filterResult.metadata.success,
        originalTitle: filterResult.metadata.title,
        author: filterResult.metadata.byline,
        excerpt: filterResult.metadata.excerpt,
        siteName: filterResult.metadata.siteName,
      };

      if (!filterResult.metadata.success) {
        console.error(`Warning: Content filtering failed, using raw HTML. ${filterResult.metadata.error}`);
      }
    }

    const converter = new Converter();
    const markdown = converter.convert(htmlToConvert);

    const metadataExtractor = new MetadataExtractor();
    const metadata = metadataExtractor.extract(htmlToConvert, result.url, markdown);

    if (filterMetadata.author && !metadata.author) {
      metadata.author = filterMetadata.author;
    }

    let output: string;
    if (options.format === 'json') {
      const scrapingResult = createScrapingResult(markdown, metadata);
      output = JSON.stringify(scrapingResult, null, 2);
    } else {
      output = markdown;
    }

    if (options.output) {
      writeFileSync(options.output, output, 'utf-8');
    }

    return {
      success: true,
      content: options.output ? undefined : output,
      exitCode: 0,
    };
  } catch (error: unknown) {
    if (error instanceof ScraperError) {
      return {
        success: false,
        error: `Error: ${error.message}`,
        exitCode: 1,
      };
    }
    if (error instanceof ConverterError) {
      return {
        success: false,
        error: `Error: ${error.message}`,
        exitCode: 1,
      };
    }
    const err = error as Error;
    return {
      success: false,
      error: `Error: ${err.message}`,
      exitCode: 1,
    };
  } finally {
    await scraper.close();
  }
}

/**
 * Creates and configures the Commander program
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('web-markdown-dl')
    .description('Download web pages and convert them to clean Markdown')
    .version('0.1.0')
    .option('--url <url>', 'URL to convert')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .option(
      '-f, --format <format>',
      'Output format (markdown or json)',
      'markdown'
    )
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
    .option('-u, --user-agent <ua>', 'Custom user agent string')
    .option('-F, --filter', 'Enable content filtering (extract main content, remove ads/nav/sidebars)')
    .option('-d, --delay <ms>', 'Delay between requests in milliseconds', '1000')
    .option('--input-file <file>', 'Input file containing URLs (batch mode)')
    .option('--output-dir <dir>', 'Output directory (batch/crawl mode)')
    .option('--crawl', 'Enable crawl mode - recursively crawl linked pages')
    .option('--max-depth <depth>', 'Maximum crawl depth (default: 2)', '2')
    .option('--limit <count>', 'Maximum URLs to crawl (default: 100)', '100')
    .option('--ignore-robots', 'Ignore robots.txt restrictions')
    .option('--allow-external', 'Allow crawling external domains')
    .action(async (options) => {
      const cliOptions: CliOptions = {
        url: options.url,
        output: options.output,
        format: options.format as 'markdown' | 'json',
        timeout: parseInt(options.timeout, 10),
        userAgent: options.userAgent,
        filter: options.filter ?? false,
        inputFile: options.inputFile,
        outputDir: options.outputDir,
        delay: parseInt(options.delay, 10),
        crawl: options.crawl ?? false,
        maxDepth: parseInt(options.maxDepth, 10),
        limit: parseInt(options.limit, 10),
        ignoreRobots: options.ignoreRobots ?? false,
        allowExternal: options.allowExternal ?? false,
      };

      if (cliOptions.format !== 'markdown' && cliOptions.format !== 'json') {
        console.error(`Error: Invalid format "${cliOptions.format}". Must be "markdown" or "json".`);
        process.exit(1);
      }

      if (isNaN(cliOptions.timeout) || cliOptions.timeout <= 0) {
        console.error('Error: Timeout must be a positive number.');
        process.exit(1);
      }

      if (isNaN(cliOptions.delay) || cliOptions.delay < 0) {
        console.error('Error: Delay must be a non-negative number.');
        process.exit(1);
      }

      if (!cliOptions.url && !cliOptions.inputFile) {
        console.error('Error: URL is required. Use --url <url>');
        process.exit(1);
      }

      const result = await runCli(cliOptions);

      if (!result.success) {
        console.error(result.error);
        process.exit(result.exitCode);
      }

      if (result.content) {
        console.log(result.content);
      }

      process.exit(result.exitCode);
    });

  return program;
}

const program = createProgram();

export function main(): void {
  program.parse();
}

export { program };
