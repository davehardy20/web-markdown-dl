import { chromium, Browser, BrowserContext, Page, Request, Response, errors } from 'playwright';
const { TimeoutError } = errors;
import {
  ScraperOptions,
  ScraperResult,
  ScraperError,
  DEFAULT_SCRAPER_OPTIONS,
} from './types.js';
import { withRetry, RetryableError } from './utils/retry.js';
import { Logger } from './utils/logger.js';

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

/** Headers to redact for security (case-insensitive matching) */
const SENSITIVE_HEADERS = ['cookie', 'authorization', 'x-api-key'];

export class Scraper {
  private options: Required<ScraperOptions>;
  private browser: Browser | null = null;
  private contextPool: PooledContext[] = [];
  private maxContexts = 5;
  private poolMutex = Promise.resolve();
  private logger: Logger | null = null;

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
      maxResponseSize: options.maxResponseSize ?? DEFAULT_SCRAPER_OPTIONS.maxResponseSize,
      verbose: options.verbose ?? DEFAULT_SCRAPER_OPTIONS.verbose,
      logFile: options.logFile ?? DEFAULT_SCRAPER_OPTIONS.logFile,
    };

    if (this.options.verbose) {
      this.logger = new Logger({ logFile: this.options.logFile });
    }
  }

  private redactSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.includes(lowerKey)) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  private async logRequest(request: Request): Promise<void> {
    if (!this.logger) return;
    try {
      const url = request.url();
      const method = request.method();
      const headers = this.redactSensitiveHeaders(request.headers());
      await this.logger.debug('REQUEST', { url, method, headers });
    } catch {
      // Silently ignore logging errors
    }
  }

  private async logResponse(response: Response): Promise<void> {
    if (!this.logger) return;
    try {
      const url = response.url();
      const status = response.status();
      const headers = this.redactSensitiveHeaders(response.headers());
      const contentType = headers['content-type'] ?? 'unknown';
      const request = response.request();
      await this.logger.debug('RESPONSE', { 
        url, 
        status, 
        contentType,
        requestMethod: request.method()
      });
    } catch {
      // Silently ignore logging errors
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    await this.logger?.debug('launching browser');
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
      await this.logger?.debug('browser launched successfully');
      return this.browser;
    } catch (error) {
      throw ScraperError.fromBrowserError(error as Error);
    }
  }

  private async acquireMutexAndGetContext(): Promise<BrowserContext> {
    const inUseCount = this.contextPool.filter(c => c.inUse).length;
    await this.logger?.debug('acquiring context', { poolSize: this.contextPool.length, inUse: inUseCount });
    
    const availableContext = this.contextPool.find(c => !c.inUse);
    if (availableContext) {
      availableContext.inUse = true;
      await this.clearContextStorage(availableContext.context);
      await this.logger?.debug('context acquired from pool', { poolSize: this.contextPool.length });
      return availableContext.context;
    }

    if (this.contextPool.length < this.maxContexts) {
      const browser = await this.ensureBrowser();
      const context = await browser.newContext({
        userAgent: this.options.userAgent,
      });
      this.contextPool.push({ context, inUse: true });
      await this.logger?.debug('new context created', { poolSize: this.contextPool.length, maxContexts: this.maxContexts });
      return context;
    }

    await this.logger?.debug('waiting for available context (pool exhausted)');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const ctx = this.contextPool.find(c => !c.inUse);
        if (ctx) {
          clearInterval(checkInterval);
          ctx.inUse = true;
          await this.clearContextStorage(ctx.context);
          await this.logger?.debug('context acquired after wait');
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
      const inUseCount = this.contextPool.filter(c => c.inUse).length;
      this.logger?.debug('context released', { poolSize: this.contextPool.length, inUse: inUseCount }).catch(() => {});
    }
  }

  private async clearContextStorage(context: BrowserContext): Promise<void> {
    await this.logger?.debug('clearing context storage');
    try {
      await context.clearCookies();
      const pages = context.pages();
      await this.logger?.debug('context storage cleared', { pageCount: pages.length });
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

        if (this.logger) {
          page.on('request', (request: Request) => {
            this.logRequest(request).catch(() => {});
          });

          page.on('response', (response: Response) => {
            this.logResponse(response).catch(() => {});
          });
        }

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

        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          const size = parseInt(contentLength, 10);
          if (!isNaN(size) && size > this.options.maxResponseSize) {
            throw ScraperError.fromResponseSizeExceeded(url, size, this.options.maxResponseSize);
          }
        }

        const html = await page.content();
        
        if (Buffer.byteLength(html, 'utf8') > this.options.maxResponseSize) {
          throw ScraperError.fromResponseSizeExceeded(
            url, 
            Buffer.byteLength(html, 'utf8'), 
            this.options.maxResponseSize
          );
        }
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
        onRetry: (attempt: number, error: Error, delay: number) => {
          this.logger?.debug('retry attempt', { 
            url, 
            attempt, 
            maxRetries: this.options.maxRetries,
            delay,
            error: error.message 
          }).catch(() => {});
        },
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
    await this.logger?.debug('closing scraper', { contextPoolSize: this.contextPool.length, hasBrowser: !!this.browser });
    await Promise.all(
      this.contextPool.map(async (pooled) => {
        try {
          await pooled.context.close();
        } catch {}
      })
    );
    this.contextPool = [];
    await this.logger?.debug('all contexts closed');
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      await this.logger?.debug('browser closed');
    }
  }
}
