/**
 * @repo/feedback - Environment data collector utility.
 *
 * Collects browser environment data (URL, browser/OS info, viewport) for
 * inclusion in feedback reports. Safe to call in SSR contexts.
 */
import { UAParser } from 'ua-parser-js';
import type { AppSourceId, FeedbackEnvironment } from '../schemas/feedback.schema.js';

/**
 * Input for collecting environment data.
 */
export interface CollectEnvironmentInput {
    /** Application source identifier */
    appSource: AppSourceId;
    /** Deploy version (git hash or release tag) */
    deployVersion?: string;
    /** Authenticated user ID (if available) */
    userId?: string;
    /** Authenticated user email (if available) */
    userEmail?: string;
    /** Authenticated user name (if available) */
    userName?: string;
    /** Console errors from capture buffer */
    consoleErrors?: string[];
    /** Error info from error boundary */
    errorInfo?: { message: string; stack?: string };
}

/**
 * Collects browser environment data for feedback reports.
 *
 * Reads window, navigator, and UAParser to build a `FeedbackEnvironment`
 * object. Returns partial data (only timestamp + appSource) when called
 * in a non-browser (SSR) context where `window` or `navigator` are not
 * available.
 *
 * @param input - Required app source and optional user/error context
 * @returns Populated FeedbackEnvironment object
 *
 * @example
 * ```ts
 * const env = collectEnvironmentData({
 *   appSource: 'web',
 *   deployVersion: 'abc1234',
 *   userId: 'usr_123',
 * });
 * ```
 */
export function collectEnvironmentData(input: CollectEnvironmentInput): FeedbackEnvironment {
    const isBrowser = typeof window !== 'undefined';

    let browser: string | undefined;
    let os: string | undefined;

    if (isBrowser && typeof navigator !== 'undefined') {
        const parser = new UAParser(navigator.userAgent);
        const browserInfo = parser.getBrowser();
        const osInfo = parser.getOS();
        browser = browserInfo.name
            ? `${browserInfo.name} ${browserInfo.version ?? ''}`.trim()
            : undefined;
        os = osInfo.name ? `${osInfo.name} ${osInfo.version ?? ''}`.trim() : undefined;
    }

    // Strip query string and hash to avoid leaking OAuth tokens or session
    // fragments that may appear in the URL (e.g., ?code=xxx&state=yyy)
    const safeUrl = isBrowser ? `${window.location.origin}${window.location.pathname}` : undefined;

    return {
        currentUrl: safeUrl,
        browser,
        os,
        viewport: isBrowser ? `${window.innerWidth}x${window.innerHeight}` : undefined,
        timestamp: new Date().toISOString(),
        appSource: input.appSource,
        deployVersion: input.deployVersion,
        userId: input.userId,
        consoleErrors: input.consoleErrors,
        errorInfo: input.errorInfo
    };
}
