# Security Policy

## Supported Versions

The following versions of web-markdown-dl are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Security Features

This tool includes several security features to ensure safe operation:

### Path Traversal Protection (CWE-22)

The tool prevents path traversal attacks that could allow writing files outside the intended output directory:

- Filenames are sanitized to remove dangerous characters
- Output paths are validated to ensure they remain within the output directory
- URL-encoded traversal sequences (e.g., `%2e%2e`) are detected and blocked
- Attempts to write to system directories or parent directories are rejected

### SSRF Protection (CWE-918)

Server-Side Request Forgery protection prevents the tool from accessing internal network resources:

By default, the following are blocked:
- Loopback addresses (127.0.0.0/8, ::1)
- Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Link-local addresses (169.254.0.0/16, fe80::/10)
- Cloud metadata services (169.254.169.254)
- localhost hostname

Use `--allow-internal` flag to bypass these restrictions (with appropriate warnings).

### File Overwrite Protection (CWE-552)

The tool prevents accidental or malicious overwriting of existing files:

- Existing files are not overwritten by default
- Use `--force` flag to explicitly allow overwriting
- Clear warning messages when files are skipped

### Browser Security Hardening

The Playwright browser is launched with security-focused arguments:

- `--no-sandbox` and `--disable-setuid-sandbox` for proper sandboxing
- `--disable-dev-shm-usage` to prevent shared memory issues
- `--disable-accelerated-2d-canvas` to disable GPU canvas
- `--disable-gpu` to disable GPU acceleration

### Input Size Limits

Batch processing includes limits to prevent resource exhaustion:

- Maximum file size: 10MB
- Maximum URL count: 10,000

### robots.txt Compliance

By default, the tool respects robots.txt files. Use `--ignore-robots` to bypass (with warning).

### Domain Restrictions

By default, crawling stays within the original domain. Use `--allow-external` to crawl external domains (with warning).

## Reporting a Vulnerability

If you discover a security vulnerability in web-markdown-dl, please report it responsibly:

1. **Do not** open a public issue on GitHub
2. Email security concerns to: [Your Email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Investigate and provide initial assessment within 7 days
- Release a patch as soon as possible
- Credit you in the security advisory (unless you prefer anonymity)

## Security Best Practices

When using this tool:

### Legal and Ethical Considerations

1. **Respect robots.txt**: Only use `--ignore-robots` when you have explicit permission
2. **Terms of Service**: Ensure scraping is permitted by the target site's ToS
3. **Rate Limiting**: Use appropriate delays (`--delay`) to avoid overwhelming servers
4. **Data Privacy**: Be mindful of personal data and GDPR/privacy laws

### Safe Configuration

```bash
# Safe defaults (recommended)
web-markdown-dl --url https://example.com/page

# With content filtering
web-markdown-dl --url https://example.com/page --filter

# Batch processing with polite delays
web-markdown-dl --input-file urls.txt --output-dir ./output --delay 2000

# Crawling with domain restriction (default)
web-markdown-dl --url https://example.com --crawl --output-dir ./crawled
```

### Risky Options (Use with Caution)

The following options increase risk and should be used carefully:

- `--ignore-robots`: May violate Terms of Service
- `--allow-external`: May crawl unintended third-party sites
- `--allow-internal`: Allows access to internal network (SSRF risk)
- `--force`: May overwrite existing files

## Known Security Considerations

### Limitations

1. **JavaScript Execution**: The tool uses a headless browser which executes JavaScript on scraped pages. Malicious JavaScript could potentially exploit browser vulnerabilities.

2. **HTML Content**: Downloaded HTML content is processed and converted to Markdown. Maliciously crafted HTML could cause issues in the conversion process.

3. **Resource Limits**: While input size limits are enforced, the tool does not implement strict memory or CPU limits. Very large pages could consume significant resources.

### Recommendations

1. Run the tool in an isolated environment (container/VM) when processing untrusted URLs
2. Keep dependencies updated (`bun install` regularly)
3. Monitor resource usage when processing large batches
4. Use content filtering (`--filter`) to reduce attack surface
5. Validate output before further processing

## Security Updates

Security patches are released as soon as possible after a vulnerability is confirmed. Users should:

1. Watch the repository for security advisories
2. Update promptly when security fixes are released
3. Review the [CHANGELOG](./CHANGELOG.md) for security-related changes

## Dependency Security

This tool relies on several third-party packages. We monitor these for security vulnerabilities:

- **Playwright**: Browser automation (CVE-2025-59288 fixed in ^1.56.0)
- **@mozilla/readability**: Content extraction (ReDoS fixed in ^0.6.0)
- **JSDOM**: DOM manipulation
- **turndown**: HTML to Markdown conversion

Run `bun audit` periodically to check for known vulnerabilities in dependencies.

## License and Disclaimer

This tool is provided "as is" without warranty of any kind. Users are responsible for:
- Complying with applicable laws and regulations
- Respecting website Terms of Service
- Using the tool ethically and responsibly

See [LICENSE](./LICENSE) for full terms.
