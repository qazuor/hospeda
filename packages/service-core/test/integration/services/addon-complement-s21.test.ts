/**
 * TEST:B5:14 (migration from scratch), the case of AC:B5:28 (HOS-1545): S21 takes a live
 * COMPLEMENTO row whose instance reached `CANCELLED` to `CANCELLED` in the same act. It is the
 * «from scratch» test because it runs on the database that `global-setup.ts` drops, creates and
 * migrates with `drizzle-kit migrate` (plus the extras) before the suite: every column, CHECK and
 * index S21 relies on comes from the versioned migrations, never from a push. Each case runs in
 * a rolled-back transaction and asserts only on the rows it seeded, by id.
 */
import type { DrizzleClient } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import {
    applyS21,
    findComplementsAwaitingS21
} from '../../../src/services/billing/subscription/complement-s21';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    orphanNow as now,
    readDecisions,
    readMoneyTrail,
    readPauses,
    readSubscription,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner
} from './support/addon-orphan-fixtures';
import { seedCoveragePayment } from './support/coverage-fixtures';

afterAll(closeServiceTestPool);

const V = 'accommodation';
const serviceEndsAt = new Date('2026-11-01T00:00:00.000Z');

/** A complement in `status` with an instance in `instanceStatus` hanging from it. */
async function seedHangingInstance(
    tx: DrizzleClient,
    input: {
        readonly status: string;
        readonly instanceStatus?: string;
        readonly grace?: boolean;
        readonly openPause?: boolean;
        readonly serviceEndsAt?: Date | null;
    }
) {
    const { userId } = await seedOrphanOwner(tx);
    const complement = await seedComplement(tx, {
        userId,
        vertical: V,
        status: input.status,
        grace: input.grace,
        openPause: input.openPause,
        serviceEndsAt: input.serviceEndsAt ?? null
    });
    await seedCoveragePayment(tx, {
        subscriptionId: complement.subscriptionId,
        status: 'SUCCEEDED'
    });
    const { instanceId } = await seedOrphanInstance(tx, {
        ownerId: userId,
        scopeType: 'USER',
        compatibleVerticals: [V],
        status: input.instanceStatus ?? 'CANCELLED',
        complementSubscriptionId: complement.subscriptionId
    });
    return { instanceId, complementId: complement.subscriptionId };
}

const LIVE_ORIGINS = [
    { status: 'PENDING_AUTHORIZATION' },
    { status: 'ACTIVE' },
    { status: 'GRACE_PERIOD', grace: true },
    { status: 'PAUSED', openPause: true },
    { status: 'SUSPENDED' },
    { status: 'CANCEL_SCHEDULED', serviceEndsAt }
] as const;

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1545 TEST:B5:14 AC:B5:28 S21 cancels the complement of a CANCELLED instance in the same act',
    () => {
        it.each(
            LIVE_ORIGINS
        )('(a) from $status: CANCELLED, service_ends_at untouched, grace clock off, no refund, no mark, no provider decision', async (origin) => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const seeded = await seedHangingInstance(tx, origin);
                const before = await readSubscription(tx, seeded.complementId);

                // Act
                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });

                // Assert
                expect(result).toMatchObject({ outcome: 'CANCELLED', from: origin.status });
                expect(result).toHaveProperty('charge.kind', 'MARK_OPENED');
                const after = await readSubscription(tx, seeded.complementId);
                expect(after.status).toBe('CANCELLED');
                expect(after.serviceEndsAt).toEqual(before.serviceEndsAt);
                expect(after.graceStartedAt).toBeNull();
                expect(after.graceEndsAt).toBeNull();
                const trail = await readMoneyTrail(tx, seeded.complementId);
                expect(trail.refunds).toEqual([]);
                expect(trail.marks).toHaveLength(1);
                // S21 has no provider port and records no decision: nothing goes to the provider.
                expect(await readDecisions(tx, seeded.complementId)).toEqual([]);
            });
        });

        it('(b) PAUSED: the open pause gets actual_end_at = now', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, { status: 'PAUSED', openPause: true });

                await applyS21({ tx, complementSubscriptionId: seeded.complementId, now });

                expect(await readPauses(tx, seeded.complementId)).toEqual([{ actualEndAt: now }]);
                const trail = await readMoneyTrail(tx, seeded.complementId);
                expect(trail.marks).toHaveLength(1);
                expect(trail.refunds).toEqual([]);
            });
        });

        it('(c) idempotent: on a row already CANCELLED, ALREADY_CANCELLED and updated_at unchanged', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, { status: 'CANCELLED' });
                const before = await readSubscription(tx, seeded.complementId);

                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });

                expect(result).toEqual({ outcome: 'ALREADY_CANCELLED' });
                expect(await readSubscription(tx, seeded.complementId)).toEqual(before);
            });
        });

        it('(d) the instance is still ACTIVE: NOT_APPLICABLE, nothing written', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, {
                    status: 'ACTIVE',
                    instanceStatus: 'ACTIVE'
                });
                const before = await readSubscription(tx, seeded.complementId);

                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });

                expect(result).toEqual({ outcome: 'NOT_APPLICABLE' });
                expect(await readSubscription(tx, seeded.complementId)).toEqual(before);
                expect(await readMoneyTrail(tx, seeded.complementId)).toMatchObject({
                    marks: [],
                    refunds: []
                });
            });
        });

        it('(e) an instance seeded straight in CANCELLED (as A6 or the third clause leaves it): found by the re-evaluation and closed', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, { status: 'SUSPENDED' });

                const { subscriptionIds } = await findComplementsAwaitingS21({ tx, limit: 10_000 });
                expect(subscriptionIds).toContain(seeded.complementId);
                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });

                expect(result).toMatchObject({ outcome: 'CANCELLED', from: 'SUSPENDED' });
                expect((await readSubscription(tx, seeded.complementId)).status).toBe('CANCELLED');
            });
        });

        it('(f) the cut run: instance CANCELLED + complement ACTIVE is taken by the re-evaluation, and no longer returned after S21', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, { status: 'ACTIVE' });

                const pending = await findComplementsAwaitingS21({ tx, limit: 10_000 });
                expect(pending.subscriptionIds).toContain(seeded.complementId);
                await applyS21({ tx, complementSubscriptionId: seeded.complementId, now });
                const after = await findComplementsAwaitingS21({ tx, limit: 10_000 });

                expect(after.subscriptionIds).not.toContain(seeded.complementId);
            });
        });

        it('(g) a complement ABANDONED: NOT_APPLICABLE', async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedHangingInstance(tx, { status: 'ABANDONED' });
                const before = await readSubscription(tx, seeded.complementId);

                const result = await applyS21({
                    tx,
                    complementSubscriptionId: seeded.complementId,
                    now
                });

                expect(result).toEqual({ outcome: 'NOT_APPLICABLE' });
                expect(await readSubscription(tx, seeded.complementId)).toEqual(before);
            });
        });
    }
);
