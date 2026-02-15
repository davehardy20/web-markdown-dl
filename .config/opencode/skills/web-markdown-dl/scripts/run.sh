#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
CLI="$PROJECT_ROOT/bin/web-markdown-dl"

if [[ ! -x "$CLI" ]]; then
    echo "Error: CLI not found at $CLI" >&2
    echo "Run 'bun run build' in the project root first." >&2
    exit 1
fi

COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
    convert)
        exec "$CLI" --format markdown "$@"
        ;;
    
    convert-json)
        exec "$CLI" --format json "$@"
        ;;
    
    batch)
        if [[ -z "$1" ]] || [[ -z "$2" ]]; then
            echo "Usage: $0 batch --input-file <file> --output-dir <dir> [options]" >&2
            exit 1
        fi
        exec "$CLI" --format markdown "$@"
        ;;
    
    batch-json)
        if [[ -z "$1" ]] || [[ -z "$2" ]]; then
            echo "Usage: $0 batch-json --input-file <file> --output-dir <dir> [options]" >&2
            exit 1
        fi
        exec "$CLI" --format json "$@"
        ;;
    
    crawl)
        if [[ -z "$1" ]] || [[ -z "$3" ]]; then
            echo "Usage: $0 crawl --url <url> --output-dir <dir> [options]" >&2
            exit 1
        fi
        exec "$CLI" --crawl --format markdown "$@"
        ;;
    
    crawl-json)
        if [[ -z "$1" ]] || [[ -z "$3" ]]; then
            echo "Usage: $0 crawl-json --url <url> --output-dir <dir> [options]" >&2
            exit 1
        fi
        exec "$CLI" --crawl --format json "$@"
        ;;
    
    help|--help|-h)
        echo "Web Markdown DL - Skill Wrapper"
        echo ""
        echo "Commands:"
        echo "  convert       Convert a single URL to markdown"
        echo "  convert-json  Convert a single URL to JSON format"
        echo "  batch         Batch process URLs from a file (markdown)"
        echo "  batch-json    Batch process URLs from a file (JSON)"
        echo "  crawl         Crawl a website (markdown)"
        echo "  crawl-json    Crawl a website (JSON)"
        echo ""
        echo "Examples:"
        echo "  $0 convert --url https://example.com"
        echo "  $0 convert --url https://example.com --filter --output article.md"
        echo "  $0 batch --input-file urls.txt --output-dir ./output"
        echo "  $0 crawl --url https://example.com --output-dir ./crawled --max-depth 3"
        echo ""
        echo "Run '$CLI --help' for all CLI options."
        ;;
    
    *)
        exec "$CLI" "$COMMAND" "$@"
        ;;
esac
