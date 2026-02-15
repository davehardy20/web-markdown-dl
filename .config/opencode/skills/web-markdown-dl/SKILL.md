---
name: web-markdown-dl
description: Convert web pages to clean Markdown format. Use when you need to download web content, scrape articles, or convert URLs to markdown. Supports single URLs, batch processing from files, and website crawling with depth control. Triggers on 'convert url to markdown', 'download webpage', 'scrape website', 'batch convert urls', 'crawl website for content'.
---

# Web Markdown DL

Convert web pages to clean, structured Markdown format.

## Prerequisites

- The CLI binary must be built at `./bin/web-markdown-dl` (relative to project root)
- Run `bun run build` first if not already built

## Capabilities

### 1. Convert Single URL

Convert a single web page to Markdown:

```bash
./bin/web-markdown-dl --url "https://example.com/article"
```

Options:
- `--output <file>` - Save to file instead of stdout
- `--format <markdown|json>` - Output format (default: markdown)
- `--timeout <ms>` - Request timeout (default: 30000)
- `--filter` - Enable content filtering (remove ads/nav/sidebars)
- `--user-agent <ua>` - Custom user agent string

### 2. Batch Processing

Process multiple URLs from a file:

```bash
./bin/web-markdown-dl --input-file urls.txt --output-dir ./output
```

Input file format (one URL per line):
```
https://example.com/page1
https://example.com/page2
https://example.com/page3
```

Options:
- `--delay <ms>` - Delay between requests (default: 1000)
- All single URL options apply

### 3. Website Crawling

Crawl a website recursively:

```bash
./bin/web-markdown-dl --url "https://example.com" --crawl --output-dir ./crawled
```

Options:
- `--max-depth <n>` - Maximum crawl depth (default: 2)
- `--limit <n>` - Maximum URLs to crawl (default: 100)
- `--ignore-robots` - Ignore robots.txt restrictions
- `--allow-external` - Allow crawling external domains

## Wrapper Script

Use `scripts/run.sh` for consistent CLI access:

```bash
# Convert URL to markdown
./scripts/run.sh convert --url "https://example.com"

# Batch process
./scripts/run.sh batch --input-file urls.txt --output-dir ./output

# Crawl website
./scripts/run.sh crawl --url "https://example.com" --output-dir ./crawled --max-depth 3
```

## Output Format

### Markdown Output

Returns clean GitHub Flavored Markdown:
- Proper heading hierarchy
- Code blocks with syntax highlighting
- Tables, lists, and links preserved
- Images with alt text

### JSON Output

With `--format json`, returns structured data:

```json
{
  "markdown": "# Title\n\nContent...",
  "metadata": {
    "title": "Page Title",
    "url": "https://example.com",
    "author": "Author Name",
    "publishedDate": "2024-01-15",
    "wordCount": 1500
  }
}
```

## Common Use Cases

### Extract Article Content

```bash
./bin/web-markdown-dl --url "https://blog.example.com/post" --filter
```

### Batch Download Documentation

```bash
# Create urls.txt with doc URLs
./bin/web-markdown-dl --input-file urls.txt --output-dir ./docs --delay 500
```

### Crawl API Reference

```bash
./bin/web-markdown-dl --url "https://api.example.com/docs" --crawl --output-dir ./api-docs --max-depth 3
```

### Get Structured Data

```bash
./bin/web-markdown-dl --url "https://example.com" --format json --output page.json
```

## Error Handling

The CLI returns appropriate exit codes:
- `0` - Success
- `1` - Error (invalid URL, network failure, etc.)

Errors are written to stderr, content to stdout.

## Notes

- Uses headless browser (Playwright) for JavaScript-rendered pages
- Respects robots.txt by default (use `--ignore-robots` to override)
- Stays within original domain by default (use `--allow-external` to crawl external links)
