import { describe, it, expect, mock } from 'bun:test';

describe('LRU Cache', () => {
  it('should implement simple LRU with Map delete and set pattern', () => {
    const cache = new Map<string, number>();
    const maxSize = 3;

    const setLru = (key: string, value: number) => {
      if (cache.size >= maxSize) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, value);
    };

    const getLru = (key: string): number | undefined => {
      if (cache.has(key)) {
        const value = cache.get(key)!;
        cache.delete(key);
        cache.set(key, value);
        return value;
      }
      return undefined;
    };

    setLru('a', 1);
    setLru('b', 2);
    setLru('c', 3);
    expect(cache.size).toBe(3);
    expect(Array.from(cache.keys())).toEqual(['a', 'b', 'c']);

    setLru('d', 4);
    expect(cache.size).toBe(3);
    expect(Array.from(cache.keys())).toEqual(['b', 'c', 'd']);
    expect(cache.has('a')).toBe(false);

    getLru('b');
    expect(Array.from(cache.keys())).toEqual(['c', 'd', 'b']);

    setLru('e', 5);
    expect(cache.size).toBe(3);
    expect(Array.from(cache.keys())).toEqual(['d', 'b', 'e']);
    expect(cache.has('c')).toBe(false);
  });

  it('should evict correct entry when LRU access pattern is used', () => {
    const cache = new Map<string, number>();
    const maxSize = 100;

    const setLru = (key: string, value: number) => {
      if (cache.size >= maxSize) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
      cache.set(key, value);
    };

    const getLru = (key: string): number | undefined => {
      if (cache.has(key)) {
        const value = cache.get(key)!;
        cache.delete(key);
        cache.set(key, value);
        return value;
      }
      return undefined;
    };

    for (let i = 0; i < 100; i++) {
      setLru(`domain${i}.com`, i);
    }
    expect(cache.size).toBe(100);

    getLru('domain0.com');
    expect(Array.from(cache.keys()).indexOf('domain0.com')).toBe(99);

    setLru('domain100.com', 100);
    expect(cache.size).toBe(100);
    expect(cache.has('domain1.com')).toBe(false);
    expect(cache.has('domain0.com')).toBe(true);
    expect(cache.get('domain0.com')).toBe(0);
    expect(cache.get('domain100.com')).toBe(100);
  });
});
