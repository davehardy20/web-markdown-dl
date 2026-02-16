import { describe, it, expect, afterEach } from 'bun:test';
import { Scraper } from '../scraper.js';
import { ScraperError, DEFAULT_SCRAPER_OPTIONS } from '../types.js';

describe('Response Size Limits', () => {
  let scraper: Scraper;

  afterEach(async () => {
    if (scraper) {
      await scraper.close();
    }
  });

  describe('Default Configuration', () => {
    it('should have default maxResponseSize of 50MB', () => {
      expect(DEFAULT_SCRAPER_OPTIONS.maxResponseSize).toBe(50 * 1024 * 1024);
    });

    it('should create scraper with default maxResponseSize', () => {
      scraper = new Scraper();
      expect(scraper).toBeDefined();
    });
  });

  describe('Custom Configuration', () => {
    it('should accept custom maxResponseSize option', () => {
      scraper = new Scraper({ maxResponseSize: 1024 });
      expect(scraper).toBeDefined();
    });

    it('should accept maxResponseSize of 0 (disable limit)', () => {
      scraper = new Scraper({ maxResponseSize: 0 });
      expect(scraper).toBeDefined();
    });
  });
});

describe('ScraperError for response size exceeded', () => {
  it('should have response-size-exceeded error type', () => {
    const error = new ScraperError(
      'Response too large',
      'response-size-exceeded',
      'https://example.com/large'
    );
    
    expect(error).toBeInstanceOf(ScraperError);
    expect(error.type).toBe('response-size-exceeded');
    expect(error.url).toBe('https://example.com/large');
  });

  it('should create error with fromResponseSizeExceeded factory', () => {
    const error = ScraperError.fromResponseSizeExceeded(
      'https://example.com/large',
      100000000,
      50000000
    );
    
    expect(error).toBeInstanceOf(ScraperError);
    expect(error.type).toBe('response-size-exceeded');
    expect(error.message).toContain('100000000');
    expect(error.message).toContain('50000000');
    expect(error.message).toContain('https://example.com/large');
  });

  it('should include size values in error message', () => {
    const error = ScraperError.fromResponseSizeExceeded(
      'https://test.com/file',
      60000000,
      52428800
    );
    
    expect(error.message).toBe(
      'Response size 60000000 bytes exceeds maximum 52428800 bytes for https://test.com/file'
    );
  });
});
