/**
 * Markdown and content safety helpers for the Linear feedback service.
 *
 * Extracted from linear.service.ts to keep the service file under
 * 500 lines. Contains escape, sanitization, and truncation utilities
 * used when building Linear issue bodies.
 */

/** Allowed presigned URL hosts for SSRF prevention (GAP-031-48) */
export const ALLOWED_UPLOAD_HOST_PATTERN =
    /^https:\/\/[a-z0-9-]+\.s3[a-z0-9.-]*\.amazonaws\.com\//i;

/** Patterns that indicate sensitive data in console errors (GAP-031-24) */
const SENSITIVE_PATTERNS = /sk_live_|pk_live_|Bearer |api_key=|apikey=|secret=|password=|token=/gi;

/** Redact server paths like /home/user/... or /app/... (GAP-031-24) */
const SERVER_PATH_PATTERN = /\/(home|app|usr|var|tmp)\/[^\s)]+/g;

/**
 * Escape Markdown special characters in user-supplied text to prevent
 * injection of links, images, and formatting in Linear issues.
 *
 * @param text - Raw user text
 * @returns Text with Markdown metacharacters escaped
 */
export function escapeMarkdown(text: string): string {
    return text
        .replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')
        .replace(/!\[/g, '\\!\\[')
        .replace(/\[([^\]]+)\]\(/g, '\\[$1\\](');
}

/**
 * Sanitize a console error string: redact API keys, server paths,
 * and truncate to a safe length.
 *
 * @param entry - Raw console error text
 * @param maxLength - Maximum length after sanitization
 * @returns Sanitized string
 */
export function sanitizeConsoleError(entry: string, maxLength = 500): string {
    return entry
        .replace(SENSITIVE_PATTERNS, '[REDACTED]')
        .replace(SERVER_PATH_PATTERN, '/[redacted-path]')
        .slice(0, maxLength);
}

/**
 * Truncate a stack trace to `maxLines` and redact server paths.
 *
 * @param stack - Raw stack trace
 * @param maxLines - Maximum number of lines to keep
 * @returns Truncated and redacted stack trace
 */
export function truncateStack(stack: string, maxLines = 10): string {
    const lines = stack.split('\n').slice(0, maxLines);
    return lines.join('\n').replace(SERVER_PATH_PATTERN, '/[redacted-path]').replace(/`/g, "'");
}
