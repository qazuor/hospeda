/**
 * HOS-2518: two tabs retry the same expired one-time page purchase. Tab B collides with the old
 * purchase (23505 on `uq_addon_instance_purchase_identity`); before B re-reads who holds the
 * identity, tab A releases the old purchase and inserts its new one without committing. B's read
 * comes back empty. B must answer tab A's live purchase and its page link once A commits, never a
 * 500, and must answer a typed error when no purchase ever takes the identity.
 *
 * The order is forced, not left to timing: B's first read of the identity runs tab A up to its
 * uncommitted insert, and A commits only after B has seen the identity empty.
 */
import {
    addonInstances,
    and,
    domainEventModel,
    eq,
    type InsertDomainEventInput,
    ne
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { abandonOneTimeAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import { paymentPageCheckoutUrlOf } from '../../../src/services/billing/addon/one-time-payment-page';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import {
    PURCHASE_IDENTITY_BUSY_REASON,
    type PurchaseAddonResult
} from '../../../src/services/billing/addon/purchase-addon-types';
import type * as occupantModule from '../../../src/services/billing/addon/purchase-identity-occupant';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    pageInstance,
    pageSetup,
    retirePageMarks
} from './support/one-time-page-fixtures';

type Occupant = Awaited<ReturnType<typeof occupantModule.readIdentityOccupant>>['occupant'];

/** Hooks around every read of the identity a colliding request makes; null passes through. */
const reads: {
    before: (() => Promise<void>) | null;
    after: ((occupant: Occupant) => Promise<void>) | null;
} = { before: null, after: null };

vi.mock(
    '../../../src/services/billing/addon/purchase-identity-occupant',
    async (importOriginal) => {
        const original = await importOriginal<typeof occupantModule>();
        return {
            ...original,
            readIdentityOccupant: async (
                ...args: Parameters<typeof original.readIdentityOccupant>
            ) => {
                await reads.before?.();
                const read = await original.readIdentityOccupant(...args);
                await reads.after?.(read.occupant);
                return read;
            }
        };
    }
);

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    reads.before = null;
    reads.after = null;
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** A promise settled from outside, to hand control between the two tabs. */
function signal<T>() {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

async function expiredPurchase() {
    const s = await pageSetup();
    const bought = await boughtPage(s);
    if (!bought.instance.paymentPageExpiresAt) throw new Error('Page expiry missing');
    s.f.advanceTo(new Date(bought.instance.paymentPageExpiresAt.getTime() + 1));
    const retry = () => ({ ...s.request, orderRequestId: crypto.randomUUID() });
    return { s, ...bought, retry };
}

/** The purchases of the owner's identity that are not abandoned. */
async function liveInstances(s: Awaited<ReturnType<typeof pageSetup>>) {
    return getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(
            and(
                eq(addonInstances.ownerId, s.request.ownerId),
                eq(addonInstances.productId, s.request.productId),
                ne(addonInstances.status, 'ABANDONED')
            )
        );
}

describe('HOS-2518: a tab that loses the identity while the other tab replaces the purchase', () => {
    it.skipIf(skip)(
        "answers the other tab's live purchase and page once it commits, not a 500",
        async () => {
            const { s, instance, retry } = await expiredPurchase();
            const aInserted = signal<string>();
            const aMayCommit = signal<void>();
            let tabA: Promise<PurchaseAddonResult> | undefined;
            let emptyReads = 0;
            // Tab A pauses inside its insert transaction, after the new purchase row is written.
            const insertEvent = domainEventModel.insert.bind(domainEventModel);
            vi.spyOn(domainEventModel, 'insert').mockImplementation(
                async (event: InsertDomainEventInput) => {
                    const [change] = event.changes ?? [];
                    if (
                        event.entityType === 'addon_instance' &&
                        change?.old === null &&
                        change.new === 'PENDING_AUTHORIZATION'
                    ) {
                        aInserted.resolve(event.entityId);
                        await aMayCommit.promise;
                    }
                    return insertEvent(event);
                }
            );
            // B's first read happens after its 23505: tab A releases the old purchase and inserts
            // its new one, uncommitted, before B reads.
            reads.before = async () => {
                reads.before = null;
                tabA = purchaseAddon(retry(), s.f.ports);
                await aInserted.promise;
            };
            // Only B can read the identity empty (A read the old purchase). A commits after that.
            reads.after = async (occupant) => {
                if (occupant !== null) return;
                emptyReads += 1;
                aMayCommit.resolve();
            };

            const answerB = await purchaseAddon(retry(), s.f.ports);
            const answerA = await tabA;

            expect(emptyReads).toBeGreaterThan(0);
            expect((await pageInstance(instance.id)).status).toBe('ABANDONED');
            const live = await liveInstances(s);
            expect(live).toHaveLength(1);
            const liveId = await aInserted.promise;
            expect(live[0]?.id).toBe(liveId);
            const liveUrl = await paymentPageCheckoutUrlOf({ instanceId: liveId });
            expect(liveUrl).toMatch(/^https:\/\//);
            expect(answerA).toMatchObject({ outcome: 'CREATED', instanceId: liveId });
            expect(answerB).toMatchObject({
                outcome: 'EXISTING',
                instanceId: liveId,
                checkoutUrl: liveUrl
            });
        }
    );

    it.skipIf(skip)(
        'answers a typed SERVICE_UNAVAILABLE when no purchase takes the identity',
        async () => {
            const { s, instance, retry } = await expiredPurchase();
            // The old purchase is released after B collided with it, and nothing replaces it.
            reads.before = async () => {
                reads.before = null;
                await abandonOneTimeAddon({
                    instanceId: instance.id,
                    expectedProviderOrderId: null,
                    now: s.f.ports.clock.now()
                });
            };

            await expect(purchaseAddon(retry(), s.f.ports)).rejects.toMatchObject({
                code: ServiceErrorCode.SERVICE_UNAVAILABLE,
                reason: PURCHASE_IDENTITY_BUSY_REASON
            });

            expect(await liveInstances(s)).toHaveLength(0);
        }
    );
});
