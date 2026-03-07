/**
 * Tests for logger.ts - Frontend logger wrapper.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('webLogger', () => {
    beforeEach(() => {
        // Mock import.meta.env so the module can import without errors
        vi.stubGlobal('import.meta', {
            env: {
                DEV: true,
                VITE_ENABLE_LOGGING: undefined,
                PUBLIC_API_URL: undefined,
                HOSPEDA_API_URL: undefined,
                PROD: false
            }
        });
    });

    it('should export webLogger object', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(webLogger).toBeDefined();
        expect(typeof webLogger).toBe('object');
    });

    it('should expose a log method', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(typeof webLogger.log).toBe('function');
    });

    it('should expose an info method', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(typeof webLogger.info).toBe('function');
    });

    it('should expose a warn method', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(typeof webLogger.warn).toBe('function');
    });

    it('should expose an error method', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(typeof webLogger.error).toBe('function');
    });

    it('should expose a debug method', async () => {
        const { webLogger } = await import('@/lib/logger');
        expect(typeof webLogger.debug).toBe('function');
    });

    it('should call console.log when log() is invoked with DEV=true', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { webLogger } = await import('@/lib/logger');

        webLogger.log('test message');

        expect(consoleSpy).toHaveBeenCalled();
        const callArg = consoleSpy.mock.calls[0]?.[0];
        expect(callArg).toContain('[HOSPEDA-WEB]');
        expect(callArg).toContain('test message');
        consoleSpy.mockRestore();
    });

    it('should call console.warn when warn() is invoked', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { webLogger } = await import('@/lib/logger');

        webLogger.warn('something went wrong');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should call console.error when error() is invoked', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { webLogger } = await import('@/lib/logger');

        webLogger.error('fatal error');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should pass extra data argument to console when provided', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const { webLogger } = await import('@/lib/logger');
        const extraData = { userId: 'abc123' };

        webLogger.log('user action', extraData);

        // When data is provided, the third argument should be the data
        const calls = consoleSpy.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        expect(lastCall?.[2]).toEqual(extraData);
        consoleSpy.mockRestore();
    });
});
