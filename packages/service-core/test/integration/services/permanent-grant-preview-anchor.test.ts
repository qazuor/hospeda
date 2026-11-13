import {
    addonInstances,
    courtesyGrants,
    domainEventModel,
    eq,
    permanentGrantVerticals,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { previewPermanentGrantAnchor } from '../../../src/services/billing/grant/permanent-grant-preview.js';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
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

afterAll(closeServiceTestPool);
afterEach(retirePreviewScenarios);
const db = getServiceTestDb;

async function grantBase(
    s: Awaited<ReturnType<typeof createPreviewScenario>>,
    includesAddons: boolean
) {
    return grantPermanentGrant(
        {
            beneficiaryUserId: s.userId,
            actor: s.actor,
            reason: 'initial anchor',
            includesAddons,
            anchors: [{ vertical: previewVertical, ...s.plan }]
        },
        s.ports
    );
}

describe.skipIf(!isServiceTestDbAvailable())('AC:B13a:6 (support) — anchor preview', () => {
    it('projects an active charge, a deferred balance and two preapprovals; the act matches without preview writes', async () => {
        const s = await createPreviewScenario();
        const grant = await grantBase(s, true);
        const active = await seedPreviewPrincipal({
            userId: s.userId,
            fake: s.fake,
            vertical: otherPreviewVertical
        });
        const deferred = await seedPreviewDeferred({
            userId: s.userId,
            adminId: s.adminId,
            vertical: otherPreviewVertical,
            balanceMonths: 4
        });
        const first = await seedS20Addon({
            fake: s.fake,
            userId: s.userId,
            vertical: otherPreviewVertical,
            targetId: null,
            scopeType: 'USER'
        });
        const second = await seedS20Addon({
            fake: s.fake,
            userId: s.userId,
            vertical: otherPreviewVertical,
            targetId: null,
            scopeType: 'USER'
        });
        const cancel = vi.spyOn(s.fake, 'cancel');
        const raw = {
            permanentGrantId: grant.permanentGrantId,
            actor: s.actor,
            vertical: otherPreviewVertical,
            ...s.otherPlan
        };
        const preview = await previewPermanentGrantAnchor(raw, s.ports);
        expect(preview.stoppedCharges.map(({ subscriptionId }) => subscriptionId)).toEqual([
            active.subscriptionId
        ]);
        expect(preview.stoppedCharges.every(({ providerEmail }) => providerEmail)).toBe(true);
        expect(preview.endingCourtesies).toEqual([]);
        expect(preview.closedDeferredBalances).toEqual([
            { courtesyGrantId: deferred, vertical: otherPreviewVertical, balanceMonths: 4 }
        ]);
        expect(
            preview.convertedAddons.map(({ addonInstanceId }) => addonInstanceId).sort()
        ).toEqual([first.instanceId, second.instanceId].sort());
        expect(preview.convertedAddons.every(({ providerEmail }) => providerEmail)).toBe(true);
        const anchors = await db()
            .select({ id: permanentGrantVerticals.id })
            .from(permanentGrantVerticals)
            .where(eq(permanentGrantVerticals.permanentGrantId, grant.permanentGrantId));
        expect(anchors.map(({ id }) => id)).toEqual(grant.anchorIds);
        for (const id of [active.subscriptionId, first.complementId, second.complementId]) {
            const [sub] = await db()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, id));
            expect(sub?.status).toBe('ACTIVE');
            const events = await domainEventModel.findByEntity({
                entityType: 'subscription',
                entityId: id
            });
            expect(
                events.filter(
                    (event) => event.eventType === 'subscription.provider_cancellation_decided'
                )
            ).toEqual([]);
        }
        const [balance] = await db()
            .select({ balanceClosedAt: courtesyGrants.balanceClosedAt })
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, deferred));
        expect(balance?.balanceClosedAt).toBeNull();
        for (const id of [first.instanceId, second.instanceId]) {
            const [instance] = await db()
                .select({
                    status: addonInstances.status,
                    titleAnchorId: addonInstances.titleAnchorId
                })
                .from(addonInstances)
                .where(eq(addonInstances.id, id));
            expect(instance).toEqual({ status: 'ACTIVE', titleAnchorId: null });
        }
        expect(cancel).not.toHaveBeenCalled();
        const act = await anchorPermanentGrantVertical(raw, s.ports);
        expect([...act.cancelledSubscriptionIds].sort()).toEqual(
            preview.stoppedCharges.map(({ subscriptionId }) => subscriptionId).sort()
        );
        expect(act.closedCourtesyIds).toEqual(
            preview.closedDeferredBalances.map(({ courtesyGrantId }) => courtesyGrantId)
        );
        expect([...act.anchoredAddonInstanceIds].sort()).toEqual(
            preview.convertedAddons.map(({ addonInstanceId }) => addonInstanceId).sort()
        );
    });

    it('ends only the open courtesy in the newly anchored vertical', async () => {
        const s = await createPreviewScenario();
        const grant = await grantBase(s, false);
        const paused = await seedPreviewPrincipal({
            userId: s.userId,
            fake: s.fake,
            vertical: otherPreviewVertical
        });
        const courtesy = await seedPreviewCourtesy({
            userId: s.userId,
            adminId: s.adminId,
            subscriptionId: paused.subscriptionId,
            fake: s.fake,
            authorizationId: paused.authorizationId
        });
        const elsewhere = await seedPreviewPrincipal({
            userId: s.userId,
            fake: s.fake,
            vertical: VerticalEnum.EXPERIENCE
        });
        await seedPreviewCourtesy({
            userId: s.userId,
            adminId: s.adminId,
            subscriptionId: elsewhere.subscriptionId,
            fake: s.fake,
            authorizationId: elsewhere.authorizationId
        });
        const raw = {
            permanentGrantId: grant.permanentGrantId,
            actor: s.actor,
            vertical: otherPreviewVertical,
            ...s.otherPlan
        };
        const preview = await previewPermanentGrantAnchor(raw, s.ports);
        expect(preview.endingCourtesies).toEqual([
            {
                subscriptionId: paused.subscriptionId,
                vertical: otherPreviewVertical,
                endsAt: courtesy.endsAt,
                providerEmail: true
            }
        ]);
        const [pause] = await db()
            .select({ actualEndAt: subscriptionPauses.actualEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, paused.subscriptionId));
        expect(pause?.actualEndAt).toBeNull();
        const [otherPause] = await db()
            .select({ actualEndAt: subscriptionPauses.actualEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, elsewhere.subscriptionId));
        expect(otherPause?.actualEndAt).toBeNull();
        const act = await anchorPermanentGrantVertical(raw, s.ports);
        expect(act.cancelledSubscriptionIds).toEqual(
            preview.stoppedCharges.map(({ subscriptionId }) => subscriptionId)
        );
        const [otherAfter] = await db()
            .select({ actualEndAt: subscriptionPauses.actualEndAt })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, elsewhere.subscriptionId));
        expect(otherAfter?.actualEndAt).toBeNull();
    });

    it('matches missing, revoked and already anchored rejections', async () => {
        const s = await createPreviewScenario();
        const grant = await grantBase(s, false);
        const raw = {
            permanentGrantId: grant.permanentGrantId,
            actor: s.actor,
            vertical: otherPreviewVertical,
            ...s.otherPlan
        };
        await expect(
            previewPermanentGrantAnchor({ ...raw, permanentGrantId: crypto.randomUUID() }, s.ports)
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_NOT_FOUND' });
        await expect(
            previewPermanentGrantAnchor({ ...raw, vertical: previewVertical, ...s.plan }, s.ports)
        ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED' });
        await revokePermanentGrant(
            { permanentGrantId: grant.permanentGrantId, actor: s.actor, reason: 'finished' },
            s.ports
        );
        await expect(previewPermanentGrantAnchor(raw, s.ports)).rejects.toMatchObject({
            reason: 'PERMANENT_GRANT_NOT_LIVE'
        });
    });
});
