#!/usr/bin/env bun
/**
 * Benchmark script to measure performance improvement from context pooling
 * 
 * This script compares scraping performance with and without context pooling
 * by measuring the time to scrape multiple URLs.
 */

import { Scraper } from '../src/scraper';

const BENCHMARK_URLS = [
  'https://example.com',
  'https://httpbin.org/html',
  'https://httpbin.org/links/10',
];

const CONCURRENT_REQUESTS = 5;
const ITERATIONS = 3;

interface BenchmarkResult {
  name: string;
  totalTime: number;
  avgTimePerRequest: number;
  requestsPerSecond: number;
}

async function runBenchmark(
  name: string,
  scrapeFn: () => Promise<void>,
  iterations: number
): Promise<BenchmarkResult> {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await scrapeFn();
    const end = performance.now();
    times.push(end - start);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / times.length;
  
  return {
    name,
    totalTime,
    avgTimePerRequest: avgTime / CONCURRENT_REQUESTS,
    requestsPerSecond: (CONCURRENT_REQUESTS * 1000) / avgTime,
  };
}

async function benchmarkWithPooling(): Promise<void> {
  const scraper = new Scraper({ timeout: 30000 });
  
  try {
    await scraper.scrape(BENCHMARK_URLS[0]);
    
    const urls = Array(CONCURRENT_REQUESTS).fill(null).map((_, i) => 
      BENCHMARK_URLS[i % BENCHMARK_URLS.length]
    );
    
    await Promise.all(urls.map(url => scraper.scrape(url)));
  } finally {
    await scraper.close();
  }
}

async function benchmarkWithoutPooling(): Promise<void> {
  const urls = Array(CONCURRENT_REQUESTS).fill(null).map((_, i) => 
    BENCHMARK_URLS[i % BENCHMARK_URLS.length]
  );
  
  await Promise.all(urls.map(async (url) => {
    const scraper = new Scraper({ timeout: 30000 });
    try {
      await scraper.scrape(url);
    } finally {
      await scraper.close();
    }
  }));
}

async function main(): Promise<void> {
  console.log('🚀 Starting Context Pooling Benchmark\n');
  console.log(`Configuration:`);
  console.log(`  - Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`  - Iterations: ${ITERATIONS}`);
  console.log(`  - URLs: ${BENCHMARK_URLS.join(', ')}\n`);
  
  console.log('Note: This benchmark requires network access and may take a few minutes.\n');
  
  try {
    console.log('📊 Benchmarking WITH context pooling...');
    const withPooling = await runBenchmark(
      'With Pooling',
      benchmarkWithPooling,
      ITERATIONS
    );
    
    console.log('📊 Benchmarking WITHOUT context pooling...');
    const withoutPooling = await runBenchmark(
      'Without Pooling',
      benchmarkWithoutPooling,
      ITERATIONS
    );
    
    const improvement = ((withoutPooling.totalTime - withPooling.totalTime) / withoutPooling.totalTime) * 100;
    const speedup = withoutPooling.totalTime / withPooling.totalTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('📈 BENCHMARK RESULTS');
    console.log('='.repeat(60));
    
    console.log('\nWITH Context Pooling:');
    console.log(`  Total Time: ${withPooling.totalTime.toFixed(2)}ms`);
    console.log(`  Avg Time/Request: ${withPooling.avgTimePerRequest.toFixed(2)}ms`);
    console.log(`  Requests/Second: ${withPooling.requestsPerSecond.toFixed(2)}`);
    
    console.log('\nWITHOUT Context Pooling:');
    console.log(`  Total Time: ${withoutPooling.totalTime.toFixed(2)}ms`);
    console.log(`  Avg Time/Request: ${withoutPooling.avgTimePerRequest.toFixed(2)}ms`);
    console.log(`  Requests/Second: ${withoutPooling.requestsPerSecond.toFixed(2)}`);
    
    console.log('\n' + '-'.repeat(60));
    console.log(`🎯 PERFORMANCE IMPROVEMENT:`);
    console.log(`   ${improvement.toFixed(1)}% faster`);
    console.log(`   ${speedup.toFixed(2)}x speedup`);
    console.log('-'.repeat(60));
    
    if (improvement >= 30) {
      console.log('\n✅ Target achieved: 30-40% performance improvement');
    } else if (improvement > 0) {
      console.log('\n⚠️  Improvement below target (30-40%). Network latency may dominate.');
    } else {
      console.log('\n⚠️  No improvement detected. Check network conditions.');
    }
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
