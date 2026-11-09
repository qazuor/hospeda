import {
    addonInstances,
    and,
    domainEventModel,
    eq,
    inArray,
    payments,
    reconciliationInventoryModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    reconciliationZeroCallModel,
    refunds,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { applyA5, runOrphanhood } from '../../../src/services/billing/addon/addon-instance-a5';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service';
import { applyS21 } from '../../../src/services/billing/subscription/complement-s21';
import { revokeSubscription } from '../../../src/services/billing/subscription/revoke-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { seedComplementCharge } from './support/addon-orphan-fixtures';
import {
    activeRecurringExitFixture,
    authorizedUnpaidExitPrincipal,
    retireExitFixtures
} from './support/b10-exit-fixtures';
import { addonPolicyFromTx } from './support/coverage-fixtures';
import { retireRevocationRows, seedRevocationActor } from './support/revocation-fixtures';

const chargeIds: string[] = [];
const markedComplements: string[] = [];

afterEach(async () => {
    if (chargeIds.length > 0) {
        const ids = chargeIds.splice(0);
        await getServiceTestDb().delete(refunds).where(inArray(refunds.paymentId, ids));
    }
    if (markedComplements.length > 0) {
        const ids = markedComplements.splice(0);
        const marks = await getServiceTestDb()
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
        if (marks.length > 0) {
            await getServiceTestDb()
                .delete(reconciliationMarkPayments)
                .where(
                    inArray(
                        reconciliationMarkPayments.markId,
                        marks.map(({ id }) => id)
                    )
                );
            await getServiceTestDb()
                .delete(reconciliationMarks)
                .where(
                    inArray(
                        reconciliationMarks.id,
                        marks.map(({ id }) => id)
                    )
                );
        }
    }
    await retireRevocationRows();
    await retireExitFixtures();
    vi.restoreAllMocks();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:10 AC:B10:9 LISTA:B10 cut clauses re-run on A1 rows (B5, B9a)', () => {
    it('LISTA:B10 clause 4 a principal lost by another path leaves the addon preapproval live until A5 and the sweep sees it', async () => {
        const h = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        markedComplements.push(h.complementId);
        // Simulate a different principal writer after both starting rows came from services.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, h.principalId));
        const prior = await h.f.fake.readAuthorization({ authorizationId: h.authorizationId });
        expect(prior.snapshot.status).toBe('active');
        const original = reconciliationInventoryModel.listLiveAddonInstanceIdsPage.bind(
            reconciliationInventoryModel
        );
        vi.spyOn(reconciliationInventoryModel, 'listLiveAddonInstanceIdsPage').mockImplementation(
            async (input) => {
                const rows = await original({ ...input, limit: 10_000 });
                return rows
                    .filter(({ id }) => id === h.instanceId)
                    .filter(
                        ({ id }) =>
                            input.afterInstanceId === undefined || id > input.afterInstanceId
                    )
                    .slice(0, input.limit);
            }
        );
        vi.spyOn(
            reconciliationZeroCallModel,
            'listOpenSuccessionsOnDeadPredecessorsPage'
        ).mockResolvedValue([]);
        vi.spyOn(
            reconciliationZeroCallModel,
            'listDeferredCourtesiesWithActiveSuccessorPage'
        ).mockResolvedValue([]);
        const orphanhood = {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('No LISTING target');
            },
            listingPurged: async () => ({ purged: false })
        };
        const sweep = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: orphanhood,
                retainedPayments: { listRetainedPayments: async () => [] },
                retainedPaymentBranches: {
                    resolveByBranch: async () => ({ kind: 'NO_BRANCH' as const })
                }
            }
        );
        expect(sweep.failures.filter(({ subjectId }) => subjectId === h.instanceId)).toEqual([]);
        expect(sweep.results.filter(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')).toEqual([
            {
                check: 'ADDON_LIVE_ON_DEAD_TARGET',
                examined: 1,
                marksOpened: 1,
                marksAccumulated: 0,
                resolved: 0
            }
        ]);
        const marks = await getServiceTestDb()
            .select({
                reason: reconciliationMarks.reason,
                subscriptionId: reconciliationMarks.subscriptionId
            })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, h.complementId));
        expect(marks).toEqual([{ reason: 'ADDON_SIN_APAGAR', subscriptionId: h.complementId }]);
        const stillLive = await h.f.fake.readAuthorization({ authorizationId: h.authorizationId });
        expect(stillLive.snapshot.status).toBe('active');
        const orphan = await getServiceTestDb().transaction((tx) =>
            runOrphanhood(
                { tx, subscriptionId: h.principalId, now: h.f.ports.clock.now() },
                orphanhood
            )
        );
        expect(orphan.cancelled.map(({ instanceId }) => instanceId)).toEqual([h.instanceId]);
        const [instance] = await getServiceTestDb()
            .select({ id: addonInstances.id, status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({ id: h.instanceId, status: 'CANCELLED' });
    });
    it.each([
        { label: 'inside', chargeAt: new Date('2026-10-16T12:00:00.000Z'), refunded: true },
        { label: 'outside', chargeAt: new Date('2026-10-01T12:00:00.000Z'), refunded: false }
    ])('LISTA:B10 clause 5 S36 orphans an A1 addon and requests RF1 $label ten days', async ({
        chargeAt,
        refunded
    }) => {
        const h = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        markedComplements.push(h.complementId);
        const charge = await seedComplementCharge(getServiceTestDb(), {
            subscriptionId: h.complementId,
            factAt: chargeAt,
            coveredPeriodStart: chargeAt,
            amount: 25000
        });
        chargeIds.push(charge.paymentId);
        const [principalPayment] = await getServiceTestDb()
            .select({ id: payments.id })
            .from(payments)
            .where(
                and(eq(payments.subscriptionId, h.principalId), eq(payments.status, 'SUCCEEDED'))
            );
        if (!principalPayment) throw new Error('Principal charge missing');
        h.f.advanceTo(new Date('2026-10-18T12:00:00.000Z'));
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await revokeSubscription(
            {
                actor: await seedRevocationActor(),
                subscriptionId: h.principalId,
                expectedPaymentId: principalPayment.id
            },
            {
                provider: h.f.fake,
                clock: h.f.ports.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                coverageNotices: { emitCoverageChanged: async () => undefined },
                orphanhood: {
                    addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                    listing: async () => {
                        throw new Error('No LISTING target');
                    }
                }
            }
        );
        expect(result.orphanedAddonIds).toEqual([h.instanceId]);
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
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(1);
        const chargeRefunds = await getServiceTestDb()
            .select({ id: refunds.id, reason: refunds.reason, amount: refunds.amount })
            .from(refunds)
            .where(eq(refunds.paymentId, charge.paymentId));
        expect(chargeRefunds).toHaveLength(refunded ? 1 : 0);
        if (refunded)
            expect(chargeRefunds[0]).toMatchObject({ reason: 'ADDON_ORPHAN', amount: 25000 });
        const marks = await getServiceTestDb()
            .select({ id: reconciliationMarks.id, reason: reconciliationMarks.reason })
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, h.complementId));
        expect(marks).toHaveLength(refunded ? 0 : 1);
        if (!refunded)
            expect(marks[0]?.reason).toBe('COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA');
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events.filter(
                ({ eventType, reason }) =>
                    eventType === 'subscription.provider_cancellation_decided' && reason === 'A5'
            )
        ).toHaveLength(1);
    });

    it('LISTA:B10 clause 10 A5 turns off an A1 addon and S21 cancels its complement without grace or refund', async () => {
        const h = await activeRecurringExitFixture('VERTICAL_SUBSCRIPTION');
        const cancel = vi.spyOn(h.f.fake, 'cancel');
        const result = await getServiceTestDb().transaction((tx) =>
            applyA5(
                { tx, instanceId: h.instanceId, clause: 'WITHDRAWN', now: h.f.ports.clock.now() },
                {
                    addonPolicy: addonPolicyFromTx(tx),
                    listing: async () => {
                        throw new Error('No LISTING target');
                    }
                }
            )
        );
        expect(result).toMatchObject({ outcome: 'CANCELLED' });
        const [instance] = await getServiceTestDb()
            .select({ id: addonInstances.id, status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, h.instanceId));
        expect(instance).toEqual({ id: h.instanceId, status: 'CANCELLED' });
        const [complement] = await getServiceTestDb()
            .select({
                id: subscriptions.id,
                status: subscriptions.status,
                serviceEndsAt: subscriptions.serviceEndsAt,
                graceStartedAt: subscriptions.graceStartedAt,
                graceEndsAt: subscriptions.graceEndsAt
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, h.complementId));
        expect(complement).toEqual({
            id: h.complementId,
            status: 'CANCELLED',
            serviceEndsAt: null,
            graceStartedAt: null,
            graceEndsAt: null
        });
        expect(
            await getServiceTestDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, h.complementId))
        ).toHaveLength(0);
        expect(
            cancel.mock.calls.filter(([call]) => call.authorizationId === h.authorizationId)
        ).toHaveLength(0);
        const second = await getServiceTestDb().transaction((tx) =>
            applyS21({ tx, complementSubscriptionId: h.complementId, now: h.f.ports.clock.now() })
        );
        expect(second).toEqual({ outcome: 'ALREADY_CANCELLED' });
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events.filter(
                ({ eventType, reason }) =>
                    eventType === 'subscription.provider_cancellation_decided' && reason === 'A5'
            )
        ).toHaveLength(1);
    });

    it('LISTA:B10 clause 11 4d a USER addon with only an unpaid live principal and no anchor is orphaned', async () => {
        const h = await activeRecurringExitFixture('USER', ['accommodation', 'venue']);
        const unpaidId = await authorizedUnpaidExitPrincipal(h.f);
        const [unpaid] = await getServiceTestDb()
            .select({ id: subscriptions.id, status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, unpaidId));
        expect(unpaid).toEqual({ id: unpaidId, status: 'ACTIVE' });
        expect(
            await getServiceTestDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, unpaidId))
        ).toHaveLength(0);
        // Simulate a principal removed by another writer; both starting rows came from services.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, h.principalId));
        const result = await getServiceTestDb().transaction((tx) =>
            runOrphanhood(
                { tx, subscriptionId: h.principalId, now: h.f.ports.clock.now() },
                {
                    addonPolicy: addonPolicyFromTx(tx),
                    listing: async () => {
                        throw new Error('No LISTING target');
                    }
                }
            )
        );
        expect(result.cancelled.map(({ instanceId }) => instanceId)).toEqual([h.instanceId]);
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
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: h.complementId
        });
        expect(
            events.filter(
                ({ eventType, reason }) =>
                    eventType === 'subscription.provider_cancellation_decided' && reason === 'A5'
            )
        ).toHaveLength(1);
    });
});
