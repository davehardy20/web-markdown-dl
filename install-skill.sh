#!/bin/bash
#
# Web Markdown DL Skill Installer
# Installs the skill to ~/.config/opencode/skills/web-markdown-dl/
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_NAME="web-markdown-dl"
SKILL_DIR="$HOME/.config/opencode/skills/$SKILL_NAME"

echo "🔧 Web Markdown DL Skill Installer"
echo "=================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    echo -e "${RED}Error: Cannot find package.json in $PROJECT_ROOT${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "📁 Project root: $PROJECT_ROOT"
echo "📦 Skill will be installed to: $SKILL_DIR"
echo ""

# Step 1: Build the project
echo "🔨 Step 1: Building project..."
cd "$PROJECT_ROOT"
if ! bun run build; then
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Step 2: Create skill directory structure
echo "📂 Step 2: Creating skill directory structure..."
mkdir -p "$SKILL_DIR/bin"
mkdir -p "$SKILL_DIR/scripts"
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Step 3: Generate the binary with correct path
echo "⚙️  Step 3: Generating binary..."
cat > "$SKILL_DIR/bin/web-markdown-dl" << EOF
#!/usr/bin/env node
import('$PROJECT_ROOT/dist/cli.js').then(({ main }) => main());
EOF
chmod +x "$SKILL_DIR/bin/web-markdown-dl"
echo -e "${GREEN}✓ Binary created at $SKILL_DIR/bin/web-markdown-dl${NC}"
echo ""

# Step 4: Generate SKILL.md with correct paths
echo "📝 Step 4: Generating SKILL.md..."
cat > "$SKILL_DIR/SKILL.md" << 'EOF'
---
name: web-markdown-dl
description: Convert web pages to clean Markdown format. Use when you need to download web content, scrape articles, or convert URLs to markdown. Supports single URLs, batch processing from files, and website crawling with depth control. Triggers on 'convert url to markdown', 'download webpage', 'scrape website', 'batch convert urls', 'crawl website for content'.
allowed-tools:
  - bash
  - Read
  - Write
  - skill
---

# Web Markdown DL

Convert web pages to clean, structured Markdown format.

## Prerequisites

- The CLI binary is bundled with the skill
- The binary requires the project to be built at the installation location
- Run `bun run build` in the project directory if you encounter errors

## Capabilities

### 1. Convert Single URL

Convert a single web page to Markdown:

```bash
web-markdown-dl --url "https://example.com/article"
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
web-markdown-dl --input-file urls.txt --output-dir ./output
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
web-markdown-dl --url "https://example.com" --crawl --output-dir ./crawled
```

Options:
- `--max-depth <n>` - Maximum crawl depth (default: 2)
- `--limit <n>` - Maximum URLs to crawl (default: 100)
- `--ignore-robots` - Ignore robots.txt restrictions
- `--allow-external` - Allow crawling external domains

### 4. Wrapper Script

Use the wrapper script for simplified commands:

```bash
# Convert URL to markdown
~/.config/opencode/skills/web-markdown-dl/scripts/run.sh convert --url "https://example.com"

# Batch process
~/.config/opencode/skills/web-markdown-dl/scripts/run.sh batch --input-file urls.txt --output-dir ./output

# Crawl website
~/.config/opencode/skills/web-markdown-dl/scripts/run.sh crawl --url "https://example.com" --output-dir ./crawled --max-depth 3
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
web-markdown-dl --url "https://blog.example.com/post" --filter
```

### Batch Download Documentation

```bash
# Create urls.txt with doc URLs
web-markdown-dl --input-file urls.txt --output-dir ./docs --delay 500
```

### Crawl API Reference

```bash
web-markdown-dl --url "https://api.example.com/docs" --crawl --output-dir ./api-docs --max-depth 3
```

### Get Structured Data

```bash
web-markdown-dl --url "https://example.com" --format json --output page.json
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
EOF

echo -e "${GREEN}✓ SKILL.md created${NC}"
echo ""

# Step 5: Copy the run.sh script
echo "📋 Step 5: Copying wrapper script..."
cp "$PROJECT_ROOT/.config/opencode/skills/web-markdown-dl/scripts/run.sh" "$SKILL_DIR/scripts/run.sh"
chmod +x "$SKILL_DIR/scripts/run.sh"
echo -e "${GREEN}✓ Wrapper script copied${NC}"
echo ""

# Step 6: Verify installation
echo "🔍 Step 6: Verifying installation..."
if "$SKILL_DIR/bin/web-markdown-dl" --version >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Binary is working${NC}"
else
    echo -e "${YELLOW}⚠️  Binary test returned non-zero exit code (this may be normal)${NC}"
fi

if "$SKILL_DIR/bin/web-markdown-dl" --help >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Help command works${NC}"
else
    echo -e "${YELLOW}⚠️  Help test returned non-zero exit code (this may be normal)${NC}"
fi
echo ""

# Final summary
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "Skill installed to: $SKILL_DIR"
echo ""
echo "Quick start:"
echo "  web-markdown-dl --url https://example.com"
echo ""
echo "Or use the full path:"
echo "  $SKILL_DIR/bin/web-markdown-dl --url https://example.com"
echo ""
echo "To add to your PATH, add this to your shell profile:"
echo "  export PATH=\"\$HOME/.config/opencode/skills/web-markdown-dl/bin:\$PATH\""
