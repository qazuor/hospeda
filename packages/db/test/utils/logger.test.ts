import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mod from '../../src/utils/logger';

let logAction: (table: string, action: string, params: unknown) => void;
let logError: (table: string, action: string, params: unknown, error: Error) => void;
let logQuery: (table: string, action: string, params: unknown, result: unknown) => void;
let summarizeResult: (result: unknown) => Record<string, unknown> | null;
let dbLogger: {
    info: (v: unknown, l?: string) => void;
    debug: (v: unknown, l?: string) => void;
    error: (v: unknown, l?: string) => void;
    configure?: (c: unknown) => void;
};

let infoSpy: ReturnType<typeof vi.spyOn>;
let debugSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
    // grab SUT and the exact logger instance it uses
    logAction = mod.logAction;
    logError = mod.logError;
    logQuery = mod.logQuery;
    summarizeResult = mod.summarizeResult;
    dbLogger = mod.dbLogger as unknown as typeof dbLogger;

    // Successful DB traces are DEBUG now — make sure DEBUG is not suppressed.
    if (typeof dbLogger.configure === 'function') {
        dbLogger.configure({ LEVEL: 'DEBUG' });
    }

    // Create spies on the concrete instance used by SUT
    infoSpy = vi.spyOn(dbLogger as unknown as { info: (v: unknown, l?: string) => void }, 'info');
    debugSpy = vi.spyOn(
        dbLogger as unknown as { debug: (v: unknown, l?: string) => void },
        'debug'
    );
    errorSpy = vi.spyOn(
        dbLogger as unknown as { error: (v: unknown, l?: string) => void },
        'error'
    );
});

describe('logger helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('logQuery logs a summarized result at DEBUG (never the raw payload)', () => {
        logQuery('User', 'find', { id: 1 }, { id: 'u1', name: 'foo' });

        expect(debugSpy).toHaveBeenCalledWith(
            { table: 'User', action: 'find', params: { id: 1 }, result: { id: 'u1' } },
            'User.find OK'
        );
        // Must NOT log at INFO anymore, and must NOT carry the full row.
        expect(infoSpy).not.toHaveBeenCalled();
    });

    it('logQuery summarizes an array result to a row count', () => {
        logQuery('User', 'findAll', {}, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

        expect(debugSpy).toHaveBeenCalledWith(
            { table: 'User', action: 'findAll', params: {}, result: { rowCount: 3 } },
            'User.findAll OK'
        );
    });

    it('logAction calls logger.debug with correct args', () => {
        logAction('User', 'create', { name: 'foo' });

        expect(debugSpy).toHaveBeenCalledWith(
            { table: 'User', action: 'create', params: { name: 'foo' } },
            'User.create'
        );
        expect(infoSpy).not.toHaveBeenCalled();
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
            'User.delete ERROR'
        );
    });

    it('handles empty table and action', () => {
        logQuery('', '', undefined, undefined);
        expect(debugSpy).toHaveBeenCalledWith(
            { table: '', action: '', params: undefined, result: null },
            '. OK'
        );
        logAction('', '', undefined);
        expect(debugSpy).toHaveBeenCalledWith({ table: '', action: '', params: undefined }, '.');
    });

    it('handles error without stack', () => {
        const error = { message: 'fail' } as Error;
        logError('T', 'A', undefined, error);
        expect(errorSpy).toHaveBeenCalledWith(
            { table: 'T', action: 'A', params: undefined, error: 'fail', stack: undefined },
            'T.A ERROR'
        );
    });
});

describe('summarizeResult', () => {
    it('returns null for null/undefined', () => {
        expect(summarizeResult(null)).toBeNull();
        expect(summarizeResult(undefined)).toBeNull();
    });

    it('summarizes an array to its row count', () => {
        expect(summarizeResult([{ id: 1 }, { id: 2 }])).toEqual({ rowCount: 2 });
    });

    it('surfaces the value of a single count row', () => {
        expect(summarizeResult([{ count: 42 }])).toEqual({ count: 42 });
    });

    it('summarizes a paginated result to itemCount + total', () => {
        const big = Array.from({ length: 10 }, (_, i) => ({ id: i, huge: 'x'.repeat(5000) }));
        expect(summarizeResult({ items: big, total: 123 })).toEqual({
            itemCount: 10,
            total: 123
        });
    });

    it('summarizes a single entity to just its id', () => {
        expect(
            summarizeResult({ id: 'abc', name: 'Hotel', description: 'x'.repeat(9999) })
        ).toEqual({ id: 'abc' });
    });

    it('never leaks nested payload for a single entity', () => {
        const summary = summarizeResult({ id: 'abc', nested: { secret: 'value' } });
        expect(summary).not.toHaveProperty('nested');
    });

    it('falls back to a row marker for an object without id or items', () => {
        expect(summarizeResult({ foo: 'bar' })).toEqual({ rows: 1 });
    });

    it('wraps a primitive result', () => {
        expect(summarizeResult(true)).toEqual({ value: true });
    });
});
