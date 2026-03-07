/**
 * @repo/feedback - useConsoleCapture hook.
 *
 * Passively intercepts console.error calls and stores them in a circular
 * buffer so they can be attached to feedback reports.
 */
import { useCallback, useEffect, useRef } from 'react';

/** Maximum number of console errors to capture before evicting oldest entries. */
const MAX_BUFFER_SIZE = 10;

/** Maximum character length of each captured error entry. */
const MAX_ENTRY_LENGTH = 500;

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
 * Safe to mount multiple times: each instance manages its own buffer and
 * restores the original `console.error` on unmount.
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
    const bufferRef = useRef<string[]>([]);

    useEffect(() => {
        const originalError = console.error;

        console.error = (...args: unknown[]) => {
            // Always call original first to preserve normal behavior
            originalError.apply(console, args);

            const serialized = args
                .map((arg) => {
                    try {
                        return typeof arg === 'string' ? arg : JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                })
                .join(' ');

            const entry = `${new Date().toISOString()} ${serialized}`.slice(0, MAX_ENTRY_LENGTH);

            const buffer = bufferRef.current;
            if (buffer.length >= MAX_BUFFER_SIZE) {
                buffer.shift();
            }
            buffer.push(entry);
        };

        return () => {
            console.error = originalError;
        };
    }, []);

    const getErrors = useCallback(() => [...bufferRef.current], []);

    return { getErrors };
}
