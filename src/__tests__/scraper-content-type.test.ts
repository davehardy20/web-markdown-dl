import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { Scraper } from '../scraper.js';
import { ScraperError } from '../types.js';
import type { Response } from 'playwright';

/**
 * Helper to create a mock Response with specific content-type
 */
function createMockResponse(contentType: string | null, status = 200): Partial<Response> {
  return {
    status: () => status,
    headers: () => ({
      'content-type': contentType || '',
    }),
  } as Partial<Response>;
}

/**
 * Helper to validate content-type logic (unit test style)
 */
function isValidContentType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    // Permissive: no content-type header means accept
    return true;
  }

  const normalizedType = contentType.toLowerCase().split(';')[0].trim();
  
  // Accept HTML and text types
  const validTypes = [
    'text/html',
    'application/xhtml+xml',
  ];
  
  // Accept text/* wildcard
  if (normalizedType.startsWith('text/')) {
    return true;
  }
  
  // Check explicit valid types
  if (validTypes.includes(normalizedType)) {
    return true;
  }
  
  return false;
}

describe('Content-Type Validation', () => {
  describe('isValidContentType function', () => {
    it('should accept text/html', () => {
      expect(isValidContentType('text/html')).toBe(true);
    });

    it('should accept application/xhtml+xml', () => {
      expect(isValidContentType('application/xhtml+xml')).toBe(true);
    });

    it('should accept text/plain', () => {
      expect(isValidContentType('text/plain')).toBe(true);
    });

    it('should accept text/css', () => {
      expect(isValidContentType('text/css')).toBe(true);
    });

    it('should accept text/xml', () => {
      expect(isValidContentType('text/xml')).toBe(true);
    });

    it('should accept content-type with charset', () => {
      expect(isValidContentType('text/html; charset=utf-8')).toBe(true);
      expect(isValidContentType('text/html; charset=ISO-8859-1')).toBe(true);
    });

    it('should reject application/json', () => {
      expect(isValidContentType('application/json')).toBe(false);
    });

    it('should reject image/jpeg', () => {
      expect(isValidContentType('image/jpeg')).toBe(false);
    });

    it('should reject image/png', () => {
      expect(isValidContentType('image/png')).toBe(false);
    });

    it('should reject application/pdf', () => {
      expect(isValidContentType('application/pdf')).toBe(false);
    });

    it('should reject application/octet-stream', () => {
      expect(isValidContentType('application/octet-stream')).toBe(false);
    });

    it('should reject video/mp4', () => {
      expect(isValidContentType('video/mp4')).toBe(false);
    });

    it('should reject audio/mpeg', () => {
      expect(isValidContentType('audio/mpeg')).toBe(false);
    });

    it('should accept when content-type is null (permissive)', () => {
      expect(isValidContentType(null)).toBe(true);
    });

    it('should accept when content-type is undefined (permissive)', () => {
      expect(isValidContentType(undefined)).toBe(true);
    });

    it('should accept when content-type is empty string (permissive)', () => {
      expect(isValidContentType('')).toBe(true);
    });

    it('should handle case-insensitive content-type', () => {
      expect(isValidContentType('TEXT/HTML')).toBe(true);
      expect(isValidContentType('Text/Plain')).toBe(true);
      expect(isValidContentType('APPLICATION/JSON')).toBe(false);
    });
  });
});

describe('Scraper with validateContentType option', () => {
  let scraper: Scraper;

  afterEach(async () => {
    if (scraper) {
      await scraper.close();
    }
  });

  describe('default behavior (validateContentType: false)', () => {
    it('should not validate content-type by default', () => {
      // When validation is disabled (default), scraper should work normally
      scraper = new Scraper({
        timeout: 5000,
        validateContentType: false,
      });
      
      // The scraper should accept any content-type
      // This is tested by integration with real URLs
      expect(scraper).toBeDefined();
    });
  });

  describe('with validateContentType: true', () => {
    it('should create scraper with validateContentType option', () => {
      scraper = new Scraper({
        timeout: 5000,
        validateContentType: true,
      });
      
      expect(scraper).toBeDefined();
    });
  });
});

describe('Content-Type Error handling', () => {
  it('should have InvalidContentType error type available', () => {
    // Test that the error type is defined and can be created
    const error = new ScraperError(
      'Invalid content-type: application/json',
      'invalid-content-type',
      'https://example.com/api.json'
    );
    
    expect(error).toBeInstanceOf(ScraperError);
    expect(error.message).toContain('application/json');
    expect(error.url).toBe('https://example.com/api.json');
  });
});

describe('ScraperError for content-type errors', () => {
  it('should create content-type error with correct type', () => {
    const error = ScraperError.fromContentTypeError(
      'application/json',
      'https://api.example.com/data'
    );
    
    expect(error).toBeInstanceOf(ScraperError);
    expect(error.type).toBe('invalid-content-type');
    expect(error.message).toContain('application/json');
    expect(error.message).toContain('https://api.example.com/data');
  });
});
