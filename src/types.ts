/**
 * Type definitions for web-markdown-dl scraper module
 */

/**
 * Navigation wait conditions - determines when navigation is considered complete
 */
export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

/**
 * Configuration options for the Scraper class
 */
export interface ScraperOptions {
  /** 
   * Maximum time to wait for navigation in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * User agent string to use for requests
   * @default 'web-markdown-dl/1.0'
   */
  userAgent?: string;

  /**
   * When to consider navigation complete
   * @default 'networkidle'
   */
  waitUntil?: WaitUntil;

  /**
   * Maximum number of retry attempts for transient failures
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for exponential backoff
   * @default 1000
   */
  retryBaseDelay?: number;

  /**
   * Maximum delay in milliseconds for exponential backoff
   * @default 30000
   */
  retryMaxDelay?: number;

  /**
   * Enable jitter for retry delays to prevent thundering herd
   * @default true
   */
  retryJitter?: boolean;

  /**
   * Enable content-type validation to reject non-HTML responses
   * @default false
   */
  validateContentType?: boolean;
}

export const DEFAULT_SCRAPER_OPTIONS: Required<ScraperOptions> = {
  timeout: 30000,
  userAgent: 'web-markdown-dl/1.0',
  waitUntil: 'networkidle',
  maxRetries: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 30000,
  retryJitter: true,
  validateContentType: false,
};

/**
 * Result returned after scraping a URL
 */
export interface ScraperResult {
  /** The HTML content of the page */
  html: string;

  /** The final URL (may differ from input if redirects occurred) */
  url: string;

  /** The page title */
  title: string;

  /** HTTP status code of the response */
  statusCode: number;
}

/**
 * Error types that can occur during scraping
 */
export type ScraperErrorType = 
  | 'timeout'
  | 'network'
  | 'navigation'
  | 'browser'
  | 'invalid-content-type'
  | 'unknown';

/**
 * Custom error class for scraper-related errors
 */
export class ScraperError extends Error {
  public readonly type: ScraperErrorType;
  public readonly url?: string;
  public readonly cause?: Error;

  constructor(
    message: string,
    type: ScraperErrorType,
    url?: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'ScraperError';
    this.type = type;
    this.url = url;
    this.cause = cause;

    // Maintains proper stack trace for where error was thrown (only in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScraperError);
    }
  }

  /**
   * Creates a ScraperError from a Playwright TimeoutError
   */
  static fromTimeoutError(error: Error, url: string): ScraperError {
    return new ScraperError(
      `Timeout while loading ${url}: ${error.message}`,
      'timeout',
      url,
      error
    );
  }

  /**
   * Creates a ScraperError from a network-related error
   */
  static fromNetworkError(error: Error, url: string): ScraperError {
    return new ScraperError(
      `Network error while loading ${url}: ${error.message}`,
      'network',
      url,
      error
    );
  }

  /**
   * Creates a ScraperError from a navigation error
   */
  static fromNavigationError(error: Error, url: string): ScraperError {
    return new ScraperError(
      `Navigation error for ${url}: ${error.message}`,
      'navigation',
      url,
      error
    );
  }

    /**
     * Creates a ScraperError from a browser-related error
     */
    static fromBrowserError(error: Error): ScraperError {
      return new ScraperError(
        `Browser error: ${error.message}`,
        'browser',
        undefined,
        error
      );
    }

    /**
     * Creates a ScraperError from an invalid content-type response
     */
    static fromContentTypeError(contentType: string, url: string): ScraperError {
      return new ScraperError(
        `Invalid content-type "${contentType}" for ${url}. Expected HTML content.`,
        'invalid-content-type',
        url
      );
    }
  }

/**
 * Filter configuration options
 */
export interface FilterOptions {
  /** Minimum characters needed for content detection */
  charThreshold?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default filter options
 */
export const DEFAULT_FILTER_OPTIONS: Required<FilterOptions> = {
  charThreshold: 500,
  debug: false,
};

/**
 * Result from content filtering
 */
export interface FilterResult {
  /** Filtered HTML content (null if filtering failed) */
  content: string | null;

  /** Article title */
  title: string | null;

  /** Plain text content */
  textContent: string | null;

  /** Length of text content */
  length: number;

  /** Article excerpt/summary */
  excerpt: string | null;

  /** Author byline */
  byline: string | null;

  /** Text direction */
  dir: string | null;

  /** Site name */
  siteName: string | null;

  /** Content language */
  lang: string | null;

  /** Published time */
  publishedTime: string | null;

  /** Whether filtering succeeded */
  success: boolean;

  /** Error message if filtering failed */
  error: string | null;
}

/**
 * Heading structure extracted from HTML
 */
export interface Heading {
  /** Heading level (1-6) */
  level: number;
  /** Heading text content */
  text: string;
}

/**
 * Link extracted from HTML
 */
export interface Link {
  /** Link text content */
  text: string;
  /** Link href URL */
  href: string;
}

/**
 * Metadata extracted from a web page
 */
export interface Metadata {
  /** Source URL of the page */
  url: string;
  /** Page title */
  title: string;
  /** Meta description or first paragraph */
  description?: string;
  /** Author from meta tags or byline */
  author?: string;
  /** Publication date from meta tags */
  publishedDate?: string;
  /** ISO 8601 timestamp when metadata was extracted (UTC) */
  timestamp: string;
  /** All headings (h1-h6) with hierarchy */
  headings: Heading[];
  /** All links with text and href */
  links: Link[];
  /** Word count of the content */
  wordCount: number;
  /** Content type (e.g., 'text/html') */
  contentType: string;
}

/**
 * Result from the complete scraping pipeline
 */
export interface ScrapingResult {
  /** Converted markdown content */
  markdown: string;
  /** Extracted metadata */
  metadata: Metadata;
  /** Optional raw HTML content */
  html?: string;
}
