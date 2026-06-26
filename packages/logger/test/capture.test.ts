/**
 * Tests for the capture hook registry (SPEC-180 BETA-64).
 *
 * Covers:
 * - `registerCaptureHook` wiring: hook is called on `error + capture:true`
 * - Hook is NOT called without `capture:true`
 * - `warn` level does NOT invoke the hook (only ERROR)
 * - No crash when no hook is registered
 * - Hook is replaced when registered a second time
 * - `unregisterCaptureHook` clears the hook
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, {
    hasCaptureHook,
    registerCaptureHook,
    unregisterCaptureHook
} from '../src/index.js';
import { resetLogger } from '../src/logger.js';

describe('capture hook registry', () => {
    beforeEach(() => {
        resetLogger();
        unregisterCaptureHook();
        // Suppress console output during tests
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        unregisterCaptureHook();
        vi.restoreAllMocks();
    });

    describe('hasCaptureHook', () => {
        it('should return false when no hook is registered', () => {
            // Arrange / Act / Assert
            expect(hasCaptureHook()).toBe(false);
        });

        it('should return true after registering a hook', () => {
            // Arrange
            registerCaptureHook(vi.fn());

            // Act / Assert
            expect(hasCaptureHook()).toBe(true);
        });

        it('should return false after unregistering a hook', () => {
            // Arrange
            registerCaptureHook(vi.fn());
            unregisterCaptureHook();

            // Act / Assert
            expect(hasCaptureHook()).toBe(false);
        });
    });

    describe('registerCaptureHook — invocation on error + capture:true', () => {
        it('should invoke the hook when logger.error is called with capture:true', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);
            const err = new Error('something broke');

            // Act
            logger.error(err, 'startup failed', { capture: true });

            // Assert
            expect(hook).toHaveBeenCalledOnce();
            expect(hook).toHaveBeenCalledWith(err, expect.any(Object));
        });

        it('should pass label and data in the extra context', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);
            const payload = { detail: 'db down' };

            // Act
            logger.error(payload, 'db-init failed', { capture: true });

            // Assert
            expect(hook).toHaveBeenCalledOnce();
            const [, extra] = hook.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(extra.label).toBe('db-init failed');
            expect(extra.data).toEqual(payload);
        });

        it('should pass category in the extra context when provided', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);

            // Act
            logger.error('cron died', 'label', { capture: true, category: 'CRON' });

            // Assert
            const [, extra] = hook.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(extra.category).toBe('CRON');
        });
    });

    describe('registerCaptureHook — NOT invoked without capture:true', () => {
        it('should NOT invoke the hook when capture is false', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);

            // Act
            logger.error(new Error('expected'), 'label', { capture: false });

            // Assert
            expect(hook).not.toHaveBeenCalled();
        });

        it('should NOT invoke the hook when capture is omitted', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);

            // Act
            logger.error('some error', 'label');

            // Assert
            expect(hook).not.toHaveBeenCalled();
        });
    });

    describe('warn level does NOT trigger the hook', () => {
        it('should NOT invoke the hook for warn even with capture:true', () => {
            // Arrange
            const hook = vi.fn();
            registerCaptureHook(hook);

            // Act — warn with capture:true should be silently ignored
            logger.warn('something suspicious', 'label', { capture: true });

            // Assert
            expect(hook).not.toHaveBeenCalled();
        });
    });

    describe('no hook registered', () => {
        it('should not throw when error is called with capture:true but no hook registered', () => {
            // Arrange — no hook registered
            expect(hasCaptureHook()).toBe(false);

            // Act / Assert
            expect(() =>
                logger.error(new Error('boom'), 'startup', { capture: true })
            ).not.toThrow();
        });
    });

    describe('hook replacement', () => {
        it('should replace the hook when registerCaptureHook is called a second time', () => {
            // Arrange
            const first = vi.fn();
            const second = vi.fn();
            registerCaptureHook(first);
            registerCaptureHook(second);

            // Act
            logger.error(new Error('test'), 'label', { capture: true });

            // Assert
            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledOnce();
        });
    });

    describe('hook error isolation', () => {
        it('should swallow a synchronous hook error and not propagate to the caller', () => {
            // Arrange
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            registerCaptureHook(() => {
                throw new Error('hook exploded');
            });

            // Act / Assert
            expect(() =>
                logger.error(new Error('original'), 'label', { capture: true })
            ).not.toThrow();
            expect(stderr).toHaveBeenCalled();
        });
    });
});
