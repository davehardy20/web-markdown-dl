/**
 * Centralized URL utility functions
 * Shared between crawler.ts and batch.ts
 */

/**
 * Normalize a URL for deduplication
 * - Removes fragment
 * - Sorts query parameters
 * - Removes trailing slash (except for root)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    parsed.hash = '';
    
    const params = parsed.searchParams;
    const sortedParams = new URLSearchParams();
    const uniqueKeys = [...new Set(Array.from(params.keys()))].sort();
    for (const key of uniqueKeys) {
      const values = params.getAll(key);
      for (const value of values) {
        sortedParams.append(key, value);
      }
    }
    parsed.search = sortedParams.toString();
    
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Extract the domain from a URL (hostname without port)
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Group URLs by their domain
 */
export function groupUrlsByDomain(urls: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;
    
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain)!.push(url);
  }
  return groups;
}
