import { Scraper } from '../scraper.js';
import { Converter } from '../converter.js';
import { ContentFilter } from '../filter.js';
import { MetadataExtractor } from '../metadata.js';
import { FileWriter } from './file-writer.js';
import { Metadata, FilterResult } from '../types.js';
import { sanitizeUrlForFilename } from '../security.js';

export interface UrlProcessorOptions {
  filter?: boolean;
  format?: 'markdown' | 'json';
  outputDir: string;
  overwrite?: boolean;
  /** Include raw HTML in result for caching (e.g., for link extraction) */
  includeHtml?: boolean;
  /** Prefix to add to the filename (e.g., depth indicator like "d1_") */
  filenamePrefix?: string;
}

export interface UrlProcessorResult {
  success: boolean;
  url: string;
  outputFile?: string;
  error?: string;
  metadata?: Metadata;
  /** Raw HTML content, only included when includeHtml option is true */
  html?: string;
}

export class UrlProcessor {
  constructor(
    private scraper: Scraper,
    private converter: Converter,
    private filter: ContentFilter,
    private metadataExtractor: MetadataExtractor,
    private fileWriter: FileWriter
  ) {}

  async process(
    url: string,
    options: UrlProcessorOptions
  ): Promise<UrlProcessorResult> {
    try {
      const scrapeResult = await this.scraper.scrape(url);
      let htmlToConvert = scrapeResult.html;
      let filterMetadata: FilterResult | null = null;
      if (options.filter) {
        const filterResult = this.filter.filterWithFallback(htmlToConvert, scrapeResult.url);
        htmlToConvert = filterResult.html;
        filterMetadata = filterResult.metadata;
      }
      const markdown = this.converter.convert(htmlToConvert);
      const metadata = this.metadataExtractor.extract(
        htmlToConvert,
        scrapeResult.url,
        markdown
      );
      if (filterMetadata?.byline && !metadata.author) {
        metadata.author = filterMetadata.byline;
      }
      const filename = this.buildFilename(scrapeResult.url, options.format, options.filenamePrefix);
      const outputContent = this.prepareOutputContent(markdown, metadata, options.format);
      const writeResult = await this.fileWriter.write(filename, outputContent, {
        overwrite: options.overwrite,
      });
      return {
        success: true,
        url,
        outputFile: writeResult.path,
        metadata,
        html: options.includeHtml ? scrapeResult.html : undefined,
      };
    } catch (error) {
      return {
        success: false,
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildFilename(url: string, format?: string, prefix?: string): string {
    const sanitized = sanitizeUrlForFilename(url);
    const extension = format === 'json' ? 'json' : 'md';
    const prefixStr = prefix ? `${prefix}_` : '';
    return `${prefixStr}${sanitized}.${extension}`;
  }

  private prepareOutputContent(
    markdown: string,
    metadata: Metadata,
    format?: string
  ): string {
    if (format === 'json') {
      return JSON.stringify({ markdown, metadata }, null, 2);
    }
    return markdown;
  }
}
