import { eq, permanentGrants } from '@repo/db';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createRevokeScenario,
    retireRevokeScenarios,
    revokeNow
} from './support/permanent-grant-revoke-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireRevokeScenarios);

async function waitForBlockedBackend(pid: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const { rows } = await getServiceTestPool().query<{ wait_event_type: string | null }>(
            'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1 AND datname = current_database()',
            [pid]
        );
        if (rows[0]?.wait_event_type === 'Lock') return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Revocation backend ${pid} did not block on the grant row`);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:7 — concurrent revocations serialize on the grant row',
    () => {
        it('one commits while the second waits on a real PostgreSQL lock, then rejects non-live', async () => {
            const s = await createRevokeScenario({});
            if (!s.addon) throw new Error('fixture missing addon');
            s.emitCoverageChanged.mockClear();
            let entered!: () => void;
            const held = new Promise<void>((resolve) => {
                entered = resolve;
            });
            let release!: () => void;
            const gate = new Promise<void>((resolve) => {
                release = resolve;
            });
            const firstPorts = {
                ...s.ports,
                orphanhood: {
                    ...s.ports.orphanhood,
                    addonPolicy: async (input: { readonly addonVersionId: string }) => {
                        entered();
                        await gate;
                        return s.ports.orphanhood.addonPolicy(input);
                    }
                }
            };
            const first = revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'winner',
                    actor: grantSignerActor(s.otherId)
                },
                firstPorts
            );
            await held;
            const pool = getServiceTestPool();
            let backendPid: number | undefined;
            const onAcquire = (client: PoolClient) => {
                backendPid ??= (client as PoolClient & { readonly processID?: number }).processID;
            };
            pool.on('acquire', onAcquire);
            const second = revokePermanentGrant(
                {
                    permanentGrantId: s.grant.permanentGrantId,
                    reason: 'loser',
                    actor: grantSignerActor(s.adminId)
                },
                s.ports
            ).then(
                () => undefined,
                (error: unknown) => error
            );
            try {
                const deadline = Date.now() + 5000;
                while (backendPid === undefined && Date.now() < deadline)
                    await new Promise((resolve) => setTimeout(resolve, 10));
                if (backendPid === undefined)
                    throw new Error('Second revocation never acquired a DB connection');
                pool.off('acquire', onAcquire);
                await waitForBlockedBackend(backendPid);
            } finally {
                pool.off('acquire', onAcquire);
                release();
            }
            const winner = await first;
            expect(winner.revokedAt).toEqual(revokeNow);
            await expect(second).resolves.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_LIVE' });
            const [row] = await getServiceTestDb()
                .select({
                    revokedAt: permanentGrants.revokedAt,
                    revokedBy: permanentGrants.revokedBy,
                    revocationReason: permanentGrants.revocationReason
                })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, s.grant.permanentGrantId));
            expect(row).toEqual({
                revokedAt: revokeNow,
                revokedBy: s.otherId,
                revocationReason: 'winner'
            });
            expect(
                s.emitCoverageChanged.mock.calls.filter(
                    ([event]) =>
                        event.userId === s.userId &&
                        event.sourceType === 'GRANT' &&
                        event.change === 'REMOVED'
                )
            ).toHaveLength(1);
        });
    }
);
