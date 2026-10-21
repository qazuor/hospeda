// TEST:1731:8 — the daily reconciliation sweep closes cancelled pending signups.
import {
    emailOutbox,
    eq,
    payments,
    providerLinks,
    reconciliationInventoryModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import {
    createPendingFirstChargeDeclineCheck,
    runReconciliationSweep
} from '../../../src/services/index.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };

async function setup({
    payment = true,
    cancel = true
}: {
    readonly payment?: boolean;
    readonly cancel?: boolean;
} = {}) {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `hos1731-sweep-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1731 sweep',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos1731-sweep-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('Missing plan');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('Missing version');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('Missing option');
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const beforeCancelNotice = { beforeCancel: vi.fn(async () => 'SENT' as const) };
    const started = await startSubscription(
        { userId: user.id, billingOptionId: optionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    const declined = await provider.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'issuer_declined'
    });
    if (payment) {
        await recordChargeFact(
            { chargeId: declined.chargeId },
            { provider, clock, beforeCancelNotice, cancellationSeen: providerLinkCancellationSeen }
        );
    }
    if (cancel) await provider.cancel({ authorizationId: started.authorizationId });
    return { userId: user.id, started, provider, beforeCancelNotice, chargeId: declined.chargeId };
}

async function ownMails(userId: string) {
    const rows = await getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
    return rows.filter((row) => row.template === 'billing.signup-declined');
}

function ports(own: Awaited<ReturnType<typeof setup>>) {
    return {
        provider: own.provider,
        clock,
        beforeCancelNotice: own.beforeCancelNotice,
        payments: creditedPaymentsFromLedger,
        coverageNotices: { emitCoverageChanged: async () => undefined },
        cancellationSeen: providerLinkCancellationSeen
    };
}

async function directInput(own: Awaited<ReturnType<typeof setup>>) {
    const [row] = await getServiceTestDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(subscriptions.id, own.started.subscriptionId));
    if (!row) throw new Error('Missing inventory row');
    const act = { kind: 'decision' as const, startedAt: clock.now() };
    const read = await own.provider.readAuthorization({
        authorizationId: own.started.authorizationId
    });
    return { ...row, act, read };
}

async function onlyOwn<T>(subscriptionId: string, callback: () => Promise<T>) {
    const original = reconciliationInventoryModel.listSweepInventoryPage.bind(
        reconciliationInventoryModel
    );
    const spy = vi.spyOn(reconciliationInventoryModel, 'listSweepInventoryPage');
    spy.mockImplementation(async (input) =>
        (await original({ ...input, limit: 10000 }))
            .filter(({ subscription }) => subscription.id === subscriptionId)
            .filter(
                ({ subscription }) =>
                    input.afterSubscriptionId === undefined ||
                    subscription.id > input.afterSubscriptionId
            )
            .slice(0, input.limit)
    );
    try {
        return await callback();
    } finally {
        spy.mockRestore();
    }
}

describe('TEST:1731:8 pending first charge reconciliation', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — closes a cancelled pending row from its pending fact',
        async () => {
            const own = await setup();
            const result = await createPendingFirstChargeDeclineCheck(ports(own))(
                await directInput(own)
            );
            expect(result).toBeUndefined();
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, own.started.subscriptionId));
            const [fact] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, own.chargeId));
            expect(row?.status).toBe('CHARGE_DECLINED');
            expect(fact?.status).toBe('PENDING');
            expect(await ownMails(own.userId)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — leaves a live authorization untouched',
        async () => {
            const own = await setup({ cancel: false });
            const cancel = vi.spyOn(own.provider, 'cancel');
            const readCharge = vi.spyOn(own.provider, 'readCharge');
            await createPendingFirstChargeDeclineCheck(ports(own))(await directInput(own));
            expect(cancel).not.toHaveBeenCalled();
            expect(readCharge).not.toHaveBeenCalled();
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, own.started.subscriptionId));
            expect(row?.status).toBe('PENDING_AUTHORIZATION');
            expect(await ownMails(own.userId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — leaves a cancelled row without a payment fact for S3',
        async () => {
            const own = await setup({ payment: false });
            await createPendingFirstChargeDeclineCheck(ports(own))(await directInput(own));
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, own.started.subscriptionId));
            expect(row?.status).toBe('PENDING_AUTHORIZATION');
            expect(await ownMails(own.userId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — repeated checks do not enqueue another notice',
        async () => {
            const own = await setup();
            const check = createPendingFirstChargeDeclineCheck(ports(own));
            await check(await directInput(own));
            await check(await directInput(own));
            expect(await ownMails(own.userId)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('e — does not close an ACTIVE row', async () => {
        const own = await setup();
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, own.started.subscriptionId));
        await createPendingFirstChargeDeclineCheck(ports(own))(await directInput(own));
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, own.started.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
        expect(await ownMails(own.userId)).toHaveLength(0);
    });

    it.skipIf(!isServiceTestDbAvailable())(
        'f — the full sweep closes the row without a failed row',
        async () => {
            const own = await setup();
            const summary = await onlyOwn(own.started.subscriptionId, () =>
                runReconciliationSweep(
                    {},
                    {
                        provider: own.provider,
                        clock,
                        rowChecks: [createPendingFirstChargeDeclineCheck(ports(own))]
                    }
                )
            );
            expect(summary.rowsFailed).toBe(0);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, own.started.subscriptionId));
            expect(row?.status).toBe('CHARGE_DECLINED');
        }
    );
});
