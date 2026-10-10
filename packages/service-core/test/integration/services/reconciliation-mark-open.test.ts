import {
    billingDeadlineVersions,
    domainEventModel,
    reconciliationMarkModel,
    subscriptionModel,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';

afterAll(closeServiceTestPool);
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
            email: `mark-${crypto.randomUUID()}@example.test`,
            displayName: 'Mark test',
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
            ['accommodation', `mark-${crypto.randomUUID()}`, 'Mark plan']
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
    return { userId: user.id, subscriptionId: row.subscription.id, optionId };
}
const actor = (id: string) => ({ type: 'admin' as const, id });

describe('TEST:B3:14 S14 reconciliation marks', () => {
    it('opens once, accumulates repeated reason events, and allows another reason', async () => {
        const { subscriptionId, userId } = await fixture();
        const before = (
            await getServiceTestPool().query(
                'SELECT status, updated_at FROM subscription WHERE id=$1',
                [subscriptionId]
            )
        ).rows[0];
        const correlationId = crypto.randomUUID();
        const first = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: actor(userId),
            correlationId
        });
        expect(first.outcome).toBe('OPENED');
        const second = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: actor(userId),
            correlationId
        });
        expect(second).toMatchObject({ outcome: 'ACCUMULATED', mark: { id: first.mark.id } });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: actor(userId),
            correlationId
        });
        const after = (
            await getServiceTestPool().query(
                'SELECT status, updated_at FROM subscription WHERE id=$1',
                [subscriptionId]
            )
        ).rows[0];
        expect(after).toEqual(before);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId }
            })
        ).toHaveLength(2);
        expect(
            (await domainEventModel.findByCorrelationId({ correlationId })).filter(
                (event) => event.eventType === 'reconciliation.mark_opened'
            )
        ).toHaveLength(3);
    });

    it('serializes ten concurrent opens onto one open mark', async () => {
        const { subscriptionId, userId } = await fixture();
        const calls = await Promise.all(
            Array.from({ length: 10 }, () =>
                openReconciliationMark({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId },
                    reason: 'DIVERGENCIA_DE_MONTO',
                    actor: actor(userId),
                    correlationId: crypto.randomUUID()
                })
            )
        );
        expect(calls.filter((call) => call.outcome === 'OPENED')).toHaveLength(1);
        expect(calls.filter((call) => call.outcome === 'ACCUMULATED')).toHaveLength(9);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId }
            })
        ).toHaveLength(1);
    });

    it('does not persist a default-port payment hang that fails', async () => {
        const { subscriptionId, userId } = await fixture();
        const correlationId = crypto.randomUUID();
        await expect(
            openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                payment: { source: 'PAYMENT', id: crypto.randomUUID() },
                actor: actor(userId),
                correlationId
            })
        ).rejects.toMatchObject({ reason: 'MARK_PAYMENTS_PORT_NOT_REGISTERED' });
        expect(
            await reconciliationMarkModel.findOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO'
            })
        ).toBeNull();
        expect(await domainEventModel.findByCorrelationId({ correlationId })).toHaveLength(0);
    });

    it('bump version before hanging a payment on an accumulated mark', async () => {
        const { subscriptionId, userId } = await fixture();
        const subject = { kind: 'SUBSCRIPTION' as const, subscriptionId };
        const first = await openReconciliationMark({
            subject,
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: actor(userId),
            correlationId: crypto.randomUUID()
        });
        const hung: string[] = [];
        const markPayments = {
            async hang({ markId }: { markId: string }) {
                hung.push(markId);
            },
            async countUnresolved() {
                return 0;
            }
        };
        const second = await openReconciliationMark(
            {
                subject,
                reason: 'DIVERGENCIA_DE_MONTO',
                payment: { source: 'PAYMENT', id: crypto.randomUUID() },
                actor: actor(userId),
                correlationId: crypto.randomUUID()
            },
            { markPayments }
        );
        expect(second.mark.version).toBe(first.mark.version + 1);
        expect(hung).toEqual([first.mark.id]);
    });

    it('TEST:B3:14 marked ACTIVE still occupies the existing user plus vertical commitment lock', async () => {
        const { subscriptionId, userId, optionId } = await fixture();
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: actor(userId),
            correlationId: crypto.randomUUID()
        });
        const before = (
            await getServiceTestPool().query(
                'SELECT count(*)::int AS count FROM subscription WHERE user_id=$1 AND vertical=$2',
                [userId, 'accommodation']
            )
        ).rows[0]?.count;
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: { now: () => new Date('2026-10-10T12:00:00.000Z') },
            honestAbout: [{ lie: 'M1', why: 'AC:B3:14 only checks the existing lock' }]
        });
        // The live ACTIVE row itself occupies the partial unique-index lock; this AC does not change startSubscription.
        await expect(
            startSubscription(
                { userId, billingOptionId: optionId, returnUrl: 'https://hospeda.example' },
                {
                    provider: fake,
                    clock: { now: () => new Date('2026-10-10T12:00:00.000Z') },
                    planPolicy: async () => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: true
                    }),
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' }
                }
            )
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        const after = (
            await getServiceTestPool().query(
                'SELECT count(*)::int AS count FROM subscription WHERE user_id=$1 AND vertical=$2',
                [userId, 'accommodation']
            )
        ).rows[0]?.count;
        expect(after).toBe(before);
    });

    it('opens a new mark and attaches the payment after the previous mark was lifted', async () => {
        const { subscriptionId, userId } = await fixture();
        const subject = { kind: 'SUBSCRIPTION' as const, subscriptionId };
        const previous = await openReconciliationMark({
            subject,
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: actor(userId),
            correlationId: crypto.randomUUID()
        });
        await reconciliationMarkModel.lift({
            markId: previous.mark.id,
            expectedVersion: 1,
            liftedBy: userId,
            now: new Date('2026-10-10T12:00:00Z')
        });
        const hung: string[] = [];
        const next = await openReconciliationMark(
            {
                subject,
                reason: 'DIVERGENCIA_DE_MONTO',
                payment: { source: 'MANUAL_PAYMENT', id: crypto.randomUUID() },
                actor: actor(userId),
                correlationId: crypto.randomUUID()
            },
            {
                markPayments: {
                    async hang({ markId }) {
                        hung.push(markId);
                    },
                    async countUnresolved() {
                        return 0;
                    }
                }
            }
        );
        expect(next.outcome).toBe('OPENED');
        expect(next.mark.id).not.toBe(previous.mark.id);
        expect(hung).toEqual([next.mark.id]);
    });

    it('rejects invalid reason, UUID and subject pair before database access', async () => {
        const tx = {
            transaction: async () => {
                throw new Error('transaction must not run');
            }
        } as never;
        const common = {
            actor: { type: 'admin' as const },
            correlationId: crypto.randomUUID(),
            tx
        };
        await expect(
            openReconciliationMark({
                ...common,
                subject: { kind: 'SUBSCRIPTION', subscriptionId: crypto.randomUUID() },
                reason: 'NO_SUCH_REASON' as never
            })
        ).rejects.toMatchObject({ reason: 'MARK_REASON_NOT_IN_CATALOG' });
        await expect(
            openReconciliationMark({
                ...common,
                subject: { kind: 'SUBSCRIPTION', subscriptionId: 'bad-id' },
                reason: 'DIVERGENCIA_DE_MONTO'
            })
        ).rejects.toMatchObject({ reason: 'MARK_INPUT_INVALID' });
        await expect(
            openReconciliationMark({
                ...common,
                subject: { kind: 'SUBSCRIPTION', subscriptionId: crypto.randomUUID() },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA'
            })
        ).rejects.toMatchObject({ reason: 'MARK_SUBJECT_REASON_MISMATCH' });
    });

    it('hangs MOT:23 from an addon instance and rejects mismatched or missing subjects', async () => {
        const { userId } = await fixture();
        const addonId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO addon (slug, name) VALUES ($1, 'Mark addon') RETURNING id",
                [`mark-addon-${crypto.randomUUID()}`]
            )
        ).rows[0]?.id;
        const versionId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
                [addonId]
            )
        ).rows[0]?.id;
        const productId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
                [versionId, addonId]
            )
        ).rows[0]?.id;
        const addonInstanceId = (
            await getServiceTestPool().query<{ id: string }>(
                "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
                [productId, versionId, userId]
            )
        ).rows[0]?.id;
        if (!addonInstanceId) throw new Error('No addon instance');
        const mark = await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId },
            reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
            actor: actor(userId),
            correlationId: crypto.randomUUID()
        });
        expect(mark.mark.addonInstanceId).toBe(addonInstanceId);
        const subscriptionId = crypto.randomUUID();
        const mismatchCorrelationId = crypto.randomUUID();
        await expect(
            openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId },
                reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
                actor: actor(userId),
                correlationId: mismatchCorrelationId
            })
        ).rejects.toMatchObject({ reason: 'MARK_SUBJECT_REASON_MISMATCH' });
        await expect(
            openReconciliationMark({
                subject: { kind: 'ADDON_INSTANCE', addonInstanceId },
                reason: 'DIVERGENCIA_DE_MONTO',
                actor: actor(userId),
                correlationId: crypto.randomUUID()
            })
        ).rejects.toMatchObject({ reason: 'MARK_SUBJECT_REASON_MISMATCH' });
        await expect(
            openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId },
                reason: 'DIVERGENCIA_DE_MONTO',
                actor: actor(userId),
                correlationId: crypto.randomUUID()
            })
        ).rejects.toMatchObject({ reason: 'MARK_SUBJECT_NOT_FOUND' });
        expect(
            await domainEventModel.findByCorrelationId({ correlationId: mismatchCorrelationId })
        ).toHaveLength(0);
    });
});
