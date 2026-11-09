import { addonInstances, domainEventModel, eq, payments, refunds, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service';
import { revokePermanentGrant } from '../../../src/services/billing/grant/permanent-grant-revoke';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import {
    activeRecurringExitFixture,
    authorizedUnpaidExitPrincipal,
    cachedExitAddonPolicy,
    retireExitFixtures
} from './support/b10-exit-fixtures';
import { seedCoverageUser } from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures';

const grantUsers: string[] = [];
const chargedPaymentIds: string[] = [];
afterEach(async () => {
    for (const id of chargedPaymentIds.splice(0)) {
        await getServiceTestDb().delete(refunds).where(eq(refunds.paymentId, id));
        await getServiceTestDb().delete(payments).where(eq(payments.id, id));
    }
    await retireExitFixtures();
    if (grantUsers.length > 0) await retirePermanentGrantRows(grantUsers.splice(0));
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:10 AC:B10:9 LISTA:B10 cut clauses re-run on A1 rows (B5, B9a)', () => {
    it('LISTA:B10 clause 9 a Free Forever grant cancels the A1 complement without refund and anchors the instance', async () => {
        const h = await activeRecurringExitFixture('USER');
        // The fake provider charge has no service writer; S20 must preserve money already collected.
        const charge = await seedComplementCharge(getServiceTestDb(), {
            subscriptionId: h.complementId,
            factAt: h.f.ports.clock.now(),
            amount: 25000
        });
        chargedPaymentIds.push(charge.paymentId);
        grantUsers.push(h.f.ownerId);
        const admin = await seedCoverageUser(getServiceTestDb());
        grantUsers.push(admin.userId);
        const venuePlan = await seedGrantPlan(getServiceTestDb(), 'venue');
        const accommodationPlan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const ports = {
            planPolicy: currentFloorPolicy,
            clock: h.f.ports.clock,
            provider: h.f.fake,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood: {
                addonPolicy: await cachedExitAddonPolicy(h.f.versionId),
                listing: async () => {
                    throw new Error('No LISTING target');
                }
            }
        };
        const grant = await grantPermanentGrant(
            {
                beneficiaryUserId: h.f.ownerId,
                actor: grantSignerActor(admin.userId),
                reason: 'B10 A1 grant test',
                includesAddons: true,
                anchors: [{ vertical: 'venue', ...venuePlan }]
            },
            ports
        );
        const anchor = await anchorPermanentGrantVertical(
            {
                permanentGrantId: grant.permanentGrantId,
                actor: grantSignerActor(admin.userId),
                vertical: 'accommodation',
                ...accommodationPlan
            },
            ports
        );
        expect(anchor.anchoredAddonInstanceIds).toEqual([h.instanceId]);
        const [instance] = await getServiceTestDb()
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                titleAnchorId: addonInstances.titleAnchorId
            })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({
            id: h.instanceId,
            status: 'ACTIVE',
            titleAnchorId: anchor.anchorId
        });
        const [complement] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId));
        expect(complement).toEqual({ id: h.complementId, status: 'CANCELLED' });
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        const charged = await getServiceTestDb()
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, h.complementId));
        expect(charged).toEqual([{ id: charge.paymentId }]);
        const chargeRefunds = await getServiceTestDb()
            .select({ id: refunds.id })
            .from(refunds)
            .where(eq(refunds.paymentId, charge.paymentId));
        expect(chargeRefunds).toHaveLength(0);
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events.filter(
                ({ eventType, reason }) =>
                    eventType === 'subscription.provider_cancellation_decided' && reason === 'S20'
            )
        ).toHaveLength(1);
    });

    it('LISTA:B10 clause 9 revoking the grant turns off the anchored A1 instance without reviving its charge', async () => {
        const h = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const otherTitleId = await authorizedUnpaidExitPrincipal(h.f);
        grantUsers.push(h.f.ownerId);
        const admin = await seedCoverageUser(getServiceTestDb());
        grantUsers.push(admin.userId);
        const plan = await seedGrantPlan(getServiceTestDb(), 'accommodation');
        const ports = {
            planPolicy: currentFloorPolicy,
            clock: h.f.ports.clock,
            provider: h.f.fake,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            coverageNotices: { emitCoverageChanged: async () => undefined },
            orphanhood: {
                addonPolicy: await cachedExitAddonPolicy(h.f.versionId),
                listing: async () => {
                    throw new Error('No LISTING target');
                }
            }
        };
        const grant = await grantPermanentGrant(
            {
                beneficiaryUserId: h.f.ownerId,
                actor: grantSignerActor(admin.userId),
                reason: 'B10 A1 revoke test',
                includesAddons: true,
                anchors: [{ vertical: 'accommodation', ...plan }]
            },
            ports
        );
        const result = await revokePermanentGrant(
            {
                permanentGrantId: grant.permanentGrantId,
                actor: grantSignerActor(admin.userId),
                reason: 'B10 revoke'
            },
            ports
        );
        expect(result.cancelledAddonInstanceIds).toEqual([h.instanceId]);
        const [instance] = await getServiceTestDb()
            .select({ id: addonInstances.id, status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({ id: h.instanceId, status: 'CANCELLED' });
        const [complement] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId));
        expect(complement).toEqual({ id: h.complementId, status: 'CANCELLED' });
        const [otherTitle] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, otherTitleId));
        expect(otherTitle).toEqual({ id: otherTitleId, status: 'ACTIVE' });
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events.filter(
                ({ eventType, reason }) =>
                    eventType === 'subscription.provider_cancellation_decided' && reason === 'S20'
            )
        ).toHaveLength(1);
    });
});
