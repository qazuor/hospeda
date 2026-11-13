import { eq, sql, subscriptionPauses } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { extractPostgresErrorCause } from '../../../src/utils/postgres-error-cause.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { complementNow, providerHarness } from './support/complement-fixtures.js';
import { retirePauseRows, seedPausePrincipal } from './support/pause-fixtures.js';

afterEach(retirePauseRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:2 subscription pause reason constraint',
    () => {
        it('rejects a missing reason with NOT NULL', async () => {
            const principal = await seedPausePrincipal({ harness: providerHarness() });
            let failure: unknown;
            try {
                await getServiceTestDb().execute(sql`INSERT INTO subscription_pause
                (subscription_id, starts_at) VALUES (${principal.subscriptionId}, ${complementNow})`);
            } catch (error) {
                failure = error;
            }
            expect(extractPostgresErrorCause(failure)?.code).toBe('23502');
        });

        it('rejects an out-of-domain reason with the named CHECK', async () => {
            const principal = await seedPausePrincipal({ harness: providerHarness() });
            let failure: unknown;
            try {
                await getServiceTestDb().insert(subscriptionPauses).values({
                    subscriptionId: principal.subscriptionId,
                    reason: 'GIFT',
                    startsAt: complementNow
                });
            } catch (error) {
                failure = error;
            }
            expect(extractPostgresErrorCause(failure)).toMatchObject({
                code: '23514',
                constraint: 'ck_subscription_pause_reason'
            });
        });

        it('accepts CUSTOMER_REQUEST and COURTESY', async () => {
            const principal = await seedPausePrincipal({ harness: providerHarness() });
            await getServiceTestDb()
                .insert(subscriptionPauses)
                .values([
                    {
                        subscriptionId: principal.subscriptionId,
                        reason: 'CUSTOMER_REQUEST',
                        startsAt: new Date('2026-09-01T12:00:00.000Z'),
                        actualEndAt: new Date('2026-09-02T12:00:00.000Z')
                    },
                    {
                        subscriptionId: principal.subscriptionId,
                        reason: 'COURTESY',
                        startsAt: complementNow,
                        expectedEndAt: new Date('2026-11-14T12:00:00.000Z')
                    }
                ]);
            const pauses = await getServiceTestDb()
                .select({ reason: subscriptionPauses.reason })
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId));
            expect(pauses).toHaveLength(2);
            expect(pauses.map((pause) => pause.reason).sort()).toEqual([
                'COURTESY',
                'CUSTOMER_REQUEST'
            ]);
        });
    }
);
