import {
    addonInstances,
    courtesyGrants,
    domainEventModel,
    eq,
    permanentGrants,
    permanentGrantVerticals,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { previewPermanentGrant } from '../../../src/services/billing/grant/permanent-grant-preview.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { grantSignerActor } from './support/permanent-grant-fixtures.js';
import {
    createPreviewScenario,
    otherPreviewVertical,
    previewVertical,
    retirePreviewScenarios,
    seedPreviewCourtesy,
    seedPreviewDeferred,
    seedPreviewPrincipal
} from './support/permanent-grant-preview-fixtures.js';
import { seedS20Addon } from './support/permanent-grant-s20-fixtures.js';

const db = getServiceTestDb;
afterAll(closeServiceTestPool);
afterEach(retirePreviewScenarios);

function input(s: Awaited<ReturnType<typeof createPreviewScenario>>, includesAddons = false) {
    return {
        beneficiaryUserId: s.userId,
        actor: s.actor,
        reason: 'preview test',
        includesAddons,
        anchors: [{ vertical: previewVertical, ...s.plan }]
    };
}

async function expectNoGrant(s: Awaited<ReturnType<typeof createPreviewScenario>>) {
    const grants = await db()
        .select({ id: permanentGrants.id })
        .from(permanentGrants)
        .where(eq(permanentGrants.beneficiaryUserId, s.userId));
    expect(grants).toEqual([]);
    const anchors = await db()
        .select({ id: permanentGrantVerticals.id })
        .from(permanentGrantVerticals)
        .where(eq(permanentGrantVerticals.permanentGrantId, grants[0]?.id ?? crypto.randomUUID()));
    expect(anchors).toEqual([]);
}

async function expectNoDecision(subscriptionId: string) {
    const events = await domainEventModel.findByEntity({
        entityType: 'subscription',
        entityId: subscriptionId
    });
    expect(
        events.filter((event) => event.eventType === 'subscription.provider_cancellation_decided')
    ).toEqual([]);
}

describe.skipIf(!isServiceTestDbAvailable())('AC:B13a:6 (support) — grant preview', () => {
    it.each([
        ['CARD', true],
        ['MANUAL', false]
    ] as const)('shows the exact stopped charge and email prediction for %s', async (paymentMethod, providerEmail) => {
        const s = await createPreviewScenario();
        const principal = await seedPreviewPrincipal({
            userId: s.userId,
            fake: s.fake,
            paymentMethod
        });
        const cancel = vi.spyOn(s.fake, 'cancel');
        const preview = await previewPermanentGrant(input(s), s.ports);
        expect(preview.stoppedCharges).toEqual([
            {
                subscriptionId: principal.subscriptionId,
                vertical: previewVertical,
                status: 'ACTIVE',
                providerEmail
            }
        ]);
        expect(preview.endingCourtesies).toEqual([]);
        expect(preview.convertedAddons).toEqual([]);
        await expectNoGrant(s);
        const [row] = await db()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        await expectNoDecision(principal.subscriptionId);
        expect(cancel).not.toHaveBeenCalled();
        const act = await grantPermanentGrant(input(s), s.ports);
        expect(act.cancelledSubscriptionIds).toEqual(
            preview.stoppedCharges.map(({ subscriptionId }) => subscriptionId)
        );
    });

    it.each([
        'COURTESY',
        'CUSTOMER_REQUEST'
    ] as const)('only a %s pause ends a courtesy', async (reason) => {
        const s = await createPreviewScenario();
        const principal = await seedPreviewPrincipal({ userId: s.userId, fake: s.fake });
        const courtesy = await seedPreviewCourtesy({
            userId: s.userId,
            adminId: s.adminId,
            subscriptionId: principal.subscriptionId,
            fake: s.fake,
            authorizationId: principal.authorizationId,
            reason
        });
        const cancel = vi.spyOn(s.fake, 'cancel');
        const preview = await previewPermanentGrant(input(s), s.ports);
        expect(preview.endingCourtesies).toEqual(
            reason === 'COURTESY'
                ? [
                      {
                          subscriptionId: principal.subscriptionId,
                          vertical: previewVertical,
                          endsAt: courtesy.endsAt,
                          providerEmail: true
                      }
                  ]
                : []
        );
        await expectNoGrant(s);
        const [sub] = await db()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(sub?.status).toBe('PAUSED');
        const [pause] = await db()
            .select({ actualEndAt: subscriptionPauses.actualEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId));
        expect(pause?.actualEndAt).toBeNull();
        await expectNoDecision(principal.subscriptionId);
        expect(cancel).not.toHaveBeenCalled();
        const act = await grantPermanentGrant(input(s), s.ports);
        expect(act.cancelledSubscriptionIds).toEqual(
            preview.stoppedCharges.map(({ subscriptionId }) => subscriptionId)
        );
    });

    it('closes only an anchored deferred balance and predicts its months', async () => {
        const s = await createPreviewScenario();
        const reached = await seedPreviewDeferred({
            userId: s.userId,
            adminId: s.adminId,
            vertical: previewVertical,
            balanceMonths: 3
        });
        const elsewhere = await seedPreviewDeferred({
            userId: s.userId,
            adminId: s.adminId,
            vertical: otherPreviewVertical,
            balanceMonths: 2
        });
        const preview = await previewPermanentGrant(input(s), s.ports);
        expect(preview.closedDeferredBalances).toEqual([
            { courtesyGrantId: reached, vertical: previewVertical, balanceMonths: 3 }
        ]);
        await expectNoGrant(s);
        const rows = await db()
            .select({ id: courtesyGrants.id, balanceClosedAt: courtesyGrants.balanceClosedAt })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.beneficiaryUserId, s.userId));
        expect(
            rows
                .filter(({ id }) => id === reached || id === elsewhere)
                .every(({ balanceClosedAt }) => balanceClosedAt === null)
        ).toBe(true);
        const act = await grantPermanentGrant(input(s), s.ports);
        expect(act.closedCourtesyIds).toEqual(
            preview.closedDeferredBalances.map(({ courtesyGrantId }) => courtesyGrantId)
        );
    });

    it.each([
        true,
        false
    ])('lists the paid addon only when includesAddons=%s', async (includesAddons) => {
        const s = await createPreviewScenario();
        const addon = await seedS20Addon({
            fake: s.fake,
            userId: s.userId,
            vertical: previewVertical,
            targetId: null,
            scopeType: 'USER'
        });
        const cancel = vi.spyOn(s.fake, 'cancel');
        const preview = await previewPermanentGrant(input(s, includesAddons), s.ports);
        expect(preview.convertedAddons.map(({ addonInstanceId }) => addonInstanceId)).toEqual(
            includesAddons ? [addon.instanceId] : []
        );
        if (includesAddons)
            expect(preview.convertedAddons[0]).toMatchObject({
                complementSubscriptionId: addon.complementId,
                addonName: expect.any(String),
                providerEmail: true
            });
        await expectNoGrant(s);
        const [instance] = await db()
            .select({ status: addonInstances.status, titleAnchorId: addonInstances.titleAnchorId })
            .from(addonInstances)
            .where(eq(addonInstances.id, addon.instanceId));
        expect(instance).toEqual({ status: 'ACTIVE', titleAnchorId: null });
        const [complement] = await db()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, addon.complementId));
        expect(complement?.status).toBe('ACTIVE');
        await expectNoDecision(addon.complementId);
        expect(cancel).not.toHaveBeenCalled();
        const act = await grantPermanentGrant(input(s, includesAddons), s.ports);
        expect(act.anchoredAddonInstanceIds).toEqual(
            preview.convertedAddons.map(({ addonInstanceId }) => addonInstanceId)
        );
    });

    it('rejects forbidden actors, self-grants, live duplicates and stale floors without writes', async () => {
        const s = await createPreviewScenario();
        const basic = input(s);
        for (const candidate of [
            { ...basic, actor: grantSignerActor(s.adminId, []) },
            { ...basic, actor: grantSignerActor(s.userId) }
        ]) {
            await expect(previewPermanentGrant(candidate, s.ports)).rejects.toMatchObject({
                reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
            });
            await expectNoGrant(s);
        }
        await expect(
            previewPermanentGrant(basic, {
                ...s.ports,
                planPolicy: async () => ({
                    graceDays: 0,
                    allowsPause: false,
                    current: false,
                    sellable: false
                })
            })
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' });
        await expectNoGrant(s);
        const act = await grantPermanentGrant(basic, s.ports);
        await expect(previewPermanentGrant(basic, s.ports)).rejects.toMatchObject({
            reason: 'PERMANENT_GRANT_ALREADY_LIVE'
        });
        const grants = await db()
            .select({ id: permanentGrants.id })
            .from(permanentGrants)
            .where(eq(permanentGrants.beneficiaryUserId, s.userId));
        expect(grants.map(({ id }) => id)).toEqual([act.permanentGrantId]);
    });
});
