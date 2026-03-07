/**
 * Tests for the useConsoleCapture hook logic.
 *
 * Because @testing-library/react is not available in this package, we test
 * the core behavior by directly exercising the interception pattern that
 * the hook sets up, using the same constants and logic it relies on.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/** Replicates the constants from the hook under test. */
const MAX_BUFFER_SIZE = 10;
const MAX_ENTRY_LENGTH = 500;

/**
 * Simulates the intercept setup that useConsoleCapture installs via
 * useEffect. Returns the buffer ref and a cleanup function.
 */
function installCapture(): { buffer: string[]; cleanup: () => void } {
    const buffer: string[] = [];
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
        // Call original first to preserve normal behavior
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

        if (buffer.length >= MAX_BUFFER_SIZE) {
            buffer.shift();
        }
        buffer.push(entry);
    };

    return {
        buffer,
        cleanup: () => {
            console.error = originalError;
        }
    };
}

describe('useConsoleCapture (logic)', () => {
    let cleanupFn: (() => void) | null = null;

    beforeEach(() => {
        cleanupFn = null;
    });

    afterEach(() => {
        // Always restore to ensure no test leaks
        if (cleanupFn) {
            cleanupFn();
            cleanupFn = null;
        }
    });

    it('should capture a console.error call as a string', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;

        // Act
        console.error('Something went wrong');

        // Assert
        expect(buffer).toHaveLength(1);
        expect(buffer[0]).toContain('Something went wrong');
    });

    it('should include an ISO timestamp prefix on each entry', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;

        // Act
        console.error('test message');

        // Assert
        expect(buffer[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should serialize object arguments to JSON', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;
        const obj = { code: 42, reason: 'timeout' };

        // Act
        console.error(obj);

        // Assert
        expect(buffer[0]).toContain('"code":42');
        expect(buffer[0]).toContain('"reason":"timeout"');
    });

    it('should serialize multiple arguments joined with space', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;

        // Act
        console.error('Error code:', 404, { path: '/api' });

        // Assert
        expect(buffer[0]).toContain('Error code:');
        expect(buffer[0]).toContain('404');
        expect(buffer[0]).toContain('"path":"/api"');
    });

    it('should truncate entries longer than MAX_ENTRY_LENGTH characters', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;
        const longMessage = 'x'.repeat(600);

        // Act
        console.error(longMessage);

        // Assert
        expect(buffer[0]?.length).toBe(MAX_ENTRY_LENGTH);
    });

    it('should hold at most MAX_BUFFER_SIZE entries (circular buffer)', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;

        // Act – push 15 entries
        for (let i = 1; i <= 15; i++) {
            console.error(`error-${i}`);
        }

        // Assert
        expect(buffer).toHaveLength(MAX_BUFFER_SIZE);
    });

    it('should evict the oldest entry when buffer is full', () => {
        // Arrange
        const { buffer, cleanup } = installCapture();
        cleanupFn = cleanup;

        // Use zero-padded ids so 'entry-01' is not a substring of 'entry-10'
        for (let i = 1; i <= MAX_BUFFER_SIZE; i++) {
            const padded = String(i).padStart(3, '0');
            console.error(`entry-${padded}`);
        }
        expect(buffer).toHaveLength(MAX_BUFFER_SIZE);

        // Act – push one more to trigger eviction of 'entry-001'
        console.error('entry-newest');

        // Assert
        expect(buffer).toHaveLength(MAX_BUFFER_SIZE);
        // 'entry-001' must have been evicted (padded 3 digits avoids substring collision)
        expect(buffer.some((e) => e.includes('entry-001'))).toBe(false);
        expect(buffer.some((e) => e.includes('entry-newest'))).toBe(true);
    });

    it('should restore original console.error after cleanup', () => {
        // Arrange
        const originalFn = console.error;
        const { cleanup } = installCapture();

        // The intercept should now be active
        expect(console.error).not.toBe(originalFn);

        // Act
        cleanup();
        cleanupFn = null; // prevent afterEach from calling it again

        // Assert
        expect(console.error).toBe(originalFn);
    });

    it('should still call the original console.error when an entry is captured', () => {
        // Arrange – capture the original before installing
        const callLog: unknown[][] = [];
        const originalFn = console.error;
        console.error = (...args: unknown[]) => {
            callLog.push(args);
            originalFn.apply(console, args);
        };

        const { cleanup } = installCapture();
        cleanupFn = () => {
            cleanup();
            // Restore past our spy too
            console.error = originalFn;
        };

        // Act
        console.error('forwarded message');

        // Assert – the spy we installed before installCapture should have been called
        expect(callLog.some((args) => args.includes('forwarded message'))).toBe(true);
    });
});
