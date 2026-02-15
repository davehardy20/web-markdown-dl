import { describe, test, expect } from 'bun:test';
import { Converter, ConverterError, DEFAULT_CONVERTER_OPTIONS } from '../converter';

describe('Converter', () => {
  describe('constructor', () => {
    test('creates instance with default options', () => {
      const converter = new Converter();
      expect(converter).toBeInstanceOf(Converter);
    });

    test('accepts custom options', () => {
      const converter = new Converter({ includeImages: false });
      expect(converter).toBeInstanceOf(Converter);
    });
  });

  describe('convert', () => {
    test('converts h1 heading to ATX style', () => {
      const converter = new Converter();
      const html = '<h1>Title</h1>';
      const result = converter.convert(html);
      expect(result).toBe('# Title');
    });

    test('converts h2-h6 headings', () => {
      const converter = new Converter();
      expect(converter.convert('<h2>Level 2</h2>')).toBe('## Level 2');
      expect(converter.convert('<h3>Level 3</h3>')).toBe('### Level 3');
      expect(converter.convert('<h4>Level 4</h4>')).toBe('#### Level 4');
      expect(converter.convert('<h5>Level 5</h5>')).toBe('##### Level 5');
      expect(converter.convert('<h6>Level 6</h6>')).toBe('###### Level 6');
    });

    test('converts bold text with ** delimiter', () => {
      const converter = new Converter();
      const html = '<p>This is <strong>bold</strong> text</p>';
      const result = converter.convert(html);
      expect(result).toContain('**bold**');
    });

    test('converts italic text with * delimiter', () => {
      const converter = new Converter();
      const html = '<p>This is <em>italic</em> text</p>';
      const result = converter.convert(html);
      expect(result).toContain('*italic*');
    });

    test('converts code blocks with triple backticks', () => {
      const converter = new Converter();
      const html = '<pre><code>const x = 1;\nconst y = 2;</code></pre>';
      const result = converter.convert(html);
      expect(result).toContain('```');
      expect(result).toContain('const x = 1');
    });

    test('converts inline code with backticks', () => {
      const converter = new Converter();
      const html = '<p>Use the <code>console.log</code> function</p>';
      const result = converter.convert(html);
      expect(result).toContain('`console.log`');
    });

    test('preserves links in markdown format', () => {
      const converter = new Converter();
      const html = '<a href="https://example.com">Example Site</a>';
      const result = converter.convert(html);
      expect(result).toBe('[Example Site](https://example.com)');
    });

    test('converts unordered lists with - marker', () => {
      const converter = new Converter();
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('-');
      expect(result).toContain('Item 1');
      expect(result).toContain('Item 2');
    });

    test('converts ordered lists', () => {
      const converter = new Converter();
      const html = '<ol><li>First</li><li>Second</li></ol>';
      const result = converter.convert(html);
      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('First');
      expect(result).toContain('Second');
    });

    test('handles empty HTML', () => {
      const converter = new Converter();
      expect(converter.convert('')).toBe('');
      expect(converter.convert('   ')).toBe('');
    });

    test('handles null/undefined gracefully', () => {
      const converter = new Converter();
      expect(converter.convert(null as unknown as string)).toBe('');
      expect(converter.convert(undefined as unknown as string)).toBe('');
    });

    test('removes script tags', () => {
      const converter = new Converter();
      const html = '<p>Text</p><script>alert("xss")</script>';
      const result = converter.convert(html);
      expect(result).not.toContain('alert');
      expect(result).not.toContain('script');
    });

    test('removes style tags', () => {
      const converter = new Converter();
      const html = '<p>Text</p><style>.foo { color: red; }</style>';
      const result = converter.convert(html);
      expect(result).not.toContain('color: red');
      expect(result).not.toContain('style');
    });
  });

  describe('GFM support', () => {
    test('converts tables', () => {
      const converter = new Converter();
      const html = `
        <table>
          <thead>
            <tr><th>Name</th><th>Age</th></tr>
          </thead>
          <tbody>
            <tr><td>Alice</td><td>30</td></tr>
            <tr><td>Bob</td><td>25</td></tr>
          </tbody>
        </table>
      `;
      const result = converter.convert(html);
      expect(result).toContain('| Name | Age |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| Alice | 30 |');
    });

    test('converts strikethrough', () => {
      const converter = new Converter();
      const html = '<p>Some <del>deleted</del> text</p>';
      const result = converter.convert(html);
      expect(result).toContain('~deleted~');
    });

    test('converts task lists', () => {
      const converter = new Converter();
      const html = '<ul><li><input type="checkbox" checked>Done</li><li><input type="checkbox">Todo</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('[x]');
      expect(result).toContain('[ ]');
    });
  });

  describe('custom rules', () => {
    test('converts horizontal rules', () => {
      const converter = new Converter();
      const html = '<p>Before</p><hr><p>After</p>';
      const result = converter.convert(html);
      expect(result).toContain('---');
    });

    test('converts line breaks', () => {
      const converter = new Converter();
      const html = '<p>Line 1<br>Line 2</p>';
      const result = converter.convert(html);
      expect(result).toContain('Line 1  \nLine 2');
    });

    test('converts keyboard input', () => {
      const converter = new Converter();
      const html = '<p>Press <kbd>Ctrl+C</kbd> to copy</p>';
      const result = converter.convert(html);
      expect(result).toContain('`Ctrl+C`');
    });

    test('converts abbreviations with title', () => {
      const converter = new Converter();
      const html = '<p><abbr title="HyperText Markup Language">HTML</abbr> is cool</p>';
      const result = converter.convert(html);
      expect(result).toContain('HTML (HyperText Markup Language)');
    });

    test('removes SVG elements', () => {
      const converter = new Converter();
      const html = '<p>Text</p><svg><circle cx="50" cy="50" r="40"/></svg>';
      const result = converter.convert(html);
      expect(result).not.toContain('svg');
      expect(result).not.toContain('circle');
    });

    test('removes iframe elements', () => {
      const converter = new Converter();
      const html = '<p>Text</p><iframe src="https://example.com"></iframe>';
      const result = converter.convert(html);
      expect(result).not.toContain('iframe');
    });

    test('handles inline code with backticks', () => {
      const converter = new Converter();
      const html = '<code>use `backticks` inside</code>';
      const result = converter.convert(html);
      expect(result).toContain('``');
    });

    test('converts mark/highlight elements', () => {
      const converter = new Converter();
      const html = '<p>This is <mark>highlighted</mark> text</p>';
      const result = converter.convert(html);
      expect(result).toContain('==highlighted==');
    });
  });

  describe('image handling', () => {
    test('includes images by default', () => {
      const converter = new Converter();
      const html = '<img src="image.png" alt="Alt text">';
      const result = converter.convert(html);
      expect(result).toContain('![Alt text](image.png)');
    });

    test('excludes images when includeImages is false', () => {
      const converter = new Converter({ includeImages: false });
      const html = '<p>Text</p><img src="image.png" alt="Alt text"><p>More text</p>';
      const result = converter.convert(html);
      expect(result).not.toContain('image.png');
      expect(result).not.toContain('![');
    });
  });

  describe('complex HTML', () => {
    test('handles nested elements', () => {
      const converter = new Converter();
      const html = '<div><p>Paragraph with <strong>bold <em>and italic</em></strong> text</p></div>';
      const result = converter.convert(html);
      expect(result).toContain('**bold *and italic***');
    });

    test('handles malformed HTML gracefully', () => {
      const converter = new Converter();
      const html = '<p>Unclosed paragraph<div>nested</p></div>';
      expect(() => converter.convert(html)).not.toThrow();
    });

    test('cleans up excessive newlines', () => {
      const converter = new Converter();
      const html = '<p>Para 1</p><p>Para 2</p><p>Para 3</p>';
      const result = converter.convert(html);
      expect(result).not.toMatch(/\n{3,}/);
    });

    test('removes leading and trailing whitespace', () => {
      const converter = new Converter();
      const html = '   <p>Content</p>   ';
      const result = converter.convert(html);
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });

  describe('addRule', () => {
    test('allows adding custom rules', () => {
      const converter = new Converter();
      converter.addRule('customRule', {
        filter: 'custom',
        replacement: () => 'CUSTOM',
      });
      const html = '<custom>test</custom>';
      const result = converter.convert(html);
      expect(result).toContain('CUSTOM');
    });
  });

  describe('getTurndownService', () => {
    test('returns the Turndown service instance', () => {
      const converter = new Converter();
      const service = converter.getTurndownService();
      expect(service).toBeDefined();
      expect(typeof service.turndown).toBe('function');
    });
  });

  describe('ConverterError', () => {
    test('creates error with message', () => {
      const error = new ConverterError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ConverterError');
    });

    test('creates error with cause', () => {
      const cause = new Error('Original error');
      const error = new ConverterError('Wrapped error', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('DEFAULT_CONVERTER_OPTIONS', () => {
    test('has expected defaults', () => {
      expect(DEFAULT_CONVERTER_OPTIONS.includeImages).toBe(true);
      expect(DEFAULT_CONVERTER_OPTIONS.absoluteUrls).toBe(false);
      expect(DEFAULT_CONVERTER_OPTIONS.baseUrl).toBe('');
    });
  });
});
