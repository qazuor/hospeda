import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceLogger } from '../../utils';

describe('dbLogger', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('calls query without error', () => {
        expect(() =>
            serviceLogger.permission({ table: 't', action: 'a', params: {}, result: 1 })
        ).not.toThrow();
    });
    it('calls error without error', () => {
        expect(() => serviceLogger.error('err', 'ctx')).not.toThrow();
    });
    it('calls info without error', () => {
        expect(() => serviceLogger.info('info', 'ctx')).not.toThrow();
    });
    it('calls warn without error', () => {
        expect(() => serviceLogger.warn('warn', 'ctx')).not.toThrow();
    });
});
