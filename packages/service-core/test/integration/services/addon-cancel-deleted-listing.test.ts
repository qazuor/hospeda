/**
 * HOS-2128: cancelling the addons of a soft-deleted listing fails closed with a typed rejection
 * (same criterion as HOS-2069 for the grant revocation). The three sites: `runOrphanhood`,
 * `withdrawAddon` and the S12 service-end run (`endScheduledServices`). The production `ficha`
 * throws `ListingNotFoundError` for a deleted listing; the ports here do the same.
 */
import type { DrizzleClient } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { ADDON_LISTING_SOFT_DELETED } from '../../../src/services/billing/addon/addon-listing-soft-deleted';
import { withdrawAddon } from '../../../src/services/billing/addon/withdraw-addon.service';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import { ServiceError } from '../../../src/types';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    orphanNow,
    orphanPorts,
    readInstance,
    readSubscription,
    seedComplement,
    seedOrphanInstance,
    seedOrphanOwner,
    seedPrincipal
} from './support/addon-orphan-fixtures';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';
import {
    seedServiceEndComplement,
    seedServiceEndPrincipal,
    serviceEndHarness,
    serviceEndPast,
    serviceEndPorts
} from './support/service-end-fixtures';

afterEach(retireWithdrawalFixtures);
afterAll(closeServiceTestPool);

const V = VerticalEnum.ACCOMMODATION;

/** The `ficha` answer for a soft-deleted listing. */
async function deletedListing(): Promise<never> {
    const error = new Error('listing does not exist');
    error.name = 'ListingNotFoundError';
    throw error;
}

/** Runs `act` in a savepoint, so a throw undoes its writes the way the caller's tx would. */
async function inSavepoint(
    tx: DrizzleClient,
    act: (inner: DrizzleClient) => Promise<unknown>
): Promise<unknown> {
    try {
        await tx.transaction(async (inner) => act(inner as unknown as DrizzleClient));
    } catch (error) {
        return error;
    }
    throw new Error('Expected the act to be rejected');
}

function expectTypedRejection(error: unknown): void {
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({
        code: 'ALREADY_EXISTS',
        reason: ADDON_LISTING_SOFT_DELETED
    });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2128 cancelling addons of a soft-deleted listing fails closed',
    () => {
        it('runOrphanhood: a LISTING addon over a deleted listing is a typed rejection and nothing is cancelled', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const { userId } = await seedOrphanOwner(tx);
                const { subscriptionId } = await seedPrincipal(tx, {
                    userId,
                    vertical: V,
                    status: 'CANCELLED'
                });
                const { instanceId } = await seedOrphanInstance(tx, {
                    ownerId: userId,
                    scopeType: 'LISTING',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: crypto.randomUUID()
                });
                const ports = { ...orphanPorts(tx).ports, listing: deletedListing };

                // Act
                const error = await inSavepoint(tx, (inner) =>
                    runOrphanhood({ tx: inner, subscriptionId, now: orphanNow }, ports)
                );

                // Assert
                expectTypedRejection(error);
                expect((await readInstance(tx, instanceId)).status).toBe('ACTIVE');
            });
        });

        it('withdrawAddon: a deleted listing is a typed rejection; instance, complement and provider stay untouched', async () => {
            // Arrange
            const s = await withdrawalFixture({
                listing: { id: crypto.randomUUID(), vertical: V }
            });
            if (!s.complementId) throw new Error('Complement missing');
            const ports = {
                ...s.ports,
                orphanhood: { ...s.ports.orphanhood, listing: deletedListing }
            };

            // Act
            const error = await withdrawAddon(
                { actor: s.actor, instanceId: s.instanceId },
                ports
            ).catch((rejected: unknown) => rejected);

            // Assert
            expectTypedRejection(error);
            expect((await s.readInstance())?.status).toBe('ACTIVE');
            expect((await s.readComplement())?.status).not.toBe('CANCELLED');
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.coverage).not.toHaveBeenCalled();
        });

        it('S12 principals: the principal with a deleted-listing addon rolls back and fails; the next principal is still ended', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const failedOwner = (await seedOrphanOwner(tx)).userId;
                const failed = await seedServiceEndPrincipal(tx, {
                    userId: failedOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: new Date(serviceEndPast.getTime() - 86_400_000)
                });
                const deleted = await seedOrphanInstance(tx, {
                    ownerId: failedOwner,
                    scopeType: 'LISTING',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: crypto.randomUUID()
                });
                const okOwner = (await seedOrphanOwner(tx)).userId;
                const ok = await seedServiceEndPrincipal(tx, {
                    userId: okOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast
                });
                const { ports } = serviceEndPorts(tx, h);

                // Act
                const run = await endScheduledServices(
                    { limit: 100, db: tx },
                    { ...ports, listing: deletedListing }
                );

                // Assert
                expect(run.principals).toStrictEqual({ cancelled: 1, failed: 1 });
                const failedRow = run.rows.find((r) => r.subscriptionId === failed.subscriptionId);
                expect(failedRow?.outcome).toBe('FAILED');
                expect(failedRow?.error).toBe(
                    'An addon targets a deleted listing; nothing was cancelled'
                );
                expect((await readSubscription(tx, failed.subscriptionId)).status).toBe(
                    'CANCEL_SCHEDULED'
                );
                expect((await readInstance(tx, deleted.instanceId)).status).toBe('ACTIVE');
                expect((await readSubscription(tx, ok.subscriptionId)).status).toBe('CANCELLED');
            });
        });

        it('S12 complements: the complement whose addon targets a deleted listing rolls back and fails; the other is still ended', async () => {
            await withServiceTestTransaction(async (tx) => {
                // Arrange
                const h = serviceEndHarness();
                const failedOwner = (await seedOrphanOwner(tx)).userId;
                const failed = await seedServiceEndComplement(tx, {
                    userId: failedOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: new Date(serviceEndPast.getTime() - 86_400_000)
                });
                const deleted = await seedOrphanInstance(tx, {
                    ownerId: failedOwner,
                    scopeType: 'LISTING',
                    compatibleVerticals: [V],
                    status: 'ACTIVE',
                    targetId: crypto.randomUUID(),
                    complementSubscriptionId: failed.subscriptionId
                });
                const okOwner = (await seedOrphanOwner(tx)).userId;
                const ok = await seedComplement(tx, {
                    userId: okOwner,
                    vertical: V,
                    status: 'CANCEL_SCHEDULED',
                    serviceEndsAt: serviceEndPast,
                    withLink: false
                });
                const { ports } = serviceEndPorts(tx, h);

                // Act
                const run = await endScheduledServices(
                    { limit: 100, db: tx },
                    { ...ports, listing: deletedListing }
                );

                // Assert
                expect(run.complements).toStrictEqual({ cancelled: 1, failed: 1 });
                const failedRow = run.rows.find((r) => r.subscriptionId === failed.subscriptionId);
                expect(failedRow?.error).toBe(
                    'An addon targets a deleted listing; nothing was cancelled'
                );
                expect((await readSubscription(tx, failed.subscriptionId)).status).toBe(
                    'CANCEL_SCHEDULED'
                );
                expect((await readInstance(tx, deleted.instanceId)).status).toBe('ACTIVE');
                expect((await readSubscription(tx, ok.subscriptionId)).status).toBe('CANCELLED');
            });
        });
    }
);
