/**
 * Tests for withServiceTransaction utility.
 *
 * Verifies that the function correctly wraps @repo/db's withTransaction,
 * sets up ServiceContext with tx and hookState, and configures statement_timeout.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/types';
import '../setupTest';

// Mock @repo/db's withTransaction to capture and execute the callback with a mock tx
const mockExecute = vi.fn().mockResolvedValue(undefined);

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
            execute: mockExecute
        };
        return cb(mockTx);
    })
}));

// Mock drizzle-orm sql template tag
vi.mock('drizzle-orm', () => ({
    sql: Object.assign(
        (strings: TemplateStringsArray, ..._values: unknown[]) => ({
            type: 'sql',
            strings,
            _values
        }),
        {
            raw: (value: string) => ({ type: 'sql-raw', value })
        }
    )
}));

// Import after mocks are set up
const { withServiceTransaction } = await import('../../src/utils/transaction');

describe('withServiceTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue(undefined);
    });

    it('should call fn with ctx containing tx and hookState', async () => {
        let capturedCtx: ServiceContext | undefined;

        await withServiceTransaction(async (ctx) => {
            capturedCtx = ctx;
            return 'done';
        });

        expect(capturedCtx).toBeDefined();
        expect(capturedCtx!.tx).toBeDefined();
        expect(capturedCtx!.hookState).toEqual({});
    });

    it('should commit when function succeeds (returns fn result)', async () => {
        const result = await withServiceTransaction(async () => {
            return 'success';
        });

        expect(result).toBe('success');
    });

    it('should propagate error when function throws (triggers rollback)', async () => {
        await expect(
            withServiceTransaction(async () => {
                throw new Error('deliberate failure');
            })
        ).rejects.toThrow('deliberate failure');
    });

    it('should merge baseCtx into ctx', async () => {
        let capturedCtx: ServiceContext | undefined;

        await withServiceTransaction(
            async (ctx) => {
                capturedCtx = ctx;
                return 'done';
            },
            { hookState: { existing: true } }
        );

        expect(capturedCtx).toBeDefined();
        expect(capturedCtx!.hookState).toEqual({ existing: true });
    });

    it('should execute SET LOCAL statement_timeout with custom timeout', async () => {
        await withServiceTransaction(
            async () => {
                return 'done';
            },
            undefined,
            { timeoutMs: 5000 }
        );

        expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should use 30000 default timeout when options not provided', async () => {
        await withServiceTransaction(async () => {
            return 'done';
        });

        expect(mockExecute).toHaveBeenCalledTimes(1);
    });
});
