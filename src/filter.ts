/**
 * Content filtering using Mozilla Readability
 * Extracts main content from HTML, removing navigation, ads, sidebars, footers
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { FilterResult, FilterOptions, DEFAULT_FILTER_OPTIONS } from './types.js';

/**
 * Error class for filter-related errors
 */
export class FilterError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'FilterError';
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FilterError);
    }
  }
}

/**
 * ContentFilter class for extracting main content from HTML
 * Uses Mozilla Readability to remove boilerplate content
 */
export class ContentFilter {
  private options: Required<FilterOptions>;

  constructor(options?: FilterOptions) {
    this.options = { ...DEFAULT_FILTER_OPTIONS, ...options };
  }

  /**
   * Filters HTML to extract main content
   * @param html - Raw HTML content to filter
   * @param url - URL of the page (used for resolving relative links)
   * @returns FilterResult containing filtered content or null on failure
   */
  filter(html: string, url: string): FilterResult {
    if (!html || html.trim().length === 0) {
      return {
        content: null,
        title: null,
        textContent: null,
        length: 0,
        excerpt: null,
        byline: null,
        dir: null,
        siteName: null,
        lang: null,
        publishedTime: null,
        success: false,
        error: 'Empty HTML content provided',
      };
    }

    try {
      // Create a JSDOM instance with the URL for proper link resolution
      const dom = new JSDOM(html, { url });

      // Create Readability instance and parse
      const reader = new Readability(dom.window.document, {
        charThreshold: this.options.charThreshold,
        debug: this.options.debug,
      });

      const article = reader.parse();

      if (!article) {
        // Readability couldn't parse - return failure with fallback indication
        return {
          content: null,
          title: null,
          textContent: null,
          length: 0,
          excerpt: null,
          byline: null,
          dir: null,
          siteName: null,
          lang: null,
          publishedTime: null,
          success: false,
          error: 'Readability could not extract content from the page',
        };
      }

      // Successfully parsed - return filtered content
      return {
        content: article.content,
        title: article.title ?? null,
        textContent: article.textContent ?? null,
        length: article.length,
        excerpt: article.excerpt ?? null,
        byline: article.byline ?? null,
        dir: article.dir ?? null,
        siteName: article.siteName ?? null,
        lang: article.lang ?? null,
        publishedTime: article.publishedTime ?? null,
        success: true,
        error: null,
      };
    } catch (error) {
      const err = error as Error;
      return {
        content: null,
        title: null,
        textContent: null,
        length: 0,
        excerpt: null,
        byline: null,
        dir: null,
        siteName: null,
        lang: null,
        publishedTime: null,
        success: false,
        error: `Filter error: ${err.message}`,
      };
    }
  }

  /**
   * Filters HTML with fallback to raw HTML if filtering fails
   * @param html - Raw HTML content to filter
   * @param url - URL of the page
   * @returns Object containing filtered HTML (or original if filtering failed) and metadata
   */
  filterWithFallback(html: string, url: string): { html: string; metadata: FilterResult } {
    const result = this.filter(html, url);

    if (result.success && result.content) {
      return {
        html: result.content,
        metadata: result,
      };
    }

    // Fallback to raw HTML
    return {
      html: html,
      metadata: {
        ...result,
        content: html,
        success: false,
        error: result.error ?? 'Using raw HTML as fallback',
      },
    };
  }

  /**
   * Check if content filtering is likely to benefit this HTML
   * @param html - HTML content to analyze
   * @returns True if the page appears to be an article/blog post
   */
  isArticleLike(html: string): boolean {
    if (!html || html.trim().length === 0) {
      return false;
    }

    // Simple heuristics to detect if content filtering would be useful
    const articleIndicators = [
      /<article[^>]*>/i,
      /<main[^>]*>/i,
      /class=["'][^"']*\b(article|post|content|entry)\b[^"']*["']/i,
      /<meta[^>]*property=["']article:/i,
      /<meta[^>]*name=["']author["']/i,
    ];

    return articleIndicators.some(pattern => pattern.test(html));
  }
}

/**
 * Convenience function to filter HTML content
 * @param html - Raw HTML content
 * @param url - URL of the page
 * @param options - Filter options
 * @returns Filtered content or null
 */
export function filterContent(
  html: string,
  url: string,
  options?: FilterOptions
): FilterResult {
  const filter = new ContentFilter(options);
  return filter.filter(html, url);
}

/**
 * Convenience function to filter HTML with fallback
 * @param html - Raw HTML content
 * @param url - URL of the page
 * @param options - Filter options
 * @returns Filtered HTML (or original if filtering failed) and metadata
 */
export function filterContentWithFallback(
  html: string,
  url: string,
  options?: FilterOptions
): { html: string; metadata: FilterResult } {
  const filter = new ContentFilter(options);
  return filter.filterWithFallback(html, url);
}
