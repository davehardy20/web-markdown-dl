/**
 * Security utilities for path validation, filename sanitization, and SSRF protection
 * Prevents path traversal attacks (CWE-22) and Server-Side Request Forgery (CWE-918)
 */

import { resolve, normalize, basename } from 'path';
import { access, constants } from 'fs/promises';

/**
 * Blocked IP patterns for SSRF protection
 * Includes private IP ranges, loopback, link-local, and cloud metadata services
 */
const BLOCKED_IP_PATTERNS = [
  /^127\./,                           // Loopback (127.0.0.0/8)
  /^10\./,                            // Private Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[01])\./,   // Private Class B (172.16.0.0/12)
  /^192\.168\./,                      // Private Class C (192.168.0.0/16)
  /^169\.254\./,                      // Link-local (169.254.0.0/16)
  /^0\./,                             // Current network (0.0.0.0/8)
  /^fc00:/i,                          // IPv6 Unique Local (fc00::/7)
  /^fe80:/i,                          // IPv6 Link-local (fe80::/10)
  /^::1/,                             // IPv6 Loopback
  /^::ffff:127\./,                    // IPv4-mapped IPv6 loopback
];

/**
 * Check if an IP address is internal/private
 * Used for SSRF protection to prevent access to internal network resources
 *
 * @param ip - The IP address to check
 * @returns true if the IP is internal/private
 */
export function isInternalIp(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some(pattern => pattern.test(ip));
}

/**
 * Custom error for SSRF attempt failures
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

/**
 * Validate URL for SSRF protection
 * Checks for internal IPs, localhost, and cloud metadata services
 *
 * @param url - The URL to validate
 * @param allowInternal - Whether to allow internal network access (default: false)
 * @returns Object with validation result and optional error message
 */
export function validateUrlForSsrf(
  url: string,
  allowInternal: boolean = false
): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: `Protocol not allowed: ${parsed.protocol}` };
    }

    // Check for localhost variants
    const hostname = parsed.hostname.toLowerCase();
    if (!allowInternal) {
      if (hostname === 'localhost' || hostname === '[::1]') {
        return { valid: false, error: 'localhost access is blocked' };
      }

      // Check for internal IPs
      if (isInternalIp(hostname)) {
        return { valid: false, error: `Internal IP blocked: ${hostname}` };
      }

      // Block cloud metadata services
      if (hostname === '169.254.169.254') {
        return { valid: false, error: 'Cloud metadata service blocked' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid URL: ${error}` };
  }
}

/**
 * Custom error for path validation failures
 */
export class PathSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathSecurityError';
  }
}

/**
 * Check if a resolved path is within the base directory
 * Prevents path traversal attacks (e.g., ../../../etc/passwd)
 *
 * @param filePath - The path to validate
 * @param baseDir - The base directory that paths must stay within
 * @returns true if the path is safe, false otherwise
 */
export function isPathSafe(filePath: string, baseDir: string): boolean {
  // Normalize and resolve both paths to absolute paths
  const resolved = resolve(normalize(filePath));
  const baseResolved = resolve(normalize(baseDir));

  // Ensure path starts with base directory followed by separator
  // This prevents:
  // - /output -> /output_dir (different base)
  // - /output_dir_other -> /output_dir (prefix match without separator)
  return resolved === baseResolved ||
         resolved.startsWith(baseResolved + '/');
}

/**
 * Sanitize a string for use as a filename
 * Uses whitelist approach: only allows alphanumeric, dash, underscore, and dot
 *
 * This prevents:
 * - Path traversal sequences (../, ..\)
 * - Null bytes
 * - Control characters
 * - Platform-specific reserved characters
 *
 * @param name - The string to sanitize
 * @returns A safe filename string
 */
export function sanitizeFilename(name: string): string {
  // Decode URI-encoded characters first to catch encoded traversal attempts
  let decoded = name;
  try {
    // Handle multiple levels of encoding
    let prev = '';
    while (prev !== decoded) {
      prev = decoded;
      decoded = decodeURIComponent(decoded);
    }
  } catch {
    // If decoding fails, use original string
    decoded = name;
  }

  let sanitized = decoded.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f]/g, '');
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Collapse multiple underscores into one
  sanitized = sanitized.replace(/_+/g, '_');

  // Trim leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, '');

  // Remove leading dots to prevent hidden files and traversal
  sanitized = sanitized.replace(/^\.+/, '');

  // Limit length to prevent filesystem issues
  const maxLength = 200;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // If nothing left after sanitization, use a fallback
  if (sanitized.length === 0) {
    sanitized = 'unnamed';
  }

  return sanitized;
}

/**
 * Sanitize a URL for use as a filename
 * Removes protocol, domain-specific characters, and applies strict sanitization
 *
 * @param url - The URL to convert to a safe filename
 * @returns A safe filename derived from the URL
 */
export function sanitizeUrlForFilename(url: string): string {
  // Check for path traversal attempts in the original URL
  if (url.includes('..') || url.includes('%2e')) {
    throw new PathSecurityError(
      `Path traversal detected in URL: "${url}"`
    );
  }

  let sanitized = url;

  // Remove protocol
  sanitized = sanitized.replace(/^https?:\/\//, '');

  // Remove trailing slashes
  sanitized = sanitized.replace(/\/+$/, '');

  // Apply strict sanitization using the whitelist approach
  // This catches path traversal sequences and other dangerous patterns
  sanitized = sanitizeFilename(sanitized);

  return sanitized;
}

/**
 * Check if a file exists
 *
 * @param path - The path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate and resolve an output path
 * Throws PathSecurityError if the path would escape the base directory
 *
 * @param filename - The filename to validate
 * @param baseDir - The base output directory
 * @returns The safe, resolved absolute path
 * @throws PathSecurityError if path traversal is detected
 */
export function validateOutputPath(filename: string, baseDir: string): string {
  // Check for path traversal attempts in the original filename
  if (filename.includes('..') || filename.includes('%2e')) {
    throw new PathSecurityError(
      `Path traversal detected in filename: "${filename}"`
    );
  }

  // Sanitize the filename first
  const safeFilename = sanitizeFilename(filename);

  // Construct the full path
  const outputPath = resolve(baseDir, safeFilename);

  // Verify it's still within the base directory
  if (!isPathSafe(outputPath, baseDir)) {
    throw new PathSecurityError(
      `Path traversal detected: "${filename}" resolves outside the output directory`
    );
  }

  return outputPath;
}

/**
 * Build a safe output path from URL and validate it
 * Combines URL sanitization with path validation
 *
 * @param url - The source URL
 * @param baseDir - The base output directory
 * @param extension - File extension (without dot)
 * @returns The safe, resolved absolute path
 * @throws PathSecurityError if path traversal is detected
 */
export function buildSafeOutputPath(
  url: string,
  baseDir: string,
  extension: string
): string {
  // Sanitize URL for filename use
  const safeBasename = sanitizeUrlForFilename(url);

  // Add extension
  const filename = `${safeBasename}.${extension}`;

  // Validate and return
  return validateOutputPath(filename, baseDir);
}

/**
 * Build a safe output path with prefix (for crawler depth organization)
 *
 * @param url - The source URL
 * @param baseDir - The base output directory
 * @param extension - File extension (without dot)
 * @param prefix - Optional prefix (e.g., "d0_", "d1_")
 * @returns The safe, resolved absolute path
 * @throws PathSecurityError if path traversal is detected
 */
export function buildSafeOutputPathWithPrefix(
  url: string,
  baseDir: string,
  extension: string,
  prefix: string
): string {
  // Sanitize URL for filename use
  const safeBasename = sanitizeUrlForFilename(url);

  // Sanitize prefix but preserve trailing underscore if present
  // Prefixes like "d0_" should remain "d0_" not become "d0"
  let safePrefix = sanitizeFilename(prefix);
  
  // If original prefix ended with underscore but sanitized doesn't, add it back
  if (prefix.endsWith('_') && !safePrefix.endsWith('_') && safePrefix.length > 0) {
    safePrefix += '_';
  }
  
  const fullBasename = `${safePrefix}${safeBasename}`;

  // Add extension
  const filename = `${fullBasename}.${extension}`;

  // Validate and return
  return validateOutputPath(filename, baseDir);
}
