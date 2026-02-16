import { chromium, Browser, BrowserContext, Page, errors } from 'playwright';
const { TimeoutError } = errors;
import {
  ScraperOptions,
  ScraperResult,
  ScraperError,
  DEFAULT_SCRAPER_OPTIONS,
} from './types.js';
import { withRetry, RetryableError } from './utils/retry.js';

function isValidContentType(contentType: string | null | undefined): boolean {
  if (contentType == null || contentType === '') {
    return true;
  }
  const parts = contentType.toLowerCase().split(';');
  const normalizedType = (parts[0] ?? '').trim();
  if (normalizedType.startsWith('text/')) {
    return true;
  }
  const validTypes = ['text/html', 'application/xhtml+xml'];
  return validTypes.includes(normalizedType);
}

interface PooledContext {
  context: BrowserContext;
  inUse: boolean;
}

export class Scraper {
  private options: Required<ScraperOptions>;
  private browser: Browser | null = null;
  private contextPool: PooledContext[] = [];
  private maxContexts = 5;
  private poolMutex = Promise.resolve();

  constructor(options: ScraperOptions = {}) {
    this.options = {
      timeout: options.timeout ?? DEFAULT_SCRAPER_OPTIONS.timeout,
      userAgent: options.userAgent ?? DEFAULT_SCRAPER_OPTIONS.userAgent,
      waitUntil: options.waitUntil ?? DEFAULT_SCRAPER_OPTIONS.waitUntil,
      maxRetries: options.maxRetries ?? DEFAULT_SCRAPER_OPTIONS.maxRetries,
      retryBaseDelay: options.retryBaseDelay ?? DEFAULT_SCRAPER_OPTIONS.retryBaseDelay,
      retryMaxDelay: options.retryMaxDelay ?? DEFAULT_SCRAPER_OPTIONS.retryMaxDelay,
      retryJitter: options.retryJitter ?? DEFAULT_SCRAPER_OPTIONS.retryJitter,
      validateContentType: options.validateContentType ?? DEFAULT_SCRAPER_OPTIONS.validateContentType,
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

  private async acquireMutexAndGetContext(): Promise<BrowserContext> {
    const availableContext = this.contextPool.find(c => !c.inUse);
    if (availableContext) {
      availableContext.inUse = true;
      await this.clearContextStorage(availableContext.context);
      return availableContext.context;
    }

    if (this.contextPool.length < this.maxContexts) {
      const browser = await this.ensureBrowser();
      const context = await browser.newContext({
        userAgent: this.options.userAgent,
      });
      this.contextPool.push({ context, inUse: true });
      return context;
    }

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const ctx = this.contextPool.find(c => !c.inUse);
        if (ctx) {
          clearInterval(checkInterval);
          ctx.inUse = true;
          await this.clearContextStorage(ctx.context);
          resolve(ctx.context);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available context'));
      }, 30000);
    });
  }

  private async getContext(): Promise<BrowserContext> {
    const acquirePromise = this.poolMutex.then(() => this.acquireMutexAndGetContext());
    this.poolMutex = acquirePromise.then(() => undefined, () => undefined);
    return acquirePromise;
  }

  private releaseContext(context: BrowserContext): void {
    const pooledContext = this.contextPool.find(c => c.context === context);
    if (pooledContext) {
      pooledContext.inUse = false;
    }
  }

  private async clearContextStorage(context: BrowserContext): Promise<void> {
    try {
      await context.clearCookies();
      const pages = context.pages();
      for (const page of pages) {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        }).catch(() => {});
      }
    } catch {
      // Ignore errors during cleanup - context might be closed
    }
  }

  async scrape(url: string): Promise<ScraperResult> {
    const performScrape = async (): Promise<ScraperResult> => {
      let context: BrowserContext | null = null;
      let page: Page | null = null;

      try {
        context = await this.getContext();
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

        if (this.options.validateContentType) {
          const contentType = response.headers()['content-type'];
          if (!isValidContentType(contentType)) {
            throw ScraperError.fromContentTypeError(contentType || 'unknown', url);
          }
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
          this.releaseContext(context);
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
    await Promise.all(
      this.contextPool.map(async (pooled) => {
        try {
          await pooled.context.close();
        } catch {}
      })
    );
    this.contextPool = [];
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
