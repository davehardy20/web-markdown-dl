import { JSDOM } from 'jsdom';
import type { Metadata, Heading, Link } from './types.js';

export class MetadataExtractor {
  extract(html: string, url: string, markdown: string = ''): Metadata {
    const dom = new JSDOM(html);
    try {
      const doc = dom.window.document;

      const title = this.extractTitle(doc);
      const description = this.extractDescription(doc);
      const author = this.extractAuthor(doc);
      const publishedDate = this.extractPublishedDate(doc);
      const headings = this.extractHeadings(doc);
      const links = this.extractLinks(doc);
      const wordCount = this.countWords(markdown || doc.body?.textContent || '');
      const contentType = this.extractContentType(doc);

      return {
        url,
        title,
        description,
        author,
        publishedDate,
        timestamp: new Date().toISOString(),
        headings,
        links,
        wordCount,
        contentType,
      };
    } finally {
      dom.window.close();
    }
  }

  private extractTitle(doc: Document): string {
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle?.getAttribute('content')) {
      return ogTitle.getAttribute('content')!;
    }

    const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
    if (twitterTitle?.getAttribute('content')) {
      return twitterTitle.getAttribute('content')!;
    }

    const h1 = doc.querySelector('h1');
    if (h1?.textContent?.trim()) {
      return h1.textContent.trim();
    }

    const titleTag = doc.querySelector('title');
    if (titleTag?.textContent?.trim()) {
      return titleTag.textContent.trim();
    }

    return '';
  }

  private extractDescription(doc: Document): string | undefined {
    const ogDesc = doc.querySelector('meta[property="og:description"]');
    if (ogDesc?.getAttribute('content')) {
      return ogDesc.getAttribute('content')!;
    }

    const twitterDesc = doc.querySelector('meta[name="twitter:description"]');
    if (twitterDesc?.getAttribute('content')) {
      return twitterDesc.getAttribute('content')!;
    }

    const metaDesc = doc.querySelector('meta[name="description"]');
    if (metaDesc?.getAttribute('content')) {
      return metaDesc.getAttribute('content')!;
    }

    const firstParagraph = doc.querySelector('p');
    if (firstParagraph?.textContent?.trim()) {
      const text = firstParagraph.textContent.trim();
      return text.length > 200 ? text.slice(0, 197) + '...' : text;
    }

    return undefined;
  }

  private extractAuthor(doc: Document): string | undefined {
    const authorMeta = doc.querySelector('meta[name="author"]');
    if (authorMeta?.getAttribute('content')) {
      return authorMeta.getAttribute('content')!;
    }

    const ogAuthor = doc.querySelector('meta[property="article:author"]');
    if (ogAuthor?.getAttribute('content')) {
      return ogAuthor.getAttribute('content')!;
    }

    const bylineClass = doc.querySelector('[class*="byline"], [class*="author"]');
    if (bylineClass?.textContent?.trim()) {
      return bylineClass.textContent.trim();
    }

    return undefined;
  }

  private extractPublishedDate(doc: Document): string | undefined {
    const articlePublished = doc.querySelector('meta[property="article:published_time"]');
    if (articlePublished?.getAttribute('content')) {
      return articlePublished.getAttribute('content')!;
    }

    const dateMeta = doc.querySelector('meta[name="date"]');
    if (dateMeta?.getAttribute('content')) {
      return dateMeta.getAttribute('content')!;
    }

    const timeElement = doc.querySelector('time[datetime]');
    if (timeElement?.getAttribute('datetime')) {
      return timeElement.getAttribute('datetime')!;
    }

    const publishTime = doc.querySelector('meta[property="article:published"]');
    if (publishTime?.getAttribute('content')) {
      return publishTime.getAttribute('content')!;
    }

    return undefined;
  }

  private extractHeadings(doc: Document): Heading[] {
    const headings: Heading[] = [];
    const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headingElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text) {
        const level = parseInt(el.tagName.charAt(1), 10);
        headings.push({ level, text });
      }
    });

    return headings;
  }

  private extractLinks(doc: Document): Link[] {
    const links: Link[] = [];
    const linkElements = doc.querySelectorAll('a[href]');

    linkElements.forEach((el) => {
      const href = el.getAttribute('href');
      const text = el.textContent?.trim();
      if (href && text) {
        links.push({ text, href });
      }
    });

    return links;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private extractContentType(doc: Document): string {
    const contentTypeMeta = doc.querySelector('meta[http-equiv="Content-Type"]');
    if (contentTypeMeta?.getAttribute('content')) {
      return contentTypeMeta.getAttribute('content')!;
    }
    return 'text/html';
  }
}
