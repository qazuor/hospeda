import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger, {
    type LogEntry,
    LogLevel,
    clearHooks,
    configureLogger,
    dispatchHooks,
    hasHooks,
    registerHook,
    unregisterHook
} from '../src/index.js';
import { resetLogger } from '../src/logger.js';

const sampleEntry: LogEntry = {
    ts: '2026-06-03T00:00:00.000Z',
    level: 'WARN',
    message: 'test'
};

describe('hooks registry', () => {
    beforeEach(() => {
        clearHooks();
    });

    afterEach(() => {
        clearHooks();
        vi.restoreAllMocks();
    });

    describe('registerHook / dispatchHooks', () => {
        it('should invoke a registered hook with the entry', () => {
            const fn = vi.fn();
            registerHook('a', fn);

            dispatchHooks(sampleEntry);

            expect(fn).toHaveBeenCalledWith(sampleEntry);
        });

        it('should invoke every registered hook', () => {
            const a = vi.fn();
            const b = vi.fn();
            registerHook('a', a);
            registerHook('b', b);

            dispatchHooks(sampleEntry);

            expect(a).toHaveBeenCalledOnce();
            expect(b).toHaveBeenCalledOnce();
        });

        it('should replace a hook registered under the same name', () => {
            const first = vi.fn();
            const second = vi.fn();
            registerHook('dup', first);
            registerHook('dup', second);

            dispatchHooks(sampleEntry);

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledOnce();
        });
    });

    describe('unregisterHook / clearHooks / hasHooks', () => {
        it('should reflect registration state via hasHooks', () => {
            expect(hasHooks()).toBe(false);
            registerHook('a', vi.fn());
            expect(hasHooks()).toBe(true);
        });

        it('should remove a single hook via unregisterHook', () => {
            const a = vi.fn();
            registerHook('a', a);
            unregisterHook('a');

            dispatchHooks(sampleEntry);

            expect(a).not.toHaveBeenCalled();
            expect(hasHooks()).toBe(false);
        });

        it('should be a no-op when unregistering an unknown name', () => {
            expect(() => unregisterHook('nope')).not.toThrow();
        });

        it('should remove all hooks via clearHooks', () => {
            registerHook('a', vi.fn());
            registerHook('b', vi.fn());

            clearHooks();

            expect(hasHooks()).toBe(false);
        });
    });

    describe('error isolation', () => {
        it('should swallow a synchronous hook error and still call other hooks', () => {
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            const boom = vi.fn(() => {
                throw new Error('boom');
            });
            const ok = vi.fn();
            registerHook('boom', boom);
            registerHook('ok', ok);

            expect(() => dispatchHooks(sampleEntry)).not.toThrow();
            expect(ok).toHaveBeenCalledOnce();
            expect(stderr).toHaveBeenCalled();
        });

        it('should swallow an async hook rejection', async () => {
            const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            registerHook('async-boom', () => Promise.reject(new Error('async boom')));

            expect(() => dispatchHooks(sampleEntry)).not.toThrow();

            // Flush the rejection-handling microtask.
            await Promise.resolve();
            await Promise.resolve();
            expect(stderr).toHaveBeenCalled();
        });
    });

    describe('integration: logWithLevel dispatches to hooks', () => {
        beforeEach(() => {
            resetLogger();
            clearHooks();
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.spyOn(console, 'info').mockImplementation(() => {});
        });

        it('should dispatch a redacted LogEntry when a hook is registered', () => {
            const fn = vi.fn();
            registerHook('sink', fn);

            logger.warn({ password: 'x', id: 1 }, 'label');

            expect(fn).toHaveBeenCalledOnce();
            const entry = fn.mock.calls[0]?.[0] as LogEntry;
            expect(entry.level).toBe(LogLevel.WARN);
            expect(entry.data).toEqual({ password: '[REDACTED]', id: 1 });
            expect(entry.label).toBe('label');
        });

        it('should not dispatch when the level is filtered out', () => {
            configureLogger({ LEVEL: LogLevel.ERROR });
            const fn = vi.fn();
            registerHook('sink', fn);

            logger.info('filtered');

            expect(fn).not.toHaveBeenCalled();
        });
    });
});
