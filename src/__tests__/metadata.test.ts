import { describe, test, expect } from 'bun:test';
import { MetadataExtractor } from '../metadata';
import type { Metadata } from '../types';

describe('MetadataExtractor', () => {
  const extractor = new MetadataExtractor();

  describe('extract', () => {
    test('extracts basic metadata from HTML', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <meta name="description" content="Test description">
          <meta name="author" content="John Doe">
        </head>
        <body>
          <p>This is some content.</p>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.description).toBe('Test description');
      expect(result.author).toBe('John Doe');
      expect(result.timestamp).toBeDefined();
      expect(result.contentType).toBe('text/html');
    });

    test('extracts URL correctly', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com/page');
      expect(result.url).toBe('https://example.com/page');
    });

    test('generates ISO 8601 timestamp', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('extracts word count from markdown', () => {
      const html = '<html><body><p>Test content here.</p></body></html>';
      const markdown = 'This is a test with exactly eight words.';
      const result = extractor.extract(html, 'https://example.com', markdown);
      expect(result.wordCount).toBe(8);
    });

    test('extracts word count from HTML when no markdown provided', () => {
      const html = '<html><body><p>One two three four five</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.wordCount).toBe(5);
    });

    test('returns zero word count for empty content', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com', '');
      expect(result.wordCount).toBe(0);
    });
  });

  describe('title extraction', () => {
    test('extracts title from og:title meta tag', () => {
      const html = `
        <html>
        <head>
          <title>Regular Title</title>
          <meta property="og:title" content="OpenGraph Title">
        </head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.title).toBe('OpenGraph Title');
    });

    test('extracts title from twitter:title meta tag', () => {
      const html = `
        <html>
        <head>
          <title>Regular Title</title>
          <meta name="twitter:title" content="Twitter Title">
        </head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.title).toBe('Twitter Title');
    });

    test('extracts title from h1 tag', () => {
      const html = `
        <html>
        <head><title>Page Title</title></head>
        <body><h1>Heading Title</h1></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.title).toBe('Heading Title');
    });

    test('extracts title from title tag as fallback', () => {
      const html = `
        <html>
        <head><title>Fallback Title</title></head>
        <body><p>Content</p></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.title).toBe('Fallback Title');
    });

    test('returns empty string when no title found', () => {
      const html = '<html><body><p>Content</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.title).toBe('');
    });
  });

  describe('description extraction', () => {
    test('extracts description from og:description', () => {
      const html = `
        <html>
        <head>
          <meta property="og:description" content="OG Description">
          <meta name="description" content="Meta Description">
        </head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description).toBe('OG Description');
    });

    test('extracts description from twitter:description', () => {
      const html = `
        <html>
        <head>
          <meta name="twitter:description" content="Twitter Description">
          <meta name="description" content="Meta Description">
        </head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description).toBe('Twitter Description');
    });

    test('extracts description from meta description tag', () => {
      const html = `
        <html>
        <head><meta name="description" content="Meta Description"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description).toBe('Meta Description');
    });

    test('extracts description from first paragraph as fallback', () => {
      const html = `
        <html>
        <body>
          <p>This is the first paragraph that will be used as description when no meta description is available.</p>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description).toContain('first paragraph');
    });

    test('truncates long first paragraph descriptions to 200 chars', () => {
      const longText = 'A'.repeat(300);
      const html = `
        <html>
        <body><p>${longText}</p></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description!.length).toBeLessThanOrEqual(200);
      expect(result.description).toMatch(/\.\.\.$/);
    });

    test('returns undefined when no description found', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.description).toBeUndefined();
    });
  });

  describe('author extraction', () => {
    test('extracts author from meta author tag', () => {
      const html = `
        <html>
        <head><meta name="author" content="Jane Smith"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.author).toBe('Jane Smith');
    });

    test('extracts author from article:author meta tag', () => {
      const html = `
        <html>
        <head><meta property="article:author" content="Article Author"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.author).toBe('Article Author');
    });

    test('extracts author from byline class', () => {
      const html = `
        <html>
        <body>
          <p class="byline">Written by Byline Author</p>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.author).toBe('Written by Byline Author');
    });

    test('returns undefined when no author found', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.author).toBeUndefined();
    });
  });

  describe('published date extraction', () => {
    test('extracts date from article:published_time', () => {
      const html = `
        <html>
        <head><meta property="article:published_time" content="2024-01-15T10:30:00Z"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.publishedDate).toBe('2024-01-15T10:30:00Z');
    });

    test('extracts date from meta date tag', () => {
      const html = `
        <html>
        <head><meta name="date" content="2024-02-20"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.publishedDate).toBe('2024-02-20');
    });

    test('extracts date from time element with datetime', () => {
      const html = `
        <html>
        <body>
          <time datetime="2024-03-25">March 25, 2024</time>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.publishedDate).toBe('2024-03-25');
    });

    test('extracts date from article:published meta tag', () => {
      const html = `
        <html>
        <head><meta property="article:published" content="2024-04-01"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.publishedDate).toBe('2024-04-01');
    });

    test('returns undefined when no date found', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.publishedDate).toBeUndefined();
    });
  });

  describe('headings extraction', () => {
    test('extracts all headings h1-h6', () => {
      const html = `
        <html>
        <body>
          <h1>Heading 1</h1>
          <h2>Heading 2</h2>
          <h3>Heading 3</h3>
          <h4>Heading 4</h4>
          <h5>Heading 5</h5>
          <h6>Heading 6</h6>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.headings).toHaveLength(6);
      expect(result.headings[0]).toEqual({ level: 1, text: 'Heading 1' });
      expect(result.headings[1]).toEqual({ level: 2, text: 'Heading 2' });
      expect(result.headings[5]).toEqual({ level: 6, text: 'Heading 6' });
    });

    test('extracts heading level correctly', () => {
      const html = '<html><body><h3>Test Heading</h3></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.headings[0].level).toBe(3);
    });

    test('extracts heading text with trimmed whitespace', () => {
      const html = '<html><body><h1>  Trimmed Heading  </h1></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.headings[0].text).toBe('Trimmed Heading');
    });

    test('skips empty headings', () => {
      const html = `
        <html>
        <body>
          <h1>Valid Heading</h1>
          <h2>   </h2>
          <h3></h3>
          <h4>Another Valid</h4>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.headings).toHaveLength(2);
      expect(result.headings[0].text).toBe('Valid Heading');
      expect(result.headings[1].text).toBe('Another Valid');
    });

    test('returns empty array when no headings', () => {
      const html = '<html><body><p>Just a paragraph</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.headings).toEqual([]);
    });
  });

  describe('links extraction', () => {
    test('extracts links with text and href', () => {
      const html = `
        <html>
        <body>
          <a href="https://example.com">Example Link</a>
          <a href="/relative">Relative Link</a>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.links).toHaveLength(2);
      expect(result.links[0]).toEqual({ text: 'Example Link', href: 'https://example.com' });
      expect(result.links[1]).toEqual({ text: 'Relative Link', href: '/relative' });
    });

    test('skips links without href', () => {
      const html = `
        <html>
        <body>
          <a>Link without href</a>
          <a href="https://example.com">Valid Link</a>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.links).toHaveLength(1);
    });

    test('skips links without text', () => {
      const html = `
        <html>
        <body>
          <a href="https://example.com"></a>
          <a href="https://example.com">Valid Link</a>
        </body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.links).toHaveLength(1);
    });

    test('returns empty array when no links', () => {
      const html = '<html><body><p>Just text</p></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      
      expect(result.links).toEqual([]);
    });
  });

  describe('content type extraction', () => {
    test('extracts content type from meta tag', () => {
      const html = `
        <html>
        <head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head>
        <body></body>
        </html>
      `;
      const result = extractor.extract(html, 'https://example.com');
      expect(result.contentType).toBe('text/html; charset=utf-8');
    });

    test('returns default text/html when no content type', () => {
      const html = '<html><body></body></html>';
      const result = extractor.extract(html, 'https://example.com');
      expect(result.contentType).toBe('text/html');
    });
  });

  describe('complex HTML handling', () => {
    test('handles real-world HTML structure', () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta property="og:title" content="Real Article Title">
          <meta property="og:description" content="A real article about testing">
          <meta name="author" content="Test Author">
          <meta property="article:published_time" content="2024-05-01">
          <title>Fallback Title</title>
        </head>
        <body>
          <header>
            <nav><a href="/">Home</a></nav>
          </header>
          <main>
            <article>
              <h1>Article Heading</h1>
              <p class="byline">Written by <span class="author">Inline Author</span></p>
              <h2>Section 1</h2>
              <p>Content paragraph with a <a href="/link">link inside</a>.</p>
              <h2>Section 2</h2>
              <p>Another paragraph.</p>
            </article>
          </main>
          <footer><a href="/about">About</a></footer>
        </body>
        </html>
      `;
      
      const result = extractor.extract(html, 'https://example.com/article');
      
      expect(result.url).toBe('https://example.com/article');
      expect(result.title).toBe('Real Article Title');
      expect(result.description).toBe('A real article about testing');
      expect(result.author).toBe('Test Author');
      expect(result.publishedDate).toBe('2024-05-01');
      expect(result.headings).toHaveLength(3);
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.wordCount).toBeGreaterThan(0);
    });

    test('handles malformed HTML gracefully', () => {
      const html = '<html><head><title>Test</title><body><h1>Heading<p>Unclosed';
      expect(() => extractor.extract(html, 'https://example.com')).not.toThrow();
    });

    test('handles empty HTML', () => {
      const html = '';
      expect(() => extractor.extract(html, 'https://example.com')).not.toThrow();
    });
  });
});
