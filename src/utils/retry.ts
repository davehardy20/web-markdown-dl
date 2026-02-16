import { ScraperError, ScraperErrorType } from '../types.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface RetryableError extends Error {
  statusCode?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;
const DEFAULT_JITTER = true;
const JITTER_RANGE = 0.2;

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRYABLE_ERROR_TYPES: ScraperErrorType[] = ['timeout', 'network'];
const NON_RETRYABLE_PATTERNS = ['enotfound', 'econnrefused', 'dns'];

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ScraperError) {
    if (!RETRYABLE_ERROR_TYPES.includes(error.type)) {
      return false;
    }
    const message = error.message.toLowerCase();
    for (const pattern of NON_RETRYABLE_PATTERNS) {
      if (message.includes(pattern)) {
        return false;
      }
    }
    return true;
  }

  const err = error as RetryableError;
  if (err.statusCode) {
    return RETRYABLE_STATUS_CODES.has(err.statusCode);
  }

  const message = err.message?.toLowerCase() || '';
  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (message.includes(pattern)) {
      return false;
    }
  }

  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset')
  ) {
    return true;
  }

  for (const code of RETRYABLE_STATUS_CODES) {
    if (message.includes(String(code))) {
      return true;
    }
  }

  return false;
}

function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  useJitter: boolean
): number {
  let delay = baseDelay * Math.pow(2, attempt - 1);
  delay = Math.min(delay, maxDelay);

  if (useJitter) {
    const jitterAmount = delay * JITTER_RANGE;
    const jitter = (Math.random() * 2 - 1) * jitterAmount;
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelay ?? DEFAULT_BASE_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
  const useJitter = options.jitter ?? DEFAULT_JITTER;
  const onRetry = options.onRetry;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt >= maxRetries) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay, useJitter);

      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}
