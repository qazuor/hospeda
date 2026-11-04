import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolState = vi.hoisted(() => ({ pool: undefined as unknown }));
vi.mock('@repo/db', () => ({ getDb: () => ({ $client: poolState.pool }) }));
vi.mock('../../src/utils/logger', () => ({ apiLogger: { warn: vi.fn() } }));

import { withCronLock } from '../../src/cron/cron-lock';

describe('withCronLock client errors', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lets a running handler finish and destroys a client that emitted an error', async () => {
        const client = new EventEmitter() as EventEmitter & {
            query: ReturnType<typeof vi.fn>;
            release: ReturnType<typeof vi.fn>;
        };
        client.query = vi.fn(async (sql: string) => ({
            rows: sql.includes('pg_try_advisory_lock') ? [{ acquired: true }] : []
        }));
        client.release = vi.fn();
        poolState.pool = { connect: vi.fn(async () => client) };

        let finishHandler!: (value: string) => void;
        const handler = new Promise<string>((resolve) => {
            finishHandler = resolve;
        });
        const decision = await withCronLock({
            name: 'emits-error',
            runId: 'run-1',
            handler: () => handler
        });
        expect(decision.acquired).toBe(true);
        if (!decision.acquired) throw new Error('expected lock acquisition');

        expect(() => client.emit('error', new Error('connection dropped'))).not.toThrow();
        finishHandler('completed');
        await expect(decision.completion).resolves.toBe('completed');
        expect(client.release).toHaveBeenCalledWith(true);
    });

    it('encodes and parses a holder start time while accepting legacy names', async () => {
        const client = new EventEmitter() as EventEmitter & {
            query: ReturnType<typeof vi.fn>;
            release: ReturnType<typeof vi.fn>;
        };
        const startedAt = new Date('2026-11-03T12:34:56.789Z');
        client.query = vi.fn(async (sql: string) => {
            if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: false }] };
            if (sql.includes('application_name'))
                return {
                    rows: [
                        {
                            application_name: `hospeda-cron:holder-id@${Math.floor(startedAt.getTime() / 1000)}`
                        }
                    ]
                };
            if (sql.includes('hashtext')) return { rows: [{ key: '1' }] };
            return { rows: [] };
        });
        client.release = vi.fn();
        poolState.pool = { connect: vi.fn(async () => client) };
        const decision = await withCronLock({
            name: 'contended',
            runId: 'loser',
            startedAt,
            handler: async () => undefined
        });
        expect(client.query).toHaveBeenCalledWith(
            "SELECT set_config('application_name', $1, false)",
            [`hospeda-cron:loser@${Math.floor(startedAt.getTime() / 1000)}`]
        );
        expect(decision).toEqual({
            acquired: false,
            holderRunId: 'holder-id',
            holderStartedAt: new Date(Math.floor(startedAt.getTime() / 1000) * 1000)
        });

        client.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: false }] };
            if (sql.includes('application_name'))
                return { rows: [{ application_name: 'hospeda-cron:legacy-id' }] };
            if (sql.includes('hashtext')) return { rows: [{ key: '1' }] };
            return { rows: [] };
        });
        const legacy = await withCronLock({
            name: 'legacy',
            runId: 'loser',
            handler: async () => undefined
        });
        expect(legacy).toEqual({
            acquired: false,
            holderRunId: 'legacy-id',
            holderStartedAt: null
        });
    });
});
