# Web-to-Markdown Tool

## TL;DR

> **Quick Summary**: Build a local alternative to Markdowner using Playwright + TypeScript that converts websites to LLM-ready markdown. Includes both CLI tool and Opencode skill integration.
> 
> **Deliverables**:
> - Core TypeScript library for web-to-markdown conversion
> - CLI tool with full feature set (single URL, batch, crawling)
> - Opencode skill for seamless agent integration
> - Comprehensive test suite (unit + integration)
> 
> **Estimated Effort**: Large (multi-phase implementation)
> **Parallel Execution**: YES - Core lib → CLI → Tests → Skill (sequential waves)
> **Critical Path**: Core lib → CLI → Integration tests → Skill wrapper

---

## Context

### Original Request
User wants a local alternative to https://github.com/supermemoryai/markdowner that doesn't require paid Cloudflare Workers. The tool should use Playwright and TypeScript to convert websites to markdown format suitable for LLM consumption.

### Interview Summary
**Key Decisions**:
- Form factor: **BOTH CLI and Opencode skill**
- Features: **Full replication** of Markdowner capabilities
- LLM filtering: **Smart + Configurable** (Readability + custom rules)
- Output formats: **Markdown + Metadata JSON**
- Testing: **Both unit and integration tests**

**Tech Stack Decided**:
- TypeScript (main language)
- Playwright (browser automation)
- Turndown (HTML→Markdown conversion)
- Mozilla Readability (content extraction)
- Commander.js (CLI)
- Bun (package manager and test runner)

### Metis Review
**Identified Gaps** (addressed in plan):
- **Resource Limits**: Added explicit constraints (max depth, delays, timeouts)
- **Safety Boundaries**: robots.txt respect, domain restrictions, polite delays
- **Scope Creep Lock-down**: Explicit OUT OF SCOPE items (web UI, DB, plugins)
- **Acceptance Criteria**: Executable commands with expected outputs
- **Edge Cases**: Addressed infinite scroll, SPAs, redirects, encoding issues

**Key Recommendations Applied**:
- Start with single-package structure (monorepo only if justified later)
- CLI first, skill second (skill wraps CLI, doesn't duplicate)
- Phase implementation: Core → CLI → Tests → Crawling → Skill

---

## Work Objectives

### Core Objective
Build a robust, local web-to-markdown conversion tool using Playwright and TypeScript that can extract content from JavaScript-heavy websites, filter unnecessary elements, and output clean markdown suitable for LLM consumption.

### Concrete Deliverables
- TypeScript library at `src/` with core conversion logic
- CLI binary at `bin/web-markdown-dl` with full feature set
- Opencode skill configuration in `.config/opencode/skills/`
- Test suite with 80%+ coverage
- Documentation (README, API docs)

### Definition of Done
- [ ] Single URL converts to clean markdown
- [ ] Batch processing works with URL lists
- [ ] Crawling respects depth limits and domain restrictions
- [ ] All tests pass (unit + integration)
- [ ] CLI has help text and examples
- [ ] Opencode skill is installable and functional
- [ ] Documentation is complete

### Must Have
- Single URL to markdown conversion
- Playwright-based JavaScript rendering
- Turndown for HTML→Markdown conversion
- Mozilla Readability for content filtering
- CLI with stdin/file/URL input support
- JSON metadata output (URL, title, timestamp, headings, links)
- Resource limits (depth, count, timeout, delay)
- robots.txt respect by default
- Test suite (unit + integration)

### Must NOT Have (Guardrails)
- Web UI/dashboard (scope creep)
- Database persistence layer
- Real-time watching/monitoring
- Plugin system in v1
- AI summarization beyond filtering
- PDF export
- Browser extensions
- Rate limiting circumvention tools

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task, regardless of test strategy.

### Test Decision
- **Infrastructure exists**: NO (greenfield project)
- **Automated tests**: YES (TDD style)
- **Framework**: `bun test` (built-in, fast)
- **Agent-Executed QA**: MANDATORY for all tasks

### If TDD Enabled
Each TODO follows RED-GREEN-REFACTOR pattern where applicable.

**Test Setup Task**:
- [ ] 0. Setup Test Infrastructure
  - Verify: `bun --version` returns version
  - Config: Create `tsconfig.json` with strict mode
  - Example: Create `src/__tests__/example.test.ts`
  - Verify: `bun test` → 1 test passes

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Each task MUST include executable QA scenarios using specific tools:
- **CLI/TUI**: `bash` tool with exact commands
- **Library code**: `bash` tool with bun/node REPL
- **Opencode skill**: Actual skill invocation

**Scenario Format**:
```
Scenario: [Name]
  Tool: [bash | interactive_bash | Playwright]
  Steps:
    1. [Exact command with real values]
    2. [Assertion with expected output]
  Expected Result: [Concrete outcome]
  Evidence: [Output capture path]
```

---

## Execution Strategy

### Phase 1: Foundation (Waves 1-2)
**Goal**: Core library and CLI basics

**Wave 1**:
- Task 1: Project setup and dependencies
- Task 2: Core scraper module (Playwright wrapper)

**Wave 2**:
- Task 3: HTML→Markdown converter (Turndown integration)
- Task 4: CLI with single URL support

### Phase 2: Features (Waves 3-4)
**Goal**: Advanced features and robustness

**Wave 3**:
- Task 5: Content filtering (Readability integration)
- Task 6: Metadata extraction and JSON output

**Wave 4**:
- Task 7: Batch processing (URL lists)
- Task 8: Crawling (depth-limited, domain-restricted)

### Phase 3: Polish (Waves 5-6)
**Goal**: Testing, documentation, and integration

**Wave 5**:
- Task 9: Comprehensive test suite
- Task 10: Error handling and edge cases

**Wave 6**:
- Task 11: Opencode skill integration
- Task 12: Documentation and examples

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 3, 4 | None |
| 3 | 1, 2 | 4, 5 | None |
| 4 | 1, 2, 3 | 6, 7 | None |
| 5 | 3 | 6 | None |
| 6 | 4, 5 | 7 | None |
| 7 | 4, 6 | 8 | None |
| 8 | 7 | 9 | None |
| 9 | 1-8 | 10, 11 | None |
| 10 | 9 | 11 | None |
| 11 | 9, 10 | 12 | None |
| 12 | 11 | None | None |

### Critical Path
```
Task 1 → Task 2 → Task 3 → Task 4 → Task 6 → Task 7 → Task 8 → Task 9 → Task 11 → Task 12
```

---

## TODOs

- [ ] 1. Project Setup and Dependencies

  **What to do**:
  - Initialize git repository
  - Create `package.json` with dependencies
  - Install Playwright, Turndown, @mozilla/readability, commander
  - Setup TypeScript configuration
  - Create directory structure

  **Must NOT do**:
  - Add unnecessary dev dependencies
  - Create monorepo structure yet (single package for now)
  - Skip lock file generation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Simple setup task, no domain complexity

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - Turndown npm: `turndown` package
  - Readability npm: `@mozilla/readability` package
  - Playwright docs: `https://playwright.dev/docs/intro`

  **Acceptance Criteria**:
  - [ ] `package.json` exists with all dependencies
  - [ ] `bun install` completes without errors
  - [ ] `tsconfig.json` exists with strict mode enabled
  - [ ] Directory structure created (`src/`, `bin/`, `test/`)
  - [ ] `bun --version` returns version (verify Bun installed)

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Project structure is correct
    Tool: bash
    Steps:
      1. ls package.json tsconfig.json
      2. cat package.json | grep -q "turndown"
      3. cat package.json | grep -q "playwright"
      4. cat package.json | grep -q "@mozilla/readability"
      5. test -d src && test -d bin && test -d test
    Expected Result: All files and directories exist
    Evidence: Terminal output showing directory listing
  ```

  **Commit**: YES
  - Message: `chore: initial project setup with dependencies`
  - Files: `package.json`, `tsconfig.json`, `.gitignore`, `README.md`

- [ ] 2. Core Scraper Module (Playwright Wrapper)

  **What to do**:
  - Create `src/scraper.ts`
  - Implement `Scraper` class with Playwright integration
  - Support: page navigation, wait for load, extract HTML
  - Add configurable timeouts and user-agent
  - Handle errors gracefully (network, timeout, 404)

  **Must NOT do**:
  - Hardcode values (use options/parameters)
  - Launch browser per request (use persistent context)
  - Skip error handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]
  - `playwright`: Browser automation patterns and best practices

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: Task 1

  **References**:
  - Playwright browser context: `browser.newContext()`
  - Page navigation: `page.goto(url, { waitUntil: 'networkidle' })`
  - Error handling: try/catch with specific error types

  **Acceptance Criteria**:
  - [ ] Scraper class can navigate to a URL
  - [ ] Returns HTML content as string
  - [ ] Handles timeout errors (configurable)
  - [ ] Handles network errors gracefully
  - [ ] Unit test mocks Playwright (no real browser in unit tests)

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Scraper extracts HTML from example.com
    Tool: bash
    Steps:
      1. cat > test-scraper.ts << 'EOF'
         import { Scraper } from './src/scraper';
         const scraper = new Scraper({ timeout: 10000 });
         scraper.scrape('https://example.com').then(result => {
           console.log('Success:', result.html.includes('<h1>Example Domain'));
           scraper.close();
         });
         EOF
      2. bun run test-scraper.ts
    Expected Result: Output shows "Success: true"
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: add Playwright-based scraper module`
  - Files: `src/scraper.ts`, `src/types.ts`, `src/__tests__/scraper.test.ts`

- [ ] 3. HTML to Markdown Converter (Turndown Integration)

  **What to do**:
  - Create `src/converter.ts`
  - Integrate Turndown library
  - Configure for LLM-friendly output (fenced code blocks, clean headings)
  - Add GFM plugin support (tables, strikethrough)
  - Create custom rules for problematic HTML patterns

  **Must NOT do**:
  - Use default Turndown config (optimize for LLM)
  - Skip custom rules for common issues
  - Ignore encoding issues

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Well-documented library integration

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 4, Task 5
  - **Blocked By**: Task 1, Task 2

  **References**:
  - Turndown config: `{ headingStyle: 'atx', codeBlockStyle: 'fenced' }`
  - GFM plugin: `turndown-plugin-gfm`
  - Custom rules: `turndownService.addRule()`

  **Acceptance Criteria**:
  - [ ] Converts `<h1>` to `# Heading`
  - [ ] Converts code blocks with backticks
  - [ ] Preserves links in markdown format
  - [ ] Handles tables with GFM plugin
  - [ ] Unit tests for various HTML patterns

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Converter handles basic HTML elements
    Tool: bash
    Steps:
      1. cat > test-converter.ts << 'EOF'
         import { Converter } from './src/converter';
         const converter = new Converter();
         const html = '<h1>Title</h1><p>Text with <strong>bold</strong></p>';
         const md = converter.convert(html);
         console.log('Has heading:', md.includes('# Title'));
         console.log('Has bold:', md.includes('**bold**'));
         EOF
      2. bun run test-converter.ts
    Expected Result: Both checks return true
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: add Turndown-based HTML to Markdown converter`
  - Files: `src/converter.ts`, `src/__tests__/converter.test.ts`

- [ ] 4. CLI with Single URL Support

  **What to do**:
  - Create `src/cli.ts` entry point
  - Use Commander.js for argument parsing
  - Support: `--url`, `--output`, `--format`, `--timeout`
  - Integrate scraper and converter
  - Add helpful error messages

  **Must NOT do**:
  - Skip input validation
  - Hardcode paths or defaults
  - Ignore exit codes (always return appropriate exit code)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: CLI pattern is straightforward

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6, Task 7
  - **Blocked By**: Task 1, Task 2, Task 3

  **References**:
  - Commander.js patterns from popular CLI tools
  - Exit codes: 0 (success), 1 (error), 130 (interrupted)

  **Acceptance Criteria**:
  - [ ] `web-markdown-dl --help` shows usage
  - [ ] `web-markdown-dl --url https://example.com` outputs markdown
  - [ ] `--output` saves to file
  - [ ] `--format json` outputs JSON
  - [ ] Non-existent URL returns exit code 1

  **Agent-Executed QA Scenario**:
  ```
  Scenario: CLI converts example.com to markdown
    Tool: bash
    Steps:
      1. ./bin/web-markdown-dl --url https://example.com --output /tmp/test.md
      2. test -f /tmp/test.md && grep -q "Example Domain" /tmp/test.md
      3. echo "Exit code: $?"
    Expected Result: Exit code 0, file contains "Example Domain"
    Evidence: Terminal output and file content
  ```

  **Commit**: YES
  - Message: `feat: add CLI with single URL support`
  - Files: `src/cli.ts`, `bin/web-markdown-dl`, `src/__tests__/cli.test.ts`

- [ ] 5. Content Filtering (Mozilla Readability Integration)

  **What to do**:
  - Create `src/filter.ts`
  - Integrate @mozilla/readability
  - Extract main content (remove nav, ads, sidebars)
  - Configurable: enable/disable filtering
  - Fallback to raw HTML if filtering fails

  **Must NOT do**:
  - Make filtering mandatory (should be optional)
  - Fail if Readability can't parse (use fallback)
  - Skip warning when content might be incomplete

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Library integration with fallback logic

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 6
  - **Blocked By**: Task 3

  **References**:
  - Readability usage: `new Readability(document).parse()`
  - JSDOM integration for Node.js
  - Fallback strategy: raw HTML with warning

  **Acceptance Criteria**:
  - [ ] Filters out navigation elements
  - [ ] Extracts main article content
  - [ ] Configurable via `--filter` flag
  - [ ] Falls back to raw HTML on failure
  - [ ] Unit tests for filter logic

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Filter removes nav from news site
    Tool: bash
    Steps:
      1. ./bin/web-markdown-dl --url https://news.ycombinator.com --filter --output /tmp/filtered.md
      2. wc -l /tmp/filtered.md
      3. ./bin/web-markdown-dl --url https://news.ycombinator.com --no-filter --output /tmp/raw.md
      4. wc -l /tmp/raw.md
      5. test $(wc -l < /tmp/filtered.md) -lt $(wc -l < /tmp/raw.md)
    Expected Result: Filtered version has fewer lines than raw
    Evidence: File line counts
  ```

  **Commit**: YES
  - Message: `feat: add Mozilla Readability content filtering`
  - Files: `src/filter.ts`, `src/__tests__/filter.test.ts`

- [ ] 6. Metadata Extraction and JSON Output

  **What to do**:
  - Create `src/metadata.ts`
  - Extract: URL, title, timestamp, headings, links, word count
  - Format JSON schema: `{ url, title, timestamp, headings[], links[], wordCount, markdown }`
  - Add `--format json` CLI option
  - Pretty-print JSON for readability

  **Must NOT do**:
  - Skip validation of metadata fields
  - Return partial JSON on error
  - Hardcode timezone (use UTC)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Data extraction and formatting

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 7
  - **Blocked By**: Task 4, Task 5

  **References**:
  - JSON Schema: Standard metadata fields from original Markdowner
  - Date handling: `new Date().toISOString()`

  **Acceptance Criteria**:
  - [ ] JSON output contains all required fields
  - [ ] Links array extracted from `<a>` tags
  - [ ] Headings array with hierarchy preserved
  - [ ] Word count calculated from markdown
  - [ ] Schema validation passes

  **Agent-Executed QA Scenario**:
  ```
  Scenario: JSON output has correct structure
    Tool: bash
    Steps:
      1. ./bin/web-markdown-dl --url https://example.com --format json --output /tmp/meta.json
      2. jq -e '.url' /tmp/meta.json > /dev/null && echo "Has URL: yes"
      3. jq -e '.title' /tmp/meta.json > /dev/null && echo "Has title: yes"
      4. jq -e '.timestamp' /tmp/meta.json > /dev/null && echo "Has timestamp: yes"
      5. jq -e '.markdown' /tmp/meta.json > /dev/null && echo "Has markdown: yes"
    Expected Result: All fields present
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `feat: add metadata extraction and JSON output`
  - Files: `src/metadata.ts`, `src/types.ts` (update), `src/__tests__/metadata.test.ts`

- [ ] 7. Batch Processing (URL Lists)

  **What to do**:
  - Support `--input-file` with list of URLs
  - Process URLs sequentially (respect delays)
  - Progress output (X/Y completed)
  - Aggregate output (directory of .md files)
  - Error handling: log failures, continue processing

  **Must NOT do**:
  - Process in parallel without rate limiting
  - Skip failed URLs silently (log them)
  - Ignore memory usage with large lists

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Sequential processing with progress tracking

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 8
  - **Blocked By**: Task 4, Task 6

  **References**:
  - File reading: `fs.readFileSync(inputFile, 'utf8').split('\n')`
  - Progress: `console.error(\`Processed ${i}/${total}\`)`

  **Acceptance Criteria**:
  - [ ] Reads URL list from file
  - [ ] Processes each URL with delay between
  - [ ] Creates output directory with individual .md files
  - [ ] Logs failed URLs to stderr
  - [ ] Returns exit code 0 if all succeed, 1 if any fail

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Batch processing handles URL list
    Tool: bash
    Steps:
      1. echo -e "https://example.com\nhttps://example.org" > /tmp/urls.txt
      2. ./bin/web-markdown-dl --input-file /tmp/urls.txt --output-dir /tmp/batch --delay 1000
      3. ls /tmp/batch/*.md | wc -l
      4. grep -l "Example Domain" /tmp/batch/*.md
    Expected Result: 2 .md files created, both contain expected content
    Evidence: Directory listing and file contents
  ```

  **Commit**: YES
  - Message: `feat: add batch processing for URL lists`
  - Files: `src/batch.ts`, `src/__tests__/batch.test.ts`

- [ ] 8. Crawling (Depth-Limited, Domain-Restricted)

  **What to do**:
  - Implement `--crawl` flag
  - Extract links from pages
  - Respect `--max-depth` (default: 2)
  - Respect `--limit` (default: 100 URLs)
  - Domain restriction: stay within original domain by default
  - robots.txt support (with `--ignore-robots` override)
  - Polite delays between requests (default: 1000ms)

  **Must NOT do**:
  - Crawl without depth limit
  - Ignore robots.txt by default
  - Skip URL deduplication
  - Hammer servers without delays

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []
  - Reason: Complex logic with multiple constraints

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 9
  - **Blocked By**: Task 7

  **References**:
  - robots.txt parser: `robots-parser` package
  - URL deduplication: Normalize URLs (remove fragments, sort query params)
  - BFS traversal for depth-limited crawling

  **Acceptance Criteria**:
  - [ ] Respects max depth limit
  - [ ] Stays within domain by default
  - [ ] Checks robots.txt before crawling
  - [ ] Deduplicates URLs
  - [ ] Implements delays between requests
  - [ ] Logs crawl progress

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Crawling respects depth and domain limits
    Tool: bash
    Steps:
      1. ./bin/web-markdown-dl --url https://example.com --crawl --max-depth 1 --limit 5 --output-dir /tmp/crawl
      2. ls /tmp/crawl/*.md | wc -l
      3. test $(ls /tmp/crawl/*.md | wc -l) -le 5
    Expected Result: Maximum 5 files created (respects limit)
    Evidence: File count
  ```

  **Commit**: YES
  - Message: `feat: add depth-limited web crawling`
  - Files: `src/crawler.ts`, `src/__tests__/crawler.test.ts`

- [ ] 9. Comprehensive Test Suite

  **What to do**:
  - Unit tests for all modules (mocked dependencies)
  - Integration tests with real URLs (stable sites)
  - Test coverage: 80%+ target
  - Edge case tests: timeouts, 404s, encoding issues
  - CI-friendly (no interactive prompts)

  **Must NOT do**:
  - Skip error case testing
  - Use flaky external URLs in unit tests
  - Skip mocking (unit tests should be fast)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Testing patterns are well-established

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 10, Task 11
  - **Blocked By**: Task 1-8

  **References**:
  - Test patterns: Mock Playwright in unit tests
  - Stable test URLs: example.com, w3.org, httpbin.org

  **Acceptance Criteria**:
  - [ ] Unit tests for scraper (mocked)
  - [ ] Unit tests for converter
  - [ ] Unit tests for filter
  - [ ] Integration tests for full flow
  - [ ] Coverage report shows 80%+
  - [ ] `bun test` passes completely

  **Agent-Executed QA Scenario**:
  ```
  Scenario: All tests pass
    Tool: bash
    Steps:
      1. bun test
      2. echo "Exit code: $?"
    Expected Result: Exit code 0, all tests pass
    Evidence: Test output showing pass count
  ```

  **Commit**: YES
  - Message: `test: add comprehensive test suite`
  - Files: `src/__tests__/*.test.ts`, coverage reports

- [ ] 10. Error Handling and Edge Cases

  **What to do**:
  - Handle network errors (DNS, timeout, refused)
  - Handle HTTP errors (404, 500, 403)
  - Handle content errors (encoding, malformed HTML)
  - Handle resource limits (memory, disk space)
  - User-friendly error messages
  - Retry logic for transient failures

  **Must NOT do**:
  - Crash on any error (graceful degradation)
  - Leak browser instances on error
  - Swallow errors without logging

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Defensive programming patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Task 11
  - **Blocked By**: Task 9

  **References**:
  - Error types: Playwright errors, network errors, system errors
  - Retry pattern: Exponential backoff

  **Acceptance Criteria**:
  - [ ] Network errors caught and reported
  - [ ] HTTP 404 returns clear error message
  - [ ] Malformed HTML doesn't crash converter
  - [ ] Browser instances cleaned up on error
  - [ ] Tests for error scenarios

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Handles 404 gracefully
    Tool: bash
    Steps:
      1. ./bin/web-markdown-dl --url https://example.com/nonexistent-404-page 2>&1
      2. echo "Exit code: $?"
    Expected Result: Exit code non-zero, stderr contains error message
    Evidence: Error output
  ```

  **Commit**: YES
  - Message: `fix: add comprehensive error handling`
  - Files: `src/errors.ts`, `src/__tests__/errors.test.ts`

- [ ] 11. Opencode Skill Integration

  **What to do**:
  - Create skill configuration in `.config/opencode/skills/web-markdown-dl/`
  - Skill wraps CLI functionality
  - Expose as Opencode tool
  - Provide usage examples in skill description
  - Support structured output for agents

  **Must NOT do**:
  - Duplicate core logic in skill (wrap CLI)
  - Require interactive prompts in skill
  - Implement features CLI doesn't have

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: Skill configuration and wrapping

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 6
  - **Blocks**: Task 12
  - **Blocked By**: Task 9, Task 10

  **References**:
  - Opencode skill structure (from AGENTS.md)
  - MCP tool integration patterns

  **Acceptance Criteria**:
  - [ ] Skill configuration file exists
  - [ ] Skill can be loaded by Opencode
  - [ ] Skill calls CLI and returns markdown
  - [ ] Skill provides structured output
  - [ ] Documentation includes skill usage

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Skill is loadable and functional
    Tool: bash
    Steps:
      1. test -f ~/.config/opencode/skills/web-markdown-dl/skill.json
      2. opencode skill list | grep -q "web-markdown-dl"
    Expected Result: Skill exists and is registered
    Evidence: File existence and skill listing
  ```

  **Commit**: YES
  - Message: `feat: add Opencode skill integration`
  - Files: `.config/opencode/skills/web-markdown-dl/skill.json`, `skill-wrapper.ts`

- [ ] 12. Documentation and Examples

  **What to do**:
  - Update README.md with installation instructions
  - Add usage examples for all features
  - Document configuration options
  - Add troubleshooting guide
  - Include example outputs
  - Create CONTRIBUTING.md (optional)

  **Must NOT do**:
  - Skip installation prerequisites
  - Forget to document breaking changes
  - Ignore common issues

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: []
  - Reason: Documentation writing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 6
  - **Blocks**: None
  - **Blocked By**: Task 11

  **References**:
  - Good CLI documentation examples (curl, jq)
  - README templates for TypeScript projects

  **Acceptance Criteria**:
  - [ ] README has installation section
  - [ ] README has quick start example
  - [ ] All CLI flags documented
  - [ ] Example outputs shown
  - [ ] Troubleshooting section included
  - [ ] License and contribution info present

  **Agent-Executed QA Scenario**:
  ```
  Scenario: Documentation is complete
    Tool: bash
    Steps:
      1. grep -q "Installation" README.md && echo "Has install: yes"
      2. grep -q "## Usage" README.md && echo "Has usage: yes"
      3. grep -q "web-markdown-dl --url" README.md && echo "Has example: yes"
    Expected Result: All sections present
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `docs: add comprehensive documentation and examples`
  - Files: `README.md`, `examples/`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: initial project setup with dependencies` | package.json, tsconfig.json, .gitignore, README.md | `bun install` passes |
| 2 | `feat: add Playwright-based scraper module` | src/scraper.ts, src/types.ts, tests | `bun test src/__tests__/scraper.test.ts` |
| 3 | `feat: add Turndown-based HTML to Markdown converter` | src/converter.ts, tests | `bun test src/__tests__/converter.test.ts` |
| 4 | `feat: add CLI with single URL support` | src/cli.ts, bin/web-markdown-dl, tests | CLI --help works |
| 5 | `feat: add Mozilla Readability content filtering` | src/filter.ts, tests | Filter tests pass |
| 6 | `feat: add metadata extraction and JSON output` | src/metadata.ts, tests | JSON output valid |
| 7 | `feat: add batch processing for URL lists` | src/batch.ts, tests | Batch tests pass |
| 8 | `feat: add depth-limited web crawling` | src/crawler.ts, tests | Crawler respects limits |
| 9 | `test: add comprehensive test suite` | src/__tests__/*.test.ts | Coverage 80%+ |
| 10 | `fix: add comprehensive error handling` | src/errors.ts, tests | Error tests pass |
| 11 | `feat: add Opencode skill integration` | .config/opencode/skills/ | Skill loadable |
| 12 | `docs: add comprehensive documentation and examples` | README.md, examples/ | All docs present |

---

## Success Criteria

### Verification Commands

```bash
# 1. Project builds
bun install && bun run build
# Expected: No errors

# 2. Single URL conversion
./bin/web-markdown-dl --url https://example.com --output /tmp/test.md
# Expected: /tmp/test.md created with content

# 3. JSON output
./bin/web-markdown-dl --url https://example.com --format json | jq '.title'
# Expected: Valid JSON with title field

# 4. Filtering
./bin/web-markdown-dl --url https://news.ycombinator.com --filter --output /tmp/filtered.md
# Expected: Filtered content without navigation

# 5. Batch processing
echo "https://example.com" > /tmp/urls.txt
./bin/web-markdown-dl --input-file /tmp/urls.txt --output-dir /tmp/batch
# Expected: /tmp/batch/example-com.md created

# 6. Crawling
./bin/web-markdown-dl --url https://example.com --crawl --max-depth 1 --limit 5
# Expected: Up to 5 pages crawled

# 7. All tests pass
bun test
# Expected: 100% pass rate, 80%+ coverage

# 8. Skill is loadable
test -f ~/.config/opencode/skills/web-markdown-dl/skill.json
# Expected: File exists
```

### Final Checklist
- [ ] All "Must Have" features implemented
- [ ] All "Must NOT Have" items absent
- [ ] All tests pass (unit + integration)
- [ ] Test coverage 80%+
- [ ] CLI help text complete
- [ ] Opencode skill functional
- [ ] Documentation complete
- [ ] Git repository created and pushed to GitHub
- [ ] No security vulnerabilities in dependencies

---

## Resource Limits and Safety (Applied Defaults)

**Defaults Applied** (disclosed in plan):
- Max crawl depth: 2 (configurable)
- Max URLs per session: 100 (configurable)
- Delay between requests: 1000ms (configurable)
- Page timeout: 30 seconds (configurable)
- Response size limit: 10MB
- Concurrent pages: 1 (sequential by default)

**Safety Boundaries**:
- robots.txt respected by default
- Domain restriction enabled by default (stay within origin)
- User-agent identifies as "web-markdown-dl"
- All URLs logged with timestamp

**Override Flags**:
- `--ignore-robots` to bypass robots.txt
- `--allow-external` to crawl outside origin domain
- `--delay 0` to disable delays (use responsibly)

---

## Scope Boundaries (Explicit)

**IN SCOPE**:
- Single URL to markdown
- Batch URL processing
- Depth-limited crawling
- Content filtering
- Metadata extraction
- CLI with all options
- Opencode skill integration
- Test suite

**OUT OF SCOPE** (explicitly excluded):
- Web UI/dashboard
- Database persistence
- Real-time monitoring
- Plugin system
- AI summarization
- PDF export
- Browser extensions
- Rate limiting circumvention
- Automatic proxy rotation

---

## Notes for Executor

1. **Start with Task 1-4** before moving to advanced features. Core single-URL flow must work before adding crawling.

2. **CLI is primary interface**. Opencode skill wraps CLI - don't duplicate logic.

3. **Single package structure for now**. Extract to monorepo only if proven necessary later.

4. **Test-driven development**. Write tests before implementation where possible.

5. **Polite by default**. All defaults assume responsible web scraping.

6. **Error handling is critical**. Never crash - always graceful degradation with clear error messages.

7. **Documentation is part of the deliverable**. Don't skip Task 12.

8. **Create GitHub repository early**. Push after Task 1 and regularly thereafter.
