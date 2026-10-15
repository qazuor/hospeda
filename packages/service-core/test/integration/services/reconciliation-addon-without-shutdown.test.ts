import {
    addonInstances,
    emailOutbox,
    eq,
    inArray,
    permanentGrants,
    permanentGrantVerticals,
    reconciliationMarks,
    reconciliationZeroCallModel,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runZeroCallChecks } from '../../../src/services/billing/reconciliation/sweep/zero-call-checks.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { createReconciliationFake } from './reconciliation-sweep-fixtures.js';
import {
    orphanPorts,
    readDecisions,
    readInstance,
    readSubscription,
    retireCommittedOrphanRows,
    seedCommittedOrphans
} from './support/addon-orphan-fixtures.js';
import {
    retirePermanentGrantRows,
    seedPermanentGrant
} from './support/permanent-grant-fixtures.js';

const seeded: Array<{ instanceId: string; complementId: string }> = [];
const grantOwners: string[] = [];
const hungPayments: unknown[] = [];
const markPayments = {
    hang: async (payment: unknown) => {
        hungPayments.push(payment);
    },
    countUnresolved: async () => 0
};

function isolateUnrelatedChecks(): void {
    vi.spyOn(
        reconciliationZeroCallModel,
        'listOpenSuccessionsOnDeadPredecessorsPage'
    ).mockResolvedValue([]);
    vi.spyOn(
        reconciliationZeroCallModel,
        'listDeferredCourtesiesWithActiveSuccessorPage'
    ).mockResolvedValue([]);
}

afterAll(closeServiceTestPool);
afterEach(async () => {
    const instanceIds = seeded.map(({ instanceId }) => instanceId);
    for (const { complementId } of seeded)
        await getServiceTestDb()
            .delete(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, complementId));
    if (instanceIds.length > 0)
        await getServiceTestDb()
            .update(addonInstances)
            .set({ titleAnchorId: null })
            .where(inArray(addonInstances.id, instanceIds));
    seeded.length = 0;
    await retireCommittedOrphanRows();
    await retirePermanentGrantRows(grantOwners.splice(0));
    hungPayments.length = 0;
    await vi.restoreAllMocks();
});

describe('TEST:B5:15 fourth zero-call sweep check', () => {
    it('opens ADDON_SIN_APAGAR on the live complement while leaving the instance active', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        const { ports } = orphanPorts(getServiceTestDb() as never);
        isolateUnrelatedChecks();
        let calls = 0;
        const noProvider = new Proxy(fake, {
            get(target, key, receiver) {
                const value: unknown = Reflect.get(target, key, receiver);
                if (typeof value !== 'function') return value;
                calls++;
                return (...args: unknown[]) => {
                    return value.apply(target, args);
                };
            }
        });
        const portsWithTripwire = {
            addonOrphanhood: ports,
            markPayments,
            retainedPayments: { listRetainedPayments: async () => [] },
            retainedPaymentBranches: {
                resolveByBranch: async () => ({ kind: 'NO_BRANCH' as const })
            },
            provider: noProvider
        };
        const summary = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            portsWithTripwire
        );
        expect(calls).toBe(0);
        expect(hungPayments).toEqual([]);
        const result = summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET');
        expect(result).toMatchObject({
            examined: 1,
            marksOpened: 1,
            marksAccumulated: 0,
            resolved: 0
        });
        expect(
            summary.failures.filter(({ subjectId }) => subjectId === subject.instanceId)
        ).toEqual([]);
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, subject.complementId));
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({
            reason: 'ADDON_SIN_APAGAR',
            subscriptionId: subject.complementId
        });
        expect((await readInstance(getServiceTestDb() as never, subject.instanceId)).status).toBe(
            'ACTIVE'
        );
        expect(
            (await readSubscription(getServiceTestDb() as never, subject.complementId)).status
        ).toBe('ACTIVE');
        expect(await readDecisions(getServiceTestDb() as never, subject.complementId)).toEqual([]);
        expect(
            await getServiceTestDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, orphan.userId))
        ).toEqual([]);
    });

    it('includes PENDING_AUTHORIZATION and skips terminal instances', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({
            fake,
            instanceStatus: 'PENDING_AUTHORIZATION'
        });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        const db = getServiceTestDb();
        const { ports } = orphanPorts(db as never);
        isolateUnrelatedChecks();
        const check = async () => {
            const summary = await runZeroCallChecks(
                { correlationId: crypto.randomUUID() },
                {
                    addonOrphanhood: ports,
                    markPayments,
                    retainedPayments: { listRetainedPayments: async () => [] },
                    retainedPaymentBranches: {
                        resolveByBranch: async () => ({ kind: 'NO_BRANCH' })
                    }
                }
            );
            return summary.results.find(({ check: name }) => name === 'ADDON_LIVE_ON_DEAD_TARGET');
        };
        const pending = await check();
        expect(pending).toMatchObject({ examined: 1, marksOpened: 1 });
        await db
            .update(addonInstances)
            .set({ status: 'ABANDONED' })
            .where(eq(addonInstances.id, subject.instanceId));
        const terminal = await check();
        expect(terminal).toMatchObject({ examined: 0, marksOpened: 0, marksAccumulated: 0 });
    });

    it('counts an orphaned one-time instance without a complement but opens no mark', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake, chargeKind: 'UNA_VEZ' });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        const db = getServiceTestDb();
        await db
            .update(addonInstances)
            .set({ complementSubscriptionId: null })
            .where(eq(addonInstances.id, subject.instanceId));
        const { ports } = orphanPorts(db as never);
        isolateUnrelatedChecks();
        const summary = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: ports,
                markPayments,
                retainedPayments: { listRetainedPayments: async () => [] },
                retainedPaymentBranches: { resolveByBranch: async () => ({ kind: 'NO_BRANCH' }) }
            }
        );
        expect(
            summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')
        ).toMatchObject({ examined: 1, marksOpened: 0, marksAccumulated: 0 });
        expect(
            summary.failures.filter(({ subjectId }) => subjectId === subject.instanceId)
        ).toEqual([]);
        expect(
            await db
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, subject.complementId))
        ).toEqual([]);
    });

    it('accumulates a repeated open mark instead of duplicating it', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        const { ports } = orphanPorts(getServiceTestDb() as never);
        isolateUnrelatedChecks();
        const input = { correlationId: crypto.randomUUID() };
        const portsForCheck = {
            addonOrphanhood: ports,
            markPayments,
            retainedPayments: { listRetainedPayments: async () => [] },
            retainedPaymentBranches: {
                resolveByBranch: async () => ({ kind: 'NO_BRANCH' as const })
            }
        };
        const first = await runZeroCallChecks(input, portsForCheck);
        const second = await runZeroCallChecks(input, portsForCheck);
        const firstCheck = first.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET');
        const secondCheck = second.results.find(
            ({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET'
        );
        expect(firstCheck?.marksOpened).toBe(1);
        expect(secondCheck?.marksAccumulated).toBe(1);
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, subject.complementId));
        expect(marks).toHaveLength(1);
    });

    it('does not mark an addon whose target subscription remains live', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, orphan.principalId));
        const { ports } = orphanPorts(db as never);
        isolateUnrelatedChecks();
        const summary = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: ports,
                markPayments,
                retainedPayments: { listRetainedPayments: async () => [] },
                retainedPaymentBranches: { resolveByBranch: async () => ({ kind: 'NO_BRANCH' }) }
            }
        );
        const result = summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET');
        expect(result).toMatchObject({ examined: 1, marksOpened: 0, marksAccumulated: 0 });
        expect(
            await db
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, subject.complementId))
        ).toEqual([]);
    });

    it('does not mark a live title anchor grant', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        grantOwners.push(orphan.userId);
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, orphan.principalId));
        const grant = await db.transaction((tx) =>
            seedPermanentGrant(tx, {
                beneficiaryUserId: orphan.userId,
                grantedBy: orphan.userId,
                anchors: [{ vertical: 'accommodation' }]
            })
        );
        const anchorId = grant.anchorIds[0];
        if (!anchorId) throw new Error('seeded grant anchor missing');
        await db
            .update(addonInstances)
            .set({ titleAnchorId: anchorId })
            .where(eq(addonInstances.id, subject.instanceId));
        const { ports } = orphanPorts(db as never);
        isolateUnrelatedChecks();
        const summary = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: ports,
                markPayments,
                retainedPayments: { listRetainedPayments: async () => [] },
                retainedPaymentBranches: { resolveByBranch: async () => ({ kind: 'NO_BRANCH' }) }
            }
        );
        expect(
            summary.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')?.marksOpened
        ).toBe(0);
        expect(
            await db
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, subject.complementId))
        ).toEqual([]);
    });

    it('marks a live target when its title anchor grant has been revoked', async () => {
        const { fake } = createReconciliationFake();
        const orphan = await seedCommittedOrphans({ fake });
        const subject = orphan.addons[0];
        if (!subject) throw new Error('seeded addon missing');
        seeded.push({ instanceId: subject.instanceId, complementId: subject.complementId });
        grantOwners.push(orphan.userId);
        const db = getServiceTestDb();
        await db
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, orphan.principalId));
        const grant = await db.transaction((tx) =>
            seedPermanentGrant(tx, {
                beneficiaryUserId: orphan.userId,
                grantedBy: orphan.userId,
                anchors: [{ vertical: 'accommodation' }],
                revoked: true
            })
        );
        const anchorId = grant.anchorIds[0];
        if (!anchorId) throw new Error('seeded grant anchor missing');
        await db
            .update(addonInstances)
            .set({ titleAnchorId: anchorId })
            .where(eq(addonInstances.id, subject.instanceId));
        const { ports } = orphanPorts(db as never);
        isolateUnrelatedChecks();
        const result = await runZeroCallChecks(
            { correlationId: crypto.randomUUID() },
            {
                addonOrphanhood: ports,
                markPayments,
                retainedPayments: { listRetainedPayments: async () => [] },
                retainedPaymentBranches: { resolveByBranch: async () => ({ kind: 'NO_BRANCH' }) }
            }
        );
        expect(
            result.results.find(({ check }) => check === 'ADDON_LIVE_ON_DEAD_TARGET')?.marksOpened
        ).toBe(1);
        const marks = await db
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, subject.complementId));
        expect(marks).toHaveLength(1);
        expect(marks[0]?.reason).toBe('ADDON_SIN_APAGAR');
        expect(
            await db
                .select({ id: permanentGrants.id })
                .from(permanentGrants)
                .where(eq(permanentGrants.id, grant.grantId))
        ).toHaveLength(1);
        expect(
            await db
                .select({ id: permanentGrantVerticals.id })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.id, anchorId))
        ).toHaveLength(1);
    });
});
