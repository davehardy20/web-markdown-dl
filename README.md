# Web Markdown DL

A CLI tool to download web pages and convert them to clean Markdown format.

## Features (Planned)

- Download web pages using headless browser (Playwright)
- Extract main content using Mozilla Readability
- Convert HTML to GitHub Flavored Markdown
- Support for tables, code blocks, and images
- CLI interface with multiple options

## Installation

```bash
bun install
```

## Usage

```bash
bun run src/index.ts
```

## Development

```bash
# Build
bun run build

# Run tests
bun test
```

## Dependencies

- **playwright** - Browser automation for JavaScript-rendered pages
- **turndown** - HTML to Markdown conversion
- **turndown-plugin-gfm** - GitHub Flavored Markdown support (tables, strikethrough)
- **@mozilla/readability** - Content extraction
- **commander** - CLI framework
- **jsdom** - DOM manipulation for Node.js

## License

MIT
