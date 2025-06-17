import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

import { logger } from '@repo/logger';
import { logAction, logError, logQuery } from '../../src/utils/logger';

describe('logger helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logQuery calls logger.info with correct args', () => {
        logQuery('User', 'find', { id: 1 }, { result: 'ok' });
        expect(logger.info).toHaveBeenCalledWith(
            { table: 'User', action: 'find', params: { id: 1 }, result: { result: 'ok' } },
            '[DB] User.find OK'
        );
    });

    it('logAction calls logger.info with correct args', () => {
        logAction('User', 'create', { name: 'foo' });
        expect(logger.info).toHaveBeenCalledWith(
            { table: 'User', action: 'create', params: { name: 'foo' } },
            '[DB] User.create'
        );
    });

    it('logError calls logger.error with correct args', () => {
        const error = new Error('fail');
        logError('User', 'delete', { id: 2 }, error);
        expect(logger.error).toHaveBeenCalledWith(
            {
                table: 'User',
                action: 'delete',
                params: { id: 2 },
                error: 'fail',
                stack: error.stack
            },
            '[DB] User.delete ERROR'
        );
    });

    it('handles empty table and action', () => {
        logQuery('', '', undefined, undefined);
        expect(logger.info).toHaveBeenCalledWith(
            { table: '', action: '', params: undefined, result: undefined },
            '[DB] . OK'
        );
        logAction('', '', undefined);
        expect(logger.info).toHaveBeenCalledWith(
            { table: '', action: '', params: undefined },
            '[DB] .'
        );
    });

    it('handles error without stack', () => {
        const error = { message: 'fail' } as Error;
        logError('T', 'A', undefined, error);
        expect(logger.error).toHaveBeenCalledWith(
            { table: 'T', action: 'A', params: undefined, error: 'fail', stack: undefined },
            '[DB] T.A ERROR'
        );
    });
});
