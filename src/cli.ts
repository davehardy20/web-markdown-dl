#!/usr/bin/env node
import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { Scraper } from './scraper.js';
import { ScraperError, type Metadata, type ScrapingResult } from './types.js';
import { Converter, ConverterError } from './converter.js';
import { ContentFilter } from './filter.js';
import { MetadataExtractor } from './metadata.js';

export interface CliOptions {
  url: string;
  output?: string;
  format: 'markdown' | 'json';
  timeout: number;
  userAgent?: string;
  filter: boolean;
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
 * Main CLI execution logic
 */
export async function runCli(options: CliOptions): Promise<CliResult> {
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
    .requiredOption('--url <url>', 'URL to convert')
    .option('-o, --output <file>', 'Output file path (default: stdout)')
    .option(
      '-f, --format <format>',
      'Output format (markdown or json)',
      'markdown'
    )
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
    .option('-u, --user-agent <ua>', 'Custom user agent string')
    .option('-F, --filter', 'Enable content filtering (extract main content, remove ads/nav/sidebars)')
    .action(async (options) => {
      const cliOptions: CliOptions = {
        url: options.url,
        output: options.output,
        format: options.format as 'markdown' | 'json',
        timeout: parseInt(options.timeout, 10),
        userAgent: options.userAgent,
        filter: options.filter ?? false,
      };

      if (cliOptions.format !== 'markdown' && cliOptions.format !== 'json') {
        console.error(`Error: Invalid format "${cliOptions.format}". Must be "markdown" or "json".`);
        process.exit(1);
      }

      if (isNaN(cliOptions.timeout) || cliOptions.timeout <= 0) {
        console.error('Error: Timeout must be a positive number.');
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
