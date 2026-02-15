# Web Markdown DL

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A powerful CLI tool to download web pages and convert them into clean, readable Markdown format. It uses Playwright for browser automation, Mozilla Readability for content extraction, and Turndown for high-quality Markdown conversion.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Single URL Conversion](#single-url-conversion)
  - [Batch Processing](#batch-processing)
  - [Website Crawling](#website-crawling)
- [CLI Reference](#cli-reference)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)
- [License](#license)

## Features

- **Headless Browsing**: Uses Playwright to render JavaScript-heavy pages before conversion.
- **Smart Content Extraction**: Integrates Mozilla Readability to strip ads, navigation, and sidebars, keeping only the main content.
- **GFM Support**: Generates GitHub Flavored Markdown, preserving tables, code blocks, and formatting.
- **Batch Processing**: Convert multiple URLs from a text file in one command.
- **Website Crawling**: Recursively crawl and convert entire websites with configurable depth and limits.
- **Flexible Output**: Supports Markdown and JSON formats (including metadata like title, author, and excerpt).
- **Customizable**: Control timeouts, user agents, request delays, and crawl boundaries.

## Installation

### Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/davehardy20/web_markdown_dl.git
   cd web_markdown_dl
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Install Playwright browsers:
   ```bash
   bun x playwright install chromium
   ```

## Quick Start

Convert a single URL to Markdown and print it to the console:

```bash
bun run src/index.ts --url https://example.com
```

Convert and save to a file with content filtering enabled:

```bash
bun run src/index.ts --url https://example.com --output example.md --filter
```

## Usage

### Single URL Conversion

Download a page and convert it to clean Markdown.

```bash
# Basic usage
bun run src/index.ts --url https://news.ycombinator.com

# Save to file
bun run src/index.ts --url https://example.com/article -o article.md

# Save as JSON with metadata
bun run src/index.ts --url https://example.com/article -f json -o article.json
```

### Batch Processing

Convert a list of URLs from a file. Each URL should be on a new line.

```bash
bun run src/index.ts --input-file urls.txt --output-dir ./downloads --filter
```

### Website Crawling

Recursively crawl a website and convert found pages.

```bash
# Crawl up to depth 2 (default)
bun run src/index.ts --url https://docs.example.com --crawl --output-dir ./docs

# Limit number of pages and crawl external domains
bun run src/index.ts --url https://blog.example.com --crawl --limit 50 --allow-external --output-dir ./blog
```

## CLI Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--url <url>` | URL to convert | - |
| `-o, --output <file>` | Output file path (stdout if omitted) | - |
| `-f, --format <format>` | Output format: `markdown` or `json` | `markdown` |
| `-t, --timeout <ms>` | Request timeout in milliseconds | `30000` |
| `-u, --user-agent <ua>` | Custom User-Agent string | - |
| `-F, --filter` | Enable content filtering (removes ads/nav) | `false` |
| `-d, --delay <ms>` | Delay between requests in batch/crawl mode | `1000` |
| `--input-file <file>` | Path to file with list of URLs (Batch mode) | - |
| `--output-dir <dir>` | Directory for saved files (Batch/Crawl mode) | - |
| `--crawl` | Enable recursive crawling | `false` |
| `--max-depth <depth>` | Maximum crawl depth | `2` |
| `--limit <count>` | Maximum total pages to crawl | `100` |
| `--ignore-robots` | Skip robots.txt check | `false` |
| `--allow-external` | Allow crawling pages on different domains | `false` |

## Configuration

The tool primarily uses CLI flags for configuration. For persistent settings, you can alias the command in your shell:

```bash
alias webmd='bun run /path/to/web_markdown_dl/src/index.ts --filter --timeout 60000'
```

## Troubleshooting

### Playwright Error: "Executable doesn't exist"
If you see an error about missing browser executables, run:
```bash
bun x playwright install chromium
```

### Content is missing or "Access Denied"
Some sites block automated scrapers. Try:
1. Using a custom User-Agent: `--user-agent "Mozilla/5.0..."`
2. Increasing the timeout: `--timeout 60000`
3. Disabling filtering if it's too aggressive: remove `--filter`

### Crawl is stopped by robots.txt
If a site blocks crawlers but you have permission to scrape it, use the `--ignore-robots` flag.

## Examples

Check the [examples/](./examples) directory for sample outputs:
- [Single URL Markdown Output](./examples/single-url.md)
- [JSON with Metadata Output](./examples/metadata.json)

## License

MIT License. See [LICENSE](LICENSE) for details.
