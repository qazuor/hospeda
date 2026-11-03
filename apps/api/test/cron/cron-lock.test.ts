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
});
