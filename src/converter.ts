import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface ConverterOptions {
  includeImages?: boolean;
  absoluteUrls?: boolean;
  baseUrl?: string;
}

export const DEFAULT_CONVERTER_OPTIONS: Required<ConverterOptions> = {
  includeImages: true,
  absoluteUrls: false,
  baseUrl: '',
};

export class ConverterError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ConverterError';
    this.cause = cause;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConverterError);
    }
  }
}

/**
 * Converts HTML content to Markdown format optimized for LLM processing.
 * Supports GFM (tables, strikethrough, task lists), fenced code blocks, and ATX headings.
 */
export class Converter {
  private turndown: TurndownService;
  private options: Required<ConverterOptions>;

  constructor(options: ConverterOptions = {}) {
    this.options = {
      includeImages: options.includeImages ?? DEFAULT_CONVERTER_OPTIONS.includeImages,
      absoluteUrls: options.absoluteUrls ?? DEFAULT_CONVERTER_OPTIONS.absoluteUrls,
      baseUrl: options.baseUrl ?? DEFAULT_CONVERTER_OPTIONS.baseUrl,
    };

    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      preformattedCode: false,
    });

    this.turndown.use(gfm);
    this.addCustomRules();
  }

  private addCustomRules(): void {
    this.turndown.addRule('preWithoutCode', {
      filter: (node): node is HTMLElement => 
        node.nodeName === 'PRE' && node.firstChild?.nodeName !== 'CODE',
      replacement: (content: string) => {
        const trimmed = content.trim();
        return trimmed ? '\n```\n' + trimmed + '\n```\n' : '';
      },
    });

    this.turndown.addRule('inlineCode', {
      filter: 'code',
      replacement: (content: string, node: TurndownService.Node) => {
        if (node.parentNode?.nodeName === 'PRE') return content;
        const trimmed = content.trim();
        if (!trimmed) return '';
        return trimmed.includes('`') ? '`` ' + trimmed + ' ``' : '`' + trimmed + '`';
      },
    });

    this.turndown.addRule('lineBreak', {
      filter: 'br',
      replacement: () => '  \n',
    });

    this.turndown.addRule('horizontalRule', {
      filter: 'hr',
      replacement: () => '\n\n---\n\n',
    });

    this.turndown.addRule('definitionList', {
      filter: 'dl',
      replacement: (content: string) => '\n' + content + '\n',
    });

    this.turndown.addRule('definitionTerm', {
      filter: 'dt',
      replacement: (content: string) => '**' + content.trim() + '**: ',
    });

    this.turndown.addRule('definitionDescription', {
      filter: 'dd',
      replacement: (content: string) => content.trim() + '\n\n',
    });

    this.turndown.addRule('figure', {
      filter: 'figure',
      replacement: (content: string) => '\n\n' + content.trim() + '\n\n',
    });

    this.turndown.addRule('figcaption', {
      filter: 'figcaption',
      replacement: (content: string) => '\n*' + content.trim() + '*\n',
    });

    this.turndown.addRule('abbreviation', {
      filter: (node): node is HTMLElement => 
        node.nodeName === 'ABBR' && !!node.getAttribute('title'),
      replacement: (content: string, node: TurndownService.Node) => 
        content + ' (' + (node as HTMLElement).getAttribute('title') + ')',
    });

    if (!this.options.includeImages) {
      this.turndown.addRule('removeImages', {
        filter: 'img',
        replacement: () => '',
      });
    }

    this.turndown.addRule('anchorId', {
      filter: (node): node is HTMLElement => 
        node.nodeName === 'A' && !node.getAttribute('href') && !!node.getAttribute('id'),
      replacement: (content: string) => content,
    });

    this.turndown.addRule('mark', {
      filter: (node): node is HTMLElement => 
        node.nodeName === 'MARK' || node.nodeName === 'HIGHLIGHT',
      replacement: (content: string) => '==' + content.trim() + '==',
    });

    this.turndown.addRule('keyboard', {
      filter: 'kbd',
      replacement: (content: string) => '`' + content.trim() + '`',
    });

    this.turndown.addRule('sample', {
      filter: 'samp',
      replacement: (content: string) => '`' + content.trim() + '`',
    });

    this.turndown.addRule('variable', {
      filter: 'var',
      replacement: (content: string) => '*' + content.trim() + '*',
    });

    this.turndown.addRule('cite', {
      filter: 'cite',
      replacement: (content: string) => '*' + content.trim() + '*',
    });

    this.turndown.addRule('inserted', {
      filter: 'ins',
      replacement: (content: string) => '++' + content.trim() + '++',
    });

    this.turndown.addRule('removeScriptStyle', {
      filter: ['script', 'style', 'noscript', 'template'],
      replacement: () => '',
    });

    this.turndown.addRule('removeSvg', {
      filter: (node): node is HTMLElement => node.nodeName === 'SVG',
      replacement: () => '',
    });

    this.turndown.addRule('removeIframe', {
      filter: 'iframe',
      replacement: () => '',
    });
  }

  /**
   * Converts HTML content to Markdown.
   * @param html - The HTML content to convert
   * @returns The converted Markdown string
   * @throws ConverterError if conversion fails
   */
  convert(html: string): string {
    if (!html?.trim()) return '';

    try {
      const markdown = this.turndown.turndown(html);
      return markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+/, '')
        .replace(/\s+$/, '');
    } catch (error) {
      throw new ConverterError(
        `Failed to convert HTML to Markdown: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Adds a custom Turndown rule for handling specific HTML elements.
   */
  addRule(name: string, rule: TurndownService.Rule): void {
    this.turndown.addRule(name, rule);
  }

  /**
   * Gets the underlying Turndown service instance for advanced configuration.
   */
  getTurndownService(): TurndownService {
    return this.turndown;
  }
}
