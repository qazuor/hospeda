import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let logAction: (table: string, action: string, params: unknown) => void;
let logError: (table: string, action: string, params: unknown, error: Error) => void;
let logQuery: (table: string, action: string, params: unknown, result: unknown) => void;
let dbLogger: {
    info: (v: unknown, l?: string) => void;
    error: (v: unknown, l?: string) => void;
    configure?: (c: unknown) => void;
};

let infoSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
    const mod = await import('../../src/utils/logger');
    // grab SUT and the exact logger instance it uses
    logAction = mod.logAction;
    logError = mod.logError;
    logQuery = mod.logQuery;
    dbLogger = mod.dbLogger;

    // Ensure info logs are not suppressed if configure exists
    if (typeof dbLogger.configure === 'function') {
        dbLogger.configure({ LEVEL: 'LOG' });
    }

    // Create spies on the concrete instance used by SUT
    infoSpy = vi.spyOn(dbLogger as unknown as { info: (v: unknown, l?: string) => void }, 'info');
    errorSpy = vi.spyOn(
        dbLogger as unknown as { error: (v: unknown, l?: string) => void },
        'error'
    );
});

describe('logger helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logQuery calls logger.info with correct args', () => {
        logQuery('User', 'find', { id: 1 }, { result: 'ok' });
        expect(infoSpy).toHaveBeenCalledWith(
            { table: 'User', action: 'find', params: { id: 1 }, result: { result: 'ok' } },
            '[DB] User.find OK'
        );
    });

    it('logAction calls logger.info with correct args', () => {
        logAction('User', 'create', { name: 'foo' });
        expect(infoSpy).toHaveBeenCalledWith(
            { table: 'User', action: 'create', params: { name: 'foo' } },
            '[DB] User.create'
        );
    });

    it('logError calls logger.error with correct args', () => {
        const error = new Error('fail');
        logError('User', 'delete', { id: 2 }, error);
        expect(errorSpy).toHaveBeenCalledWith(
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
        expect(infoSpy).toHaveBeenCalledWith(
            { table: '', action: '', params: undefined, result: undefined },
            '[DB] . OK'
        );
        logAction('', '', undefined);
        expect(infoSpy).toHaveBeenCalledWith(
            { table: '', action: '', params: undefined },
            '[DB] .'
        );
    });

    it('handles error without stack', () => {
        const error = { message: 'fail' } as Error;
        logError('T', 'A', undefined, error);
        expect(errorSpy).toHaveBeenCalledWith(
            { table: 'T', action: 'A', params: undefined, error: 'fail', stack: undefined },
            '[DB] T.A ERROR'
        );
    });
});
