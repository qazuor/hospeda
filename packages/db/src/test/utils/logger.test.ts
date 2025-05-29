import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dbLogger } from '../../utils/logger';

describe('dbLogger', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('calls query without error', () => {
        expect(() =>
            dbLogger.query({ table: 't', action: 'a', params: {}, result: 1 })
        ).not.toThrow();
    });
    it('calls error without error', () => {
        expect(() => dbLogger.error('err', 'ctx')).not.toThrow();
    });
    it('calls info without error', () => {
        expect(() => dbLogger.info('info', 'ctx')).not.toThrow();
    });
    it('calls warn without error', () => {
        expect(() => dbLogger.warn('warn', 'ctx')).not.toThrow();
    });
});
