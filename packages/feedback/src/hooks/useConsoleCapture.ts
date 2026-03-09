/**
 * @repo/feedback - useConsoleCapture hook.
 *
 * Passively intercepts console.error calls and stores them in a circular
 * buffer so they can be attached to feedback reports.
 *
 * Uses a module-level singleton to prevent multiple mounts from corrupting
 * the original console.error restoration chain.
 */
import { useCallback, useEffect } from 'react';

/** Maximum number of console errors to capture before evicting oldest entries. */
const MAX_BUFFER_SIZE = 10;

/** Maximum character length of each captured error entry. */
const MAX_ENTRY_LENGTH = 500;

/**
 * Patterns that indicate sensitive data in console error output.
 * Matched case-insensitively and replaced with `[REDACTED]`.
 */
const SENSITIVE_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /password\s*[=:]\s*\S+/gi,
    /secret\s*[=:]\s*\S+/gi,
    /token\s*[=:]\s*\S+/gi,
    /api[_-]?key\s*[=:]\s*\S+/gi,
    /authorization\s*[=:]\s*\S+/gi
];

/**
 * Strips sensitive patterns (tokens, passwords, API keys) from a string
 * to prevent accidental leakage in feedback reports.
 */
function redactSensitive(input: string): string {
    let result = input;
    for (const pattern of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

// ---------------------------------------------------------------------------
// Module-level singleton state
// ---------------------------------------------------------------------------

/** Shared circular buffer across all hook instances (treated as immutable externally) */
const sharedBuffer: string[] = [];

/** Number of active hook instances using the capture */
let mountCount = 0;

/** The real console.error before interception, or null if not intercepted */
let originalConsoleError: ((...args: unknown[]) => void) | null = null;

/**
 * Installs the console.error interceptor (idempotent).
 * Only patches once regardless of how many instances mount.
 */
function installInterceptor(): void {
    mountCount++;

    if (originalConsoleError !== null) {
        // Already installed by a previous mount
        return;
    }

    originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
        // Always call original first to preserve normal behavior
        originalConsoleError?.apply(console, args);

        const serialized = args
            .map((arg) => {
                try {
                    return typeof arg === 'string' ? arg : JSON.stringify(arg);
                } catch {
                    return String(arg);
                }
            })
            .join(' ');

        const entry = redactSensitive(
            `${new Date().toISOString()} ${serialized}`.slice(0, MAX_ENTRY_LENGTH)
        );

        if (sharedBuffer.length >= MAX_BUFFER_SIZE) {
            sharedBuffer.shift();
        }
        sharedBuffer.push(entry);
    };
}

/**
 * Removes the console.error interceptor when the last instance unmounts.
 */
function uninstallInterceptor(): void {
    mountCount--;

    if (mountCount <= 0 && originalConsoleError !== null) {
        console.error = originalConsoleError;
        originalConsoleError = null;
        mountCount = 0;
    }
}

/**
 * Captures recent `console.error` calls in a circular buffer.
 *
 * Intercepts `console.error` without modifying its original behavior:
 * the original implementation is always called first, and then the
 * serialized arguments are appended to an in-memory ring buffer.
 *
 * Call `getErrors()` at any time to obtain a snapshot of the captured
 * entries (newest at the end, oldest evicted when the buffer is full).
 *
 * Safe to mount multiple times: uses a module-level singleton so only
 * one interceptor exists at a time, and it is restored only when the
 * last instance unmounts.
 *
 * @returns Object with `getErrors` function to read the current buffer
 *
 * @example
 * ```tsx
 * function App() {
 *   const { getErrors } = useConsoleCapture();
 *   // pass getErrors to the feedback form to attach recent errors
 * }
 * ```
 */
export function useConsoleCapture(): { getErrors: () => string[] } {
    useEffect(() => {
        installInterceptor();
        return () => uninstallInterceptor();
    }, []);

    const getErrors = useCallback(() => [...sharedBuffer], []);

    return { getErrors };
}
