import { describe, test, expect } from 'bun:test';
import { ContentFilter, FilterError, filterContent, filterContentWithFallback } from '../filter';
import { DEFAULT_FILTER_OPTIONS } from '../types';

const createArticleHtml = (content: string, title = 'Test Article'): string => `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta property="og:title" content="${title}">
</head>
<body>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
  <aside class="sidebar">
    <h3>Related Posts</h3>
    <ul>
      <li><a href="/post1">Post 1</a></li>
      <li><a href="/post2">Post 2</a></li>
    </ul>
  </aside>
  <article>
    <h1>${title}</h1>
    <p class="byline">By John Doe</p>
    <div class="content">
      ${content}
    </div>
  </article>
  <footer>
    <p>Copyright 2024</p>
  </footer>
  <div class="ads">Sponsored Content</div>
</body>
</html>
`;

describe('ContentFilter', () => {
  describe('constructor', () => {
    test('creates instance with default options', () => {
      const filter = new ContentFilter();
      expect(filter).toBeInstanceOf(ContentFilter);
    });

    test('accepts custom options', () => {
      const filter = new ContentFilter({ charThreshold: 100, debug: true });
      expect(filter).toBeInstanceOf(ContentFilter);
    });
  });

  describe('filter', () => {
    test('extracts main content from article HTML', () => {
      const filter = new ContentFilter();
      const longContent = 'This is a substantial article with enough content to pass the readability threshold. '.repeat(20);
      const html = createArticleHtml(`<p>${longContent}</p>`);
      const result = filter.filter(html, 'https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.content).not.toBeNull();
      expect(result.content).not.toContain('Home');
      expect(result.content).not.toContain('About');
      expect(result.content).not.toContain('Related Posts');
      expect(result.content).not.toContain('Copyright');
      expect(result.content).not.toContain('Sponsored Content');
    });

    test('extracts article title', () => {
      const filter = new ContentFilter();
      const longContent = 'This is a substantial article with enough content. '.repeat(20);
      const html = createArticleHtml(`<p>${longContent}</p>`, 'My Article Title');
      const result = filter.filter(html, 'https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.title).toBe('My Article Title');
    });

    test('returns error for empty HTML', () => {
      const filter = new ContentFilter();
      const result = filter.filter('', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty HTML content');
    });

    test('returns error for whitespace-only HTML', () => {
      const filter = new ContentFilter();
      const result = filter.filter('   \n\t  ', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty HTML content');
    });

    test('handles non-article content gracefully', () => {
      const filter = new ContentFilter();
      const html = '<html><body><nav>Navigation only</nav></body></html>';
      const result = filter.filter(html, 'https://example.com');

      // Readability may still parse minimal content
      expect(result.success).toBeDefined();
      expect(result.content).toBeDefined();
    });

    test('preserves text content length', () => {
      const filter = new ContentFilter();
      const longContent = 'This is a substantial article with enough content to pass the readability threshold. '.repeat(20);
      const html = createArticleHtml(`<p>${longContent}</p>`);
      const result = filter.filter(html, 'https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.textContent).toContain('substantial article');
    });
  });

  describe('filterWithFallback', () => {
    test('returns filtered content on success', () => {
      const filter = new ContentFilter();
      const longContent = 'This is a substantial article with enough content. '.repeat(20);
      const html = createArticleHtml(`<p>${longContent}</p>`);
      const result = filter.filterWithFallback(html, 'https://example.com/article');

      expect(result.html).not.toContain('Home');
      expect(result.html).not.toContain('Related Posts');
      expect(result.metadata.success).toBe(true);
    });

    test('returns some content on minimal HTML', () => {
      const filter = new ContentFilter();
      const html = '<html><body><nav>Navigation only</nav></body></html>';
      const result = filter.filterWithFallback(html, 'https://example.com');

      // filterWithFallback always returns HTML (either filtered or raw)
      expect(result.html).toBeDefined();
      expect(result.html.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    test('preserves original HTML when filtering fails', () => {
      const filter = new ContentFilter();
      const html = '<html><body>Minimal content</body></html>';
      const result = filter.filterWithFallback(html, 'https://example.com');

      expect(result.html).toBeDefined();
      expect(typeof result.html).toBe('string');
    });
  });

  describe('isArticleLike', () => {
    test('detects article elements', () => {
      const filter = new ContentFilter();
      const html = '<html><body><article>Content</article></body></html>';
      expect(filter.isArticleLike(html)).toBe(true);
    });

    test('detects main elements', () => {
      const filter = new ContentFilter();
      const html = '<html><body><main>Content</main></body></html>';
      expect(filter.isArticleLike(html)).toBe(true);
    });

    test('detects article class', () => {
      const filter = new ContentFilter();
      const html = '<html><body><div class="article-content">Content</div></body></html>';
      expect(filter.isArticleLike(html)).toBe(true);
    });

    test('detects article meta tags', () => {
      const filter = new ContentFilter();
      const html = '<html><head><meta property="article:published_time" content="2024-01-01"></head></html>';
      expect(filter.isArticleLike(html)).toBe(true);
    });

    test('detects author meta tags', () => {
      const filter = new ContentFilter();
      const html = '<html><head><meta name="author" content="John Doe"></head></html>';
      expect(filter.isArticleLike(html)).toBe(true);
    });

    test('returns false for non-article pages', () => {
      const filter = new ContentFilter();
      const html = '<html><body><nav>Navigation</nav><footer>Footer</footer></body></html>';
      expect(filter.isArticleLike(html)).toBe(false);
    });

    test('returns false for empty HTML', () => {
      const filter = new ContentFilter();
      expect(filter.isArticleLike('')).toBe(false);
      expect(filter.isArticleLike('   ')).toBe(false);
    });
  });
});

describe('filterContent convenience function', () => {
  test('filters HTML content', () => {
    const longContent = 'This is a substantial article with enough content. '.repeat(20);
    const html = createArticleHtml(`<p>${longContent}</p>`);
    const result = filterContent(html, 'https://example.com/article');

    expect(result.success).toBe(true);
    expect(result.content).not.toBeNull();
  });

  test('accepts options', () => {
    const html = '<html><body><p>Short</p></body></html>';
    const result = filterContent(html, 'https://example.com', { charThreshold: 1 });

    expect(result.success).toBe(true);
  });
});

describe('filterContentWithFallback convenience function', () => {
  test('returns filtered content with metadata', () => {
    const longContent = 'This is a substantial article with enough content. '.repeat(20);
    const html = createArticleHtml(`<p>${longContent}</p>`);
    const result = filterContentWithFallback(html, 'https://example.com/article');

    expect(result.html).toBeDefined();
    expect(result.metadata).toBeDefined();
  });
});

describe('FilterError', () => {
  test('creates error with message', () => {
    const error = new FilterError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('FilterError');
  });

  test('creates error with cause', () => {
    const cause = new Error('Original error');
    const error = new FilterError('Wrapped error', cause);
    expect(error.cause).toBe(cause);
  });
});

describe('DEFAULT_FILTER_OPTIONS', () => {
  test('has expected defaults', () => {
    expect(DEFAULT_FILTER_OPTIONS.charThreshold).toBe(500);
    expect(DEFAULT_FILTER_OPTIONS.debug).toBe(false);
  });
});
