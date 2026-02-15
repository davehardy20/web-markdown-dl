import { chromium, Browser, BrowserContext, Page, errors } from 'playwright';
const { TimeoutError } = errors;
import {
  ScraperOptions,
  ScraperResult,
  ScraperError,
  DEFAULT_SCRAPER_OPTIONS,
} from './types.js';

export class Scraper {
  private options: Required<ScraperOptions>;
  private browser: Browser | null = null;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      timeout: options.timeout ?? DEFAULT_SCRAPER_OPTIONS.timeout,
      userAgent: options.userAgent ?? DEFAULT_SCRAPER_OPTIONS.userAgent,
      waitUntil: options.waitUntil ?? DEFAULT_SCRAPER_OPTIONS.waitUntil,
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
        throw new ScraperError(
          `No response received for ${url}`,
          'navigation',
          url
        );
      }

      const statusCode = response.status();
      const html = await page.content();
      const finalUrl = page.url();
      const title = await page.title();

      return {
        html,
        url: finalUrl,
        title,
        statusCode,
      };
    } catch (error: unknown) {
      if (error instanceof ScraperError) {
        throw error;
      }

      const err = error as Error;
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

      throw ScraperError.fromNavigationError(err, url);
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      if (context) {
        await context.close().catch(() => {});
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
