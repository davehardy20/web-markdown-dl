import { chromium, Browser, BrowserContext, Page, errors } from 'playwright';
const { TimeoutError } = errors;
import {
  ScraperOptions,
  ScraperResult,
  ScraperError,
  DEFAULT_SCRAPER_OPTIONS,
} from './types.js';
import { withRetry, RetryableError } from './utils/retry.js';

export class Scraper {
  private options: Required<ScraperOptions>;
  private browser: Browser | null = null;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      timeout: options.timeout ?? DEFAULT_SCRAPER_OPTIONS.timeout,
      userAgent: options.userAgent ?? DEFAULT_SCRAPER_OPTIONS.userAgent,
      waitUntil: options.waitUntil ?? DEFAULT_SCRAPER_OPTIONS.waitUntil,
      maxRetries: options.maxRetries ?? DEFAULT_SCRAPER_OPTIONS.maxRetries,
      retryBaseDelay: options.retryBaseDelay ?? DEFAULT_SCRAPER_OPTIONS.retryBaseDelay,
      retryMaxDelay: options.retryMaxDelay ?? DEFAULT_SCRAPER_OPTIONS.retryMaxDelay,
      retryJitter: options.retryJitter ?? DEFAULT_SCRAPER_OPTIONS.retryJitter,
    };
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });
      return this.browser;
    } catch (error) {
      throw ScraperError.fromBrowserError(error as Error);
    }
  }

  async scrape(url: string): Promise<ScraperResult> {
    const browser = await this.ensureBrowser();

    const performScrape = async (): Promise<ScraperResult> => {
      let context: BrowserContext | null = null;
      let page: Page | null = null;

      try {
        context = await browser.newContext({
          userAgent: this.options.userAgent,
        });

        page = await context.newPage();

        const response = await page.goto(url, {
          waitUntil: this.options.waitUntil,
          timeout: this.options.timeout,
        });

        if (!response) {
          const error = new Error(`No response received for ${url}`) as RetryableError;
          error.statusCode = 0;
          throw error;
        }

        const statusCode = response.status();
        
        if (statusCode >= 500 && statusCode !== 501) {
          const error = new Error(`HTTP ${statusCode}`) as RetryableError;
          error.statusCode = statusCode;
          throw error;
        }

        const html = await page.content();
        const finalUrl = page.url();
        const title = await page.title();

        return {
          html,
          url: finalUrl,
          title,
          statusCode,
        };
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
        if (context) {
          await context.close().catch(() => {});
        }
      }
    };

    try {
      return await withRetry(performScrape, {
        maxRetries: this.options.maxRetries,
        baseDelay: this.options.retryBaseDelay,
        maxDelay: this.options.retryMaxDelay,
        jitter: this.options.retryJitter,
      });
    } catch (error: unknown) {
      if (error instanceof ScraperError) {
        throw error;
      }

      const err = error as Error & { statusCode?: number };
      if (err instanceof TimeoutError) {
        throw ScraperError.fromTimeoutError(err, url);
      }

      const errorMessage = err.message.toLowerCase();
      if (
        errorMessage.includes('net::err') ||
        errorMessage.includes('network') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('enotfound')
      ) {
        throw ScraperError.fromNetworkError(err, url);
      }

      if (err.statusCode && err.statusCode >= 500) {
        throw ScraperError.fromNetworkError(err, url);
      }

      throw ScraperError.fromNavigationError(err, url);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
