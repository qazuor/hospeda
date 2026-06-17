/**
 * @file logger.test.ts
 * @description Unit tests for the mobile logging seam.
 *
 * Verifies that the logger forwards calls to the native console methods
 * without throwing, satisfying the RN-safe wrapper contract.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let debugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('forwards warn(...args) to console.warn without throwing', () => {
        expect(() => logger.warn('[test]', 'warning message')).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith('[test]', 'warning message');
    });

    it('forwards info(...args) to console.info without throwing', () => {
        expect(() => logger.info('[test]', 'info message')).not.toThrow();
        expect(infoSpy).toHaveBeenCalledWith('[test]', 'info message');
    });

    it('forwards error(...args) to console.error without throwing', () => {
        const err = new Error('boom');
        expect(() => logger.error('[test]', err)).not.toThrow();
        expect(errorSpy).toHaveBeenCalledWith('[test]', err);
    });

    it('forwards debug(...args) to console.debug without throwing', () => {
        expect(() => logger.debug('[test]', { key: 'value' })).not.toThrow();
        expect(debugSpy).toHaveBeenCalledWith('[test]', { key: 'value' });
    });

    it('handles zero args without throwing', () => {
        expect(() => logger.warn()).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith();
    });

    it('handles multiple args without throwing', () => {
        expect(() => logger.warn('a', 'b', 'c', 'd')).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith('a', 'b', 'c', 'd');
    });
});
