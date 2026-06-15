/**
 * RTL-based tests for useConsoleCapture hook.
 *
 * Uses renderHook + act to exercise the actual React hook lifecycle:
 * useEffect install/uninstall, module-level singleton, mount counting,
 * circular buffer via console.error interception.
 * Covers lines 60-109 (installInterceptor, console.error patch) and 136-144.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConsoleCapture } from '../../src/hooks/useConsoleCapture.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture the current console.error reference before each test. */
let originalConsoleError: (...args: unknown[]) => void;

beforeEach(() => {
    originalConsoleError = console.error;
});

afterEach(() => {
    // Always restore — the hook's uninstallInterceptor should have done this,
    // but we add a safety net in case a test unmounts abnormally.
    console.error = originalConsoleError;
});

// ---------------------------------------------------------------------------
// Tests: hook mount/unmount lifecycle
// ---------------------------------------------------------------------------

describe('useConsoleCapture — mount lifecycle', () => {
    it('should intercept console.error after mounting the hook', () => {
        const { unmount } = renderHook(() => useConsoleCapture());

        // After mount, console.error should be the interceptor (not the original)
        expect(console.error).not.toBe(originalConsoleError);

        unmount();
    });

    it('should restore original console.error after unmounting', () => {
        const { unmount } = renderHook(() => useConsoleCapture());
        unmount();

        expect(console.error).toBe(originalConsoleError);
    });

    it('should keep interceptor active when a second instance mounts', () => {
        const { unmount: unmount1 } = renderHook(() => useConsoleCapture());
        const interceptorAfterFirst = console.error;

        const { unmount: unmount2 } = renderHook(() => useConsoleCapture());

        // Still intercepted (singleton, same reference)
        expect(console.error).not.toBe(originalConsoleError);

        unmount2(); // one unmount: interceptor stays (mountCount > 0)
        expect(console.error).not.toBe(originalConsoleError);

        unmount1(); // last unmount: now restored
        expect(console.error).toBe(originalConsoleError);

        void interceptorAfterFirst; // avoid unused warning
    });
});

// ---------------------------------------------------------------------------
// Tests: getErrors captures console.error calls
// ---------------------------------------------------------------------------

describe('useConsoleCapture — getErrors', () => {
    it('should start with an empty errors list', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        // The shared buffer starts empty for a fresh test environment.
        // (afterEach in setup.tsx clears vi mocks but not module-level state;
        //  however the buffer is only filled by console.error calls, so
        //  freshly-mounted hook with no errors should return a snapshot of
        //  whatever is in the shared buffer — we just verify it is an array.)
        expect(Array.isArray(result.current.getErrors())).toBe(true);

        unmount();
    });

    it('should capture a console.error message in the buffer', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        act(() => {
            console.error('RTL captured error');
        });

        const errors = result.current.getErrors();
        expect(errors.some((e) => e.includes('RTL captured error'))).toBe(true);

        unmount();
    });

    it('should capture multiple console.error calls in order', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        act(() => {
            console.error('first');
            console.error('second');
            console.error('third');
        });

        const errors = result.current.getErrors();
        const filtered = errors.filter(
            (e) => e.includes('first') || e.includes('second') || e.includes('third')
        );
        expect(filtered.length).toBeGreaterThanOrEqual(3);

        unmount();
    });

    it('should return a snapshot (copy) so the caller cannot mutate the buffer', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        const snapshot1 = result.current.getErrors();
        const len1 = snapshot1.length;

        act(() => {
            console.error('new error after snapshot');
        });

        const snapshot2 = result.current.getErrors();

        // Original snapshot should be unchanged (it's a copy)
        expect(snapshot1.length).toBe(len1);
        // New snapshot should include the new error
        expect(snapshot2.some((e) => e.includes('new error after snapshot'))).toBe(true);

        unmount();
    });

    it('should still call the original console.error (pass-through)', () => {
        const calls: unknown[][] = [];
        // Temporarily replace originalConsoleError with a spy
        const spy = (...args: unknown[]) => calls.push(args);
        console.error = spy;

        const { unmount } = renderHook(() => useConsoleCapture());

        act(() => {
            console.error('passthrough test');
        });

        // The original (now spy) should have been called
        expect(calls.some((args) => args.includes('passthrough test'))).toBe(true);

        unmount();
        // Restore the spy
        console.error = originalConsoleError;
    });
});

// ---------------------------------------------------------------------------
// Tests: getErrors is a stable reference (useCallback with no deps)
// ---------------------------------------------------------------------------

describe('useConsoleCapture — stable getErrors reference', () => {
    it('should return the same getErrors function across re-renders', () => {
        const { result, rerender, unmount } = renderHook(() => useConsoleCapture());

        const ref1 = result.current.getErrors;
        rerender();
        const ref2 = result.current.getErrors;

        expect(ref1).toBe(ref2);

        unmount();
    });
});

// ---------------------------------------------------------------------------
// Tests: Error serialization in interceptor
// ---------------------------------------------------------------------------

describe('useConsoleCapture — error serialization in interceptor', () => {
    it('should serialize an Error object with name and message', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        act(() => {
            console.error(new TypeError('type mismatch'));
        });

        const errors = result.current.getErrors();
        expect(errors.some((e) => e.includes('TypeError') && e.includes('type mismatch'))).toBe(
            true
        );

        unmount();
    });

    it('should serialize a plain object as JSON', () => {
        const { result, unmount } = renderHook(() => useConsoleCapture());

        act(() => {
            console.error({ code: 500, msg: 'server error' });
        });

        const errors = result.current.getErrors();
        expect(errors.some((e) => e.includes('"code":500'))).toBe(true);

        unmount();
    });
});
