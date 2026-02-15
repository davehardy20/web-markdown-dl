declare module 'robots-parser' {
  interface Robots {
    isAllowed(url: string, userAgent?: string): boolean;
    isDisallowed(url: string, userAgent?: string): boolean;
    getMatchingLineNumber(url: string, userAgent?: string): number | null;
    getCrawlDelay(userAgent?: string): number | null;
    getSitemaps(): string[];
    getSitemapsOfType(type: string): string[];
    getPreferredHost(): string | null;
  }

  function robotsParser(url: string, robotsTxt: string): Robots;

  export = robotsParser;
}
