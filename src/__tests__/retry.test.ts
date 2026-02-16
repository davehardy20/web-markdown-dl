import { describe, it, expect, mock } from 'bun:test';
import { withRetry, isRetryableError, RetryableError } from '../utils/retry.js';
import { ScraperError } from '../types.js';

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt (no retries needed)', async () => {
      const operation = mock(() => Promise.resolve('success'));
      
      const result = await withRetry(operation, { maxRetries: 3 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should succeed on second attempt after transient failure', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should succeed on third attempt after multiple failures', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount <= 2) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts exceeded', async () => {
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => Promise.reject(error));
      
      const resultPromise = withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      await expect(resultPromise).rejects.toThrow('Timeout');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail immediately for non-retryable errors (no retry)', async () => {
      const error = new ScraperError('Not Found', 'navigation', 'https://example.com');
      const operation = mock(() => Promise.reject(error));
      
      await expect(withRetry(operation, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow('Not Found');
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry 400 Bad Request', async () => {
      const error = new Error('HTTP 400 Bad Request') as RetryableError;
      error.statusCode = 400;
      const operation = mock(() => Promise.reject(error));
      
      await expect(withRetry(operation, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry 401 Unauthorized', async () => {
      const error = new Error('HTTP 401 Unauthorized') as RetryableError;
      error.statusCode = 401;
      const operation = mock(() => Promise.reject(error));
      
      await expect(withRetry(operation, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry 403 Forbidden', async () => {
      const error = new Error('HTTP 403 Forbidden') as RetryableError;
      error.statusCode = 403;
      const operation = mock(() => Promise.reject(error));
      
      await expect(withRetry(operation, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should not retry 404 Not Found', async () => {
      const error = new Error('HTTP 404 Not Found') as RetryableError;
      error.statusCode = 404;
      const operation = mock(() => Promise.reject(error));
      
      await expect(withRetry(operation, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toThrow();
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on HTTP 502 Bad Gateway', async () => {
      let callCount = 0;
      const error = new Error('HTTP 502 Bad Gateway') as RetryableError;
      error.statusCode = 502;
      const operation = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on HTTP 503 Service Unavailable', async () => {
      let callCount = 0;
      const error = new Error('HTTP 503 Service Unavailable') as RetryableError;
      error.statusCode = 503;
      const operation = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on HTTP 504 Gateway Timeout', async () => {
      let callCount = 0;
      const error = new Error('HTTP 504 Gateway Timeout') as RetryableError;
      error.statusCode = 504;
      const operation = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const result = await withRetry(operation, { maxRetries: 3, baseDelay: 10 });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback on each retry', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount <= 2) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const retryInfo: Array<{ attempt: number; error: Error; delay: number }> = [];
      const onRetry = (attempt: number, err: Error, delay: number) => {
        retryInfo.push({ attempt, error: err, delay });
      };
      
      await withRetry(operation, { 
        maxRetries: 3, 
        baseDelay: 100, 
        jitter: false,
        onRetry 
      });
      
      expect(retryInfo).toHaveLength(2);
      expect(retryInfo[0].attempt).toBe(1);
      expect(retryInfo[0].delay).toBe(100);
      expect(retryInfo[1].attempt).toBe(2);
      expect(retryInfo[1].delay).toBe(200);
    });

    it('should respect maxDelay option', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount <= 3) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const retryInfo: Array<{ delay: number }> = [];
      const onRetry = (_attempt: number, _err: Error, delay: number) => {
        retryInfo.push({ delay });
      };
      
      await withRetry(operation, { 
        maxRetries: 4, 
        baseDelay: 10, 
        maxDelay: 30,
        jitter: false,
        onRetry 
      });
      
      expect(retryInfo[0].delay).toBe(10);
      expect(retryInfo[1].delay).toBe(20);
      expect(retryInfo[2].delay).toBe(30);
    });

    it('should apply exponential backoff correctly', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount <= 3) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const retryInfo: Array<{ delay: number }> = [];
      const onRetry = (_attempt: number, _err: Error, delay: number) => {
        retryInfo.push({ delay });
      };
      
      await withRetry(operation, { 
        maxRetries: 4, 
        baseDelay: 10, 
        jitter: false,
        onRetry 
      });
      
      expect(retryInfo[0].delay).toBe(10);
      expect(retryInfo[1].delay).toBe(20);
      expect(retryInfo[2].delay).toBe(40);
    });

    it('should apply jitter to delays', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount <= 2) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const retryInfo: Array<{ delay: number }> = [];
      const onRetry = (_attempt: number, _err: Error, delay: number) => {
        retryInfo.push({ delay });
      };
      
      await withRetry(operation, { 
        maxRetries: 3, 
        baseDelay: 1000, 
        jitter: true,
        onRetry 
      });
      
      expect(retryInfo[0].delay).toBeGreaterThanOrEqual(800);
      expect(retryInfo[0].delay).toBeLessThanOrEqual(1200);
      expect(retryInfo[1].delay).toBeGreaterThanOrEqual(1600);
      expect(retryInfo[1].delay).toBeLessThanOrEqual(2400);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for timeout errors', () => {
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for network errors', () => {
      const error = new ScraperError('Network error', 'network', 'https://example.com');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for HTTP 502', () => {
      const error = new Error('Bad Gateway') as RetryableError;
      error.statusCode = 502;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for HTTP 503', () => {
      const error = new Error('Service Unavailable') as RetryableError;
      error.statusCode = 503;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for HTTP 504', () => {
      const error = new Error('Gateway Timeout') as RetryableError;
      error.statusCode = 504;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for navigation errors', () => {
      const error = new ScraperError('Not found', 'navigation', 'https://example.com');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for HTTP 400', () => {
      const error = new Error('Bad Request') as RetryableError;
      error.statusCode = 400;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for HTTP 401', () => {
      const error = new Error('Unauthorized') as RetryableError;
      error.statusCode = 401;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for HTTP 403', () => {
      const error = new Error('Forbidden') as RetryableError;
      error.statusCode = 403;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for HTTP 404', () => {
      const error = new Error('Not Found') as RetryableError;
      error.statusCode = 404;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for DNS errors (ENOTFOUND)', () => {
      const error = new Error('ENOTFOUND example.com') as RetryableError;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for connection refused (ECONNREFUSED)', () => {
      const error = new Error('ECONNREFUSED 127.0.0.1:80') as RetryableError;
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for browser errors', () => {
      const error = new ScraperError('Browser crash', 'browser');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for unknown errors', () => {
      const error = new ScraperError('Unknown error', 'unknown');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for network error with ECONNRESET', () => {
      const error = new Error('ECONNRESET connection reset') as RetryableError;
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for network error with ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT connection timed out') as RetryableError;
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('Default options', () => {
    it('should use default maxRetries of 3', async () => {
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => Promise.reject(error));
      
      try {
        await withRetry(operation, { baseDelay: 10 });
      } catch {
        // Expected
      }
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use default baseDelay of 1000ms', async () => {
      let callCount = 0;
      const error = new ScraperError('Timeout', 'timeout', 'https://example.com');
      const operation = mock(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(error);
        return Promise.resolve('success');
      });
      
      const retryInfo: Array<{ delay: number }> = [];
      const onRetry = (_attempt: number, _err: Error, delay: number) => {
        retryInfo.push({ delay });
      };
      
      await withRetry(operation, { jitter: false, onRetry });
      
      expect(retryInfo[0].delay).toBe(1000);
    });
  });
});
