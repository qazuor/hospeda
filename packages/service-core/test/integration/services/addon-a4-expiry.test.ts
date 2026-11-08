import { addonInstances, domainEventModel, eq } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimeOrder } from '../../../src/services/billing/addon/addon-instance-a2-one-time';
import { expireAddonInstances } from '../../../src/services/billing/addon/expire-addon-instances.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof purchaseFixture>>;
const oneSecond = 1_000;

async function active(f: Fixture, listingId: string) {
    const input = f.input(crypto.randomUUID(), listingId);
    const bought = await purchaseAddon(input, f.ports);
    if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
    const sent = await sendOneTimeOrder(
        {
            orderRequestId: input.orderRequestId,
            payerEmail: 'payer@example.test',
            payment: { token: `card-${crypto.randomUUID()}`, brand: 'visa', kind: 'credit' }
        },
        f.ports
    );
    if (sent.outcome !== 'ORDER_PLACED') throw new Error(`Order returned ${sent.outcome}`);
    const confirmed = await confirmOneTimeOrder({ instanceId: bought.instanceId }, f.ports);
    if (confirmed.outcome !== 'ACTIVATED') throw new Error(`Confirm returned ${confirmed.outcome}`);
    const [instance] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, bought.instanceId));
    if (!instance?.endsAt) throw new Error('Active instance has no end');
    return instance;
}

function listing(f: Fixture, id: string, acceptsFeature: boolean) {
    // The listing contract response is seeded in its simulator, not in a listing table.
    f.setListing(id, {
        vertical: VerticalEnum.ACCOMMODATION,
        ownerId: f.ownerId,
        acceptsFeature
    });
}

async function status(id: string) {
    const [row] = await getServiceTestDb()
        .select({ status: addonInstances.status })
        .from(addonInstances)
        .where(eq(addonInstances.id, id));
    return row?.status;
}

function noticeSpy() {
    return { emitCoverageChanged: vi.fn(async () => undefined) };
}

describe('TEST:B10:6 AC:B10:5 A4 fixed-days expiry', () => {
    it.skipIf(!isServiceTestDbAvailable()).each([false, true])(
        'expires at the end with listing acceptsFeature=%s',
        async (published) => {
            const f = await purchaseFixture({ scopeType: 'LISTING' });
            await payingPrincipal(f);
            const id = crypto.randomUUID();
            listing(f, id, true);
            const instance = await active(f, id);
            listing(f, id, published);
            f.advanceTo(instance.endsAt!);
            const coverageNotices = noticeSpy();
            const summary = await expireAddonInstances(100, {
                clock: f.ports.clock,
                listing: f.ports.listing,
                coverageNotices
            });
            expect(summary).toMatchObject({ expired: 1, failed: 0 });
            expect(await status(instance.id)).toBe('EXPIRED');
            const events = await domainEventModel.findByEntity({
                entityType: 'addon_instance',
                entityId: instance.id
            });
            expect(
                events.filter(
                    (event) =>
                        event.eventType === 'addon_instance.status_changed' &&
                        event.changes?.some(
                            (change) => change.field === 'status' && change.new === 'EXPIRED'
                        )
                )
            ).toHaveLength(1);
            expect(coverageNotices.emitCoverageChanged).toHaveBeenCalledExactlyOnceWith({
                userId: f.ownerId,
                vertical: VerticalEnum.ACCOMMODATION,
                sourceType: 'ADDON',
                change: 'REMOVED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('does not expire one second early', async () => {
        const f = await purchaseFixture({ scopeType: 'LISTING' });
        await payingPrincipal(f);
        const id = crypto.randomUUID();
        listing(f, id, true);
        const instance = await active(f, id);
        f.advanceTo(new Date(instance.endsAt!.getTime() - oneSecond));
        const coverageNotices = noticeSpy();
        expect(
            await expireAddonInstances(100, {
                clock: f.ports.clock,
                listing: f.ports.listing,
                coverageNotices
            })
        ).toMatchObject({ expired: 0 });
        expect(await status(instance.id)).toBe('ACTIVE');
        expect(coverageNotices.emitCoverageChanged).toHaveBeenCalledTimes(0);
    });

    it.skipIf(!isServiceTestDbAvailable())(
        'leaves an alive-subscription instance alone',
        async () => {
            const f = await purchaseFixture({ scopeType: 'LISTING', chargeKind: 'PERIODICO' });
            await payingPrincipal(f);
            const id = crypto.randomUUID();
            listing(f, id, true);
            const bought = await purchaseAddon(f.input(crypto.randomUUID(), id), f.ports);
            expect(bought.outcome).toBe('CREATED');
            // The recurring ACTIVE row is seeded to isolate the null ends_at clock predicate.
            if (bought.outcome !== 'CREATED') throw new Error('Purchase missing');
            await getServiceTestDb()
                .update(addonInstances)
                .set({ status: 'ACTIVE', endsAt: null })
                .where(eq(addonInstances.id, bought.instanceId));
            f.advanceTo(new Date('2027-11-08T00:00:00.000Z'));
            const coverageNotices = noticeSpy();
            expect(
                await expireAddonInstances(100, {
                    clock: f.ports.clock,
                    listing: f.ports.listing,
                    coverageNotices
                })
            ).toMatchObject({ expired: 0 });
            expect(await status(bought.instanceId)).toBe('ACTIVE');
            expect(coverageNotices.emitCoverageChanged).toHaveBeenCalledTimes(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'uses product vertical when the listing row is missing',
        async () => {
            const f = await purchaseFixture({ scopeType: 'LISTING' });
            await payingPrincipal(f);
            const id = crypto.randomUUID();
            listing(f, id, true);
            const instance = await active(f, id);
            f.advanceTo(instance.endsAt!);
            const coverageNotices = noticeSpy();
            const listingMissing = async () => {
                const error = new Error('Listing missing');
                error.name = 'ListingNotFoundError';
                throw error;
            };
            expect(
                await expireAddonInstances(100, {
                    clock: f.ports.clock,
                    listing: listingMissing,
                    coverageNotices
                })
            ).toMatchObject({ expired: 1, failed: 0 });
            expect(await status(instance.id)).toBe('EXPIRED');
            expect(coverageNotices.emitCoverageChanged).toHaveBeenCalledExactlyOnceWith({
                userId: f.ownerId,
                vertical: VerticalEnum.ACCOMMODATION,
                sourceType: 'ADDON',
                change: 'REMOVED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'writes one transition over two passes and notifies after commit',
        async () => {
            const f = await purchaseFixture({ scopeType: 'LISTING' });
            await payingPrincipal(f);
            const id = crypto.randomUUID();
            listing(f, id, true);
            const instance = await active(f, id);
            f.advanceTo(instance.endsAt!);
            const statusAtNotice: string[] = [];
            const coverageNotices = {
                emitCoverageChanged: vi.fn(async () => {
                    statusAtNotice.push((await status(instance.id)) ?? 'MISSING');
                })
            };
            const ports = { clock: f.ports.clock, listing: f.ports.listing, coverageNotices };
            expect(await expireAddonInstances(100, ports)).toMatchObject({ expired: 1 });
            expect(await expireAddonInstances(100, ports)).toMatchObject({ expired: 0 });
            const events = await domainEventModel.findByEntity({
                entityType: 'addon_instance',
                entityId: instance.id
            });
            expect(
                events.filter(
                    (event) =>
                        event.eventType === 'addon_instance.status_changed' &&
                        event.changes?.some(
                            (change) => change.field === 'status' && change.new === 'EXPIRED'
                        )
                )
            ).toHaveLength(1);
            expect(coverageNotices.emitCoverageChanged).toHaveBeenCalledTimes(1);
            expect(statusAtNotice).toEqual(['EXPIRED']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'isolates a transaction failure from the next instance',
        async () => {
            const f = await purchaseFixture({ scopeType: 'LISTING' });
            await payingPrincipal(f);
            const brokenId = crypto.randomUUID();
            const validId = crypto.randomUUID();
            listing(f, brokenId, true);
            listing(f, validId, true);
            const broken = await active(f, brokenId);
            const valid = await active(f, validId);
            f.advanceTo(broken.endsAt!);
            const coverageNotices = noticeSpy();
            const listingPort: typeof f.ports.listing = async (input) => {
                if (input.listingId === brokenId) throw new Error('Injected transaction failure');
                return f.ports.listing(input);
            };
            expect(
                await expireAddonInstances(100, {
                    clock: f.ports.clock,
                    listing: listingPort,
                    coverageNotices
                })
            ).toMatchObject({ expired: 1, failed: 1 });
            expect(await status(broken.id)).toBe('ACTIVE');
            expect(await status(valid.id)).toBe('EXPIRED');
        }
    );
});
