import { addonInstances, domainEventModel, eq, payments, receipts } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { chooseFreeAddon } from '../../../src/services/billing/addon/choose-free-addon.service';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { freeChoiceFixture, retireFreeChoiceFixtures } from './support/addon-free-choice-fixtures';

afterEach(retireFreeChoiceFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B10:14 AC:B10:12 free addon under grant', () => {
    it('creates ACTIVE with the anchor, event, fixed end, and no payment or provider call', async () => {
        const f = await freeChoiceFixture();
        const authorize = vi.spyOn(f.fake, 'authorize');
        const charge = vi.spyOn(f.fake, 'chargeOnce');
        const cancel = vi.spyOn(f.fake, 'cancel');
        const input = f.freeInput();
        const ordersBefore = f.fake.ordersFor({ reference: input.orderRequestId });
        const authorizationsBefore = await f.fake.searchAuthorizations({
            reference: input.orderRequestId
        });
        const result = await chooseFreeAddon(input, f.freePorts);
        expect(result).toMatchObject({ outcome: 'CREATED', status: 'ACTIVE' });
        const [row] = await f.instances();
        expect(row).toMatchObject({
            id: result.outcome === 'CREATED' ? result.instanceId : '',
            titleAnchorId: f.grant.anchorIds[0],
            status: 'ACTIVE',
            complementSubscriptionId: null,
            providerOrderId: null,
            startsAt: expect.any(Date),
            endsAt: expect.any(Date)
        });
        expect(row!.endsAt!.getTime() - row!.startsAt!.getTime()).toBe(30 * 86_400_000);
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: row!.id
        });
        expect(
            events.find((event) => event.eventType === 'addon_instance.status_changed')
        ).toMatchObject({
            actorType: 'owner',
            actorId: f.ownerId,
            changes: [{ field: 'status', old: null, new: 'ACTIVE' }]
        });
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.addonInstanceId, row!.id))
        ).toHaveLength(0);
        expect(
            await getServiceTestDb()
                .select({ id: receipts.id })
                .from(receipts)
                .innerJoin(payments, eq(payments.id, receipts.paymentId))
                .where(eq(payments.addonInstanceId, row!.id))
        ).toHaveLength(0);
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(charge).toHaveBeenCalledTimes(0);
        expect(cancel).toHaveBeenCalledTimes(0);
        expect(f.fake.ordersFor({ reference: input.orderRequestId })).toEqual(ordersBefore);
        expect(await f.fake.searchAuthorizations({ reference: input.orderRequestId })).toEqual(
            authorizationsBefore
        );
        expect(f.notices).toContainEqual(
            expect.objectContaining({ sourceType: 'ADDON', change: 'ADDED' })
        );
    });

    it('replays the same order and a different order as one live free choice', async () => {
        const f = await freeChoiceFixture();
        const input = f.freeInput();
        const created = await chooseFreeAddon(input, f.freePorts);
        expect(created.outcome).toBe('CREATED');
        expect(await chooseFreeAddon(input, f.freePorts)).toEqual({
            ...created,
            outcome: 'EXISTING'
        });
        expect(await chooseFreeAddon(f.freeInput(), f.freePorts)).toEqual({
            ...created,
            outcome: 'EXISTING'
        });
        expect(await f.instances()).toHaveLength(1);
    });

    it('leaves the end open for a while-subscription-alive policy', async () => {
        const f = await freeChoiceFixture({ chargeKind: 'PERIODICO' });
        expect(await chooseFreeAddon(f.freeInput(), f.freePorts)).toMatchObject({
            outcome: 'CREATED'
        });
        expect((await f.instances())[0]?.endsAt).toBeNull();
    });

    it('settles concurrent different requests through the free-choice unique index', async () => {
        const f = await freeChoiceFixture();
        const [first, second] = await Promise.all([
            chooseFreeAddon(f.freeInput(), f.freePorts),
            chooseFreeAddon(f.freeInput(), f.freePorts)
        ]);
        expect([first.outcome, second.outcome].sort()).toEqual(['CREATED', 'EXISTING']);
        expect(first.outcome === 'REFUSED' ? null : first.instanceId).toBe(
            second.outcome === 'REFUSED' ? null : second.instanceId
        );
        expect(await f.instances()).toHaveLength(1);
    });

    it('rejects a grant without includesAddons and a vertical without an anchor', async () => {
        const noFlag = await freeChoiceFixture({ includesAddons: false });
        expect(await chooseFreeAddon(noFlag.freeInput(), noFlag.freePorts)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_FREE_TITLE'
        });
        expect(await noFlag.instances()).toHaveLength(0);
        const other = await freeChoiceFixture({ verticals: ['venue'] });
        expect(await chooseFreeAddon(other.freeInput(), other.freePorts)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_FREE_TITLE'
        });
        expect(await other.instances()).toHaveLength(0);
    });

    it('rejects paid A1 before any provider authorization', async () => {
        const f = await freeChoiceFixture();
        const authorize = vi.spyOn(f.fake, 'authorize');
        expect(await purchaseAddon(f.input(), f.ports)).toEqual({
            outcome: 'REFUSED',
            reason: 'FREE_UNDER_GRANT'
        });
        expect(await f.instances()).toHaveLength(0);
        expect(authorize).toHaveBeenCalledTimes(0);
    });

    it('A5 cancels the free instance on real grant revocation without provider call', async () => {
        const f = await freeChoiceFixture();
        const cancel = vi.spyOn(f.fake, 'cancel');
        const created = await chooseFreeAddon(f.freeInput(), f.freePorts);
        if (created.outcome !== 'CREATED') throw new Error('Choice missing');
        const revoked = await f.revoke();
        expect(revoked.cancelledAddonInstanceIds).toContain(created.instanceId);
        const [row] = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, created.instanceId));
        expect(row?.status).toBe('CANCELLED');
        const events = await domainEventModel.findByEntity({
            entityType: 'addon_instance',
            entityId: created.instanceId
        });
        expect(
            events.filter((event) => event.eventType === 'addon_instance.status_changed')
        ).toEqual([
            expect.objectContaining({
                changes: [{ field: 'status', old: null, new: 'ACTIVE' }]
            }),
            expect.objectContaining({
                changes: [{ field: 'status', old: 'ACTIVE', new: 'CANCELLED' }]
            })
        ]);
        expect(f.notices).toContainEqual(
            expect.objectContaining({ sourceType: 'ADDON', change: 'REMOVED' })
        );
        expect(await chooseFreeAddon(f.freeInput(), f.freePorts)).toEqual({
            outcome: 'REFUSED',
            reason: 'NO_FREE_TITLE'
        });
        expect(cancel).toHaveBeenCalledTimes(0);
    });
});
