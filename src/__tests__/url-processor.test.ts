import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { UrlProcessor, UrlProcessorOptions } from '../utils/url-processor';
import { Scraper } from '../scraper';
import { Converter } from '../converter';
import { ContentFilter } from '../filter';
import { MetadataExtractor } from '../metadata';
import { FileWriter } from '../utils/file-writer';
import { ScraperResult, Metadata, FilterResult } from '../types';

describe('UrlProcessor', () => {
  let processor: UrlProcessor;
  const outputDir = '/test/output';
  
  let mockScraper: { scrape: ReturnType<typeof mock> };
  let mockConverter: { convert: ReturnType<typeof mock> };
  let mockFilter: { filterWithFallback: ReturnType<typeof mock> };
  let mockMetadataExtractor: { extract: ReturnType<typeof mock> };
  let mockFileWriter: { write: ReturnType<typeof mock> };

  beforeEach(() => {
    mockScraper = {
      scrape: mock(() => Promise.resolve({
        html: '<html><body>Test content</body></html>',
        url: 'https://example.com/article',
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult),
    };
    
    mockConverter = {
      convert: mock(() => '# Test content'),
    };
    
    mockFilter = {
      filterWithFallback: mock(() => ({
        html: '<body>Test content</body>',
        metadata: {
          success: true,
          content: '<body>Test content</body>',
          title: 'Test Article',
          textContent: 'Test content',
          length: 12,
          excerpt: 'Test content',
          byline: 'Test Author',
          dir: null,
          siteName: 'Example',
          lang: 'en',
          publishedTime: null,
          error: null,
        },
      })),
    };
    
    mockMetadataExtractor = {
      extract: mock(() => ({
        url: 'https://example.com/article',
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata),
    };
    
    mockFileWriter = {
      write: mock(() => Promise.resolve({
        success: true,
        path: '/test/output/example.com_article.md',
        skipped: false,
      })),
    };
    
    processor = new UrlProcessor(
      mockScraper as unknown as Scraper,
      mockConverter as unknown as Converter,
      mockFilter as unknown as ContentFilter,
      mockMetadataExtractor as unknown as MetadataExtractor,
      mockFileWriter as unknown as FileWriter
    );
  });

  describe('Full Pipeline Processing', () => {
    test('processes URL through full pipeline', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const filteredHtml = '<body>Test content</body>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockFilter.filterWithFallback = mock(() => ({
        html: filteredHtml,
        metadata: {
          success: true,
          content: filteredHtml,
          title: 'Test Article',
          textContent: 'Test content',
          length: 12,
          excerpt: 'Test content',
          byline: 'Test Author',
          dir: null,
          siteName: 'Example',
          lang: 'en',
          publishedTime: null,
          error: null,
        },
      }));

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        filter: true,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(result.outputFile).toBe(outputPath);
      expect(result.metadata).toBeDefined();
      
      expect(mockScraper.scrape).toHaveBeenCalledTimes(1);
      expect(mockScraper.scrape).toHaveBeenCalledWith(url);
      expect(mockFilter.filterWithFallback).toHaveBeenCalledTimes(1);
      expect(mockFilter.filterWithFallback).toHaveBeenCalledWith(html, url);
      expect(mockConverter.convert).toHaveBeenCalledTimes(1);
      expect(mockConverter.convert).toHaveBeenCalledWith(filteredHtml);
      expect(mockMetadataExtractor.extract).toHaveBeenCalledTimes(1);
    });

    test('processes URL without filtering when disabled', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        filter: false,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(mockFilter.filterWithFallback).not.toHaveBeenCalled();
      expect(mockConverter.convert).toHaveBeenCalledWith(html);
    });

    test('handles JSON format output', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.json';
      
      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        filter: false,
        format: 'json',
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.outputFile).toBe(outputPath);
      
      const writeCall = mockFileWriter.write.mock.calls[0];
      const writtenContent = writeCall[1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.markdown).toBe(markdown);
      expect(parsed.metadata).toBeDefined();
    });

    test('uses markdown format by default', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      
      const writeCall = mockFileWriter.write.mock.calls[0];
      const writtenContent = writeCall[1] as string;
      expect(writtenContent).toBe(markdown);
    });
  });

  describe('Error Handling', () => {
    test('handles scraping errors gracefully', async () => {
      const url = 'https://example.com/article';
      const errorMessage = 'Network timeout';

      mockScraper.scrape = mock(() => Promise.reject(new Error(errorMessage)));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(false);
      expect(result.url).toBe(url);
      expect(result.error).toBe(errorMessage);
      expect(result.outputFile).toBeUndefined();
    });

    test('handles converter errors gracefully', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const errorMessage = 'Invalid HTML';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => {
        throw new Error(errorMessage);
      });

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(false);
      expect(result.url).toBe(url);
      expect(result.error).toBe(errorMessage);
    });

    test('handles file writer errors gracefully', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const errorMessage = 'Permission denied';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.reject(new Error(errorMessage)));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(false);
      expect(result.url).toBe(url);
      expect(result.error).toBe(errorMessage);
    });

    test('handles filter errors gracefully', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockFilter.filterWithFallback = mock(() => {
        throw new Error('Filter crashed');
      });

      const options: UrlProcessorOptions = {
        outputDir,
        filter: true,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Filter crashed');
    });

    test('handles unknown error types', async () => {
      const url = 'https://example.com/article';

      mockScraper.scrape = mock(() => Promise.reject('String error'));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('Metadata Extraction', () => {
    test('extracts metadata correctly', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      const metadata: Metadata = {
        url,
        title: 'Extracted Title',
        description: 'Extracted description',
        author: 'Extracted Author',
        publishedDate: '2024-01-01',
        timestamp: new Date().toISOString(),
        headings: [{ level: 1, text: 'Test content' }],
        links: [{ text: 'Link', href: '/test' }],
        wordCount: 42,
        contentType: 'text/html',
      };

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(metadata);
      
      const extractCall = mockMetadataExtractor.extract.mock.calls[0];
      expect(extractCall[0]).toBe(html);
      expect(extractCall[1]).toBe(url);
      expect(extractCall[2]).toBe(markdown);
    });

    test('adds author from filter when metadata lacks author', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const filteredHtml = '<body>Test content</body>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      const metadata: Metadata = {
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      };

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockFilter.filterWithFallback = mock(() => ({
        html: filteredHtml,
        metadata: {
          success: true,
          content: filteredHtml,
          title: 'Test Article',
          textContent: 'Test content',
          length: 12,
          excerpt: 'Test content',
          byline: 'Filter Author',
          dir: null,
          siteName: 'Example',
          lang: 'en',
          publishedTime: null,
          error: null,
        },
      }));

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        filter: true,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.metadata?.author).toBe('Filter Author');
    });

    test('does not override metadata author when filter provides one', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const filteredHtml = '<body>Test content</body>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';
      
      const metadata: Metadata = {
        url,
        title: 'Test Article',
        author: 'Meta Author',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      };

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockFilter.filterWithFallback = mock(() => ({
        html: filteredHtml,
        metadata: {
          success: true,
          content: filteredHtml,
          title: 'Test Article',
          textContent: 'Test content',
          length: 12,
          excerpt: 'Test content',
          byline: 'Filter Author',
          dir: null,
          siteName: 'Example',
          lang: 'en',
          publishedTime: null,
          error: null,
        },
      }));

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => metadata);
      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        filter: true,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.metadata?.author).toBe('Meta Author');
    });
  });

  describe('File Writing', () => {
    test('passes overwrite option to file writer', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: '/test/output/example.com_article.md',
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        overwrite: true,
      };

      await processor.process(url, options);

      const writeCall = mockFileWriter.write.mock.calls[0];
      expect(writeCall[2]).toEqual({ overwrite: true });
    });

    test('handles skipped files correctly', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test content</body></html>';
      const markdown = '# Test content';
      const outputPath = '/test/output/example.com_article.md';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test Article',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test Article',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 2,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: outputPath,
        skipped: true,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        overwrite: false,
      };

      const result = await processor.process(url, options);

      expect(result.success).toBe(true);
      expect(result.outputFile).toBe(outputPath);
    });
  });

  describe('Dependency Injection', () => {
    test('allows mocking all dependencies', async () => {
      const url = 'https://example.com/article';
      
      const customScraper = {
        scrape: mock(() => Promise.resolve({
          html: '<html><body>Custom</body></html>',
          url,
          title: 'Custom',
          statusCode: 200,
        }) as ScraperResult),
      };

      const customConverter = {
        convert: mock(() => '# Custom'),
      };

      const customFilter = {
        filterWithFallback: mock(() => ({
          html: '<body>Custom</body>',
          metadata: { success: true, content: '<body>Custom</body>', title: 'Custom', textContent: 'Custom', length: 6, excerpt: 'Custom', byline: null, dir: null, siteName: null, lang: null, publishedTime: null, error: null },
        })),
      };

      const customMetadataExtractor = {
        extract: mock(() => ({
          url,
          title: 'Custom',
          timestamp: new Date().toISOString(),
          headings: [],
          links: [],
          wordCount: 1,
          contentType: 'text/html',
        }) as Metadata),
      };

      const customFileWriter = {
        write: mock(() => Promise.resolve({
          success: true,
          path: '/custom/path.md',
          skipped: false,
        })),
      };

      const customProcessor = new UrlProcessor(
        customScraper as unknown as Scraper,
        customConverter as unknown as Converter,
        customFilter as unknown as ContentFilter,
        customMetadataExtractor as unknown as MetadataExtractor,
        customFileWriter as unknown as FileWriter
      );

      const result = await customProcessor.process(url, {
        outputDir,
        filter: true,
      });

      expect(result.success).toBe(true);
      expect(customScraper.scrape).toHaveBeenCalledTimes(1);
      expect(customConverter.convert).toHaveBeenCalledTimes(1);
      expect(customFilter.filterWithFallback).toHaveBeenCalledTimes(1);
      expect(customMetadataExtractor.extract).toHaveBeenCalledTimes(1);
      expect(customFileWriter.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filename Generation', () => {
    test('generates filename from URL', async () => {
      const url = 'https://example.com/article/test-page';
      const html = '<html><body>Test</body></html>';
      const markdown = '# Test';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 1,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: '/test/output/example.com_article_test-page.md',
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      await processor.process(url, options);

      const filenameArg = mockFileWriter.write.mock.calls[0][0] as string;
      expect(filenameArg.endsWith('.md')).toBe(true);
      expect(filenameArg.includes('example')).toBe(true);
    });

    test('uses .json extension for JSON format', async () => {
      const url = 'https://example.com/article';
      const html = '<html><body>Test</body></html>';
      const markdown = '# Test';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 1,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: '/test/output/example.com_article.json',
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
        format: 'json',
      };

      await processor.process(url, options);

      const filenameArg = mockFileWriter.write.mock.calls[0][0] as string;
      expect(filenameArg.endsWith('.json')).toBe(true);
    });

    test('sanitizes URLs with special characters', async () => {
      const url = 'https://example.com/article?query=test&sort=date';
      const html = '<html><body>Test</body></html>';
      const markdown = '# Test';

      mockScraper.scrape = mock(() => Promise.resolve({
        html,
        url,
        title: 'Test',
        statusCode: 200,
      }) as ScraperResult);

      mockConverter.convert = mock(() => markdown);
      mockMetadataExtractor.extract = mock(() => ({
        url,
        title: 'Test',
        timestamp: new Date().toISOString(),
        headings: [],
        links: [],
        wordCount: 1,
        contentType: 'text/html',
      }) as Metadata);

      mockFileWriter.write = mock(() => Promise.resolve({
        success: true,
        path: '/test/output/sanitized.md',
        skipped: false,
      }));

      const options: UrlProcessorOptions = {
        outputDir,
      };

      await processor.process(url, options);

      const filenameArg = mockFileWriter.write.mock.calls[0][0] as string;
      expect(filenameArg.includes('?')).toBe(false);
      expect(filenameArg.includes('&')).toBe(false);
      expect(filenameArg.includes('=')).toBe(false);
    });
  });
});
