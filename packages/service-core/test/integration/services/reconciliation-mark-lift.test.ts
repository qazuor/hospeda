import {
    billingDeadlineVersions,
    reconciliationMarkModel,
    subscriptionModel,
    users
} from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);
const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;
async function fixture() {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `lift-${crypto.randomUUID()}@example.test`,
            displayName: 'Lift test',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('No user');
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `lift-${crypto.randomUUID()}`, 'Lift plan']
        )
    ).rows[0]?.id;
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1e8) + 1]
        )
    ).rows[0]?.id;
    const optionId = (
        await getServiceTestPool().query(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id as string;
    if (!versionId || !optionId) throw new Error('No plan anchors');
    const row = await subscriptionModel.createPendingAuthorization({
        userId: user.id,
        vertical: 'accommodation',
        planVersionId: versionId,
        billingOptionId: optionId,
        authorizationWindowDeadlineVersion: 1,
        authorizationWindowEndsAt: new Date('2027-01-01T00:00:00Z')
    });
    await getServiceTestPool().query("UPDATE subscription SET status='ACTIVE' WHERE id=$1", [
        row.subscription.id
    ]);
    return { userId: user.id, subscriptionId: row.subscription.id };
}
const admin = (id: string) => ({ type: 'admin' as const, id });
const payments = (unresolved = 0) => ({
    async hang() {},
    async countUnresolved() {
        return unresolved;
    }
});

describe('TEST:B3:15 S15 reconciliation mark lift', () => {
    it('lifts one reason only and leaves the subscription and sibling mark untouched', async () => {
        const { subscriptionId, userId } = await fixture();
        const subject = { kind: 'SUBSCRIPTION' as const, subscriptionId };
        const one = await openReconciliationMark({
            subject,
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        const two = await openReconciliationMark({
            subject,
            reason: 'TRANSICION_NO_DECLARADA',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        const before = (
            await getServiceTestPool().query(
                'SELECT status, updated_at FROM subscription WHERE id=$1',
                [subscriptionId]
            )
        ).rows[0];
        const result = await liftReconciliationMark(
            { markId: one.mark.id, expectedVersion: one.mark.version, liftedBy: userId },
            { clock, markPayments: payments() }
        );
        expect(result).toMatchObject({
            outcome: 'LIFTED',
            mark: { liftedBy: userId, version: 2, liftedAt: clock.now() }
        });
        expect(
            await reconciliationMarkModel.findOpen({ subject, reason: 'DIVERGENCIA_DE_MONTO' })
        ).toBeNull();
        expect(
            (await reconciliationMarkModel.findOpen({ subject, reason: 'TRANSICION_NO_DECLARADA' }))
                ?.id
        ).toBe(two.mark.id);
        expect(
            (
                await getServiceTestPool().query(
                    'SELECT status, updated_at FROM subscription WHERE id=$1',
                    [subscriptionId]
                )
            ).rows[0]
        ).toEqual(before);
    });

    it('rejects a stale version after S14 bumps it, then succeeds with the reread version', async () => {
        const { subscriptionId, userId } = await fixture();
        const subject = { kind: 'SUBSCRIPTION' as const, subscriptionId };
        const opened = await openReconciliationMark({
            subject,
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        await openReconciliationMark(
            {
                subject,
                reason: 'DIVERGENCIA_DE_MONTO',
                payment: { source: 'PAYMENT', id: crypto.randomUUID() },
                actor: admin(userId),
                correlationId: crypto.randomUUID()
            },
            { markPayments: payments() }
        );
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 1, liftedBy: userId },
                { clock, markPayments: payments() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_VERSION_CONFLICT' });
        const reread = await reconciliationMarkModel.findById({ markId: opened.mark.id });
        if (!reread) throw new Error('No mark after version conflict');
        await expect(
            liftReconciliationMark(
                { markId: reread.id, expectedVersion: reread.version, liftedBy: userId },
                { clock, markPayments: payments() }
            )
        ).resolves.toMatchObject({ outcome: 'LIFTED' });
    });

    it('rejects unresolved payments and already lifted or missing marks', async () => {
        const { subscriptionId, userId } = await fixture();
        const opened = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 1, liftedBy: userId },
                { clock, markPayments: payments(2) }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        await liftReconciliationMark(
            { markId: opened.mark.id, expectedVersion: 1, liftedBy: userId },
            { clock, markPayments: payments() }
        );
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 2, liftedBy: userId },
                { clock, markPayments: payments() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_ALREADY_LIFTED' });
        await expect(
            liftReconciliationMark(
                { markId: crypto.randomUUID(), expectedVersion: 1, liftedBy: userId },
                { clock, markPayments: payments() }
            )
        ).rejects.toMatchObject({ reason: 'MARK_NOT_FOUND' });
    });

    it('TEST:B3:15 rechecks version after the payment guard and then rechecks unresolved payments', async () => {
        const { subscriptionId, userId } = await fixture();
        const opened = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        const racingPort = {
            async hang() {},
            async countUnresolved({
                markId,
                tx
            }: {
                markId: string;
                tx: Parameters<typeof reconciliationMarkModel.bumpOpenVersion>[0]['tx'];
            }) {
                await reconciliationMarkModel.bumpOpenVersion({ markId, tx });
                return 0;
            }
        };
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 1, liftedBy: userId },
                { clock, markPayments: racingPort }
            )
        ).rejects.toMatchObject({ reason: 'MARK_VERSION_CONFLICT' });
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 2, liftedBy: userId },
                { clock, markPayments: payments(1) }
            )
        ).rejects.toMatchObject({ reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' });
        expect(
            (await reconciliationMarkModel.findById({ markId: opened.mark.id }))?.liftedAt
        ).toBeNull();
    });

    it('TEST:B3:40 default port lifts a mark with no hung payment', async () => {
        const { subscriptionId, userId } = await fixture();
        const opened = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: admin(userId),
            correlationId: crypto.randomUUID()
        });
        // Since B5 (HOS-1549) the table exists: the premise is that no payment hangs from this mark.
        const hung = await getServiceTestPool().query<{ count: string }>(
            'SELECT count(*)::text AS count FROM reconciliation_mark_payment WHERE mark_id = $1',
            [opened.mark.id]
        );
        expect(hung.rows[0]?.count).toBe('0');
        await expect(
            liftReconciliationMark(
                { markId: opened.mark.id, expectedVersion: 1, liftedBy: userId },
                { clock }
            )
        ).resolves.toMatchObject({ outcome: 'LIFTED', mark: { liftedAt: clock.now() } });
    });
});
