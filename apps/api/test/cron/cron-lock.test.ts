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
            executionMode: 'manual',
            handler: async () => undefined
        });
        expect(client.query).toHaveBeenCalledWith(
            "SELECT set_config('application_name', $1, false)",
            [`hospeda-cron:loser@${Math.floor(startedAt.getTime() / 1000)}M`]
        );
        expect(decision).toEqual({
            acquired: false,
            holderRunId: 'holder-id',
            holderStartedAt: new Date(Math.floor(startedAt.getTime() / 1000) * 1000),
            holderExecutionMode: null
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
            holderStartedAt: null,
            holderExecutionMode: null
        });
    });

    it('keeps the application name within 63 characters and round-trips the execution mode', async () => {
        const startedAt = new Date('2026-11-03T12:34:56.789Z');
        for (const [executionMode, holderExecutionMode] of [
            ['scheduled', 'scheduled'],
            ['manual', 'manual']
        ] as const) {
            const names: string[] = [];
            const client = new EventEmitter() as EventEmitter & {
                query: ReturnType<typeof vi.fn>;
                release: ReturnType<typeof vi.fn>;
            };
            client.query = vi.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('set_config')) names.push(String(params?.[0]));
                if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: false }] };
                if (sql.includes('application_name'))
                    return { rows: [{ application_name: names[0] ?? '' }] };
                if (sql.includes('hashtext')) return { rows: [{ key: '1' }] };
                return { rows: [] };
            });
            client.release = vi.fn();
            poolState.pool = { connect: vi.fn(async () => client) };
            const decision = await withCronLock({
                name: 'mode-roundtrip',
                runId: crypto.randomUUID(),
                startedAt,
                executionMode,
                handler: async () => undefined
            });
            expect(names[0]?.length).toBeLessThanOrEqual(63);
            expect(decision).toMatchObject({ acquired: false, holderExecutionMode });
        }
    });
});
