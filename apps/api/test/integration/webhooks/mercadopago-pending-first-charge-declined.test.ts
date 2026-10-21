// TEST:1731:7 — the real signed payment notice closes the pending checkout signup.
import {
    billingDeadlineVersions,
    emailOutbox,
    eq,
    getDb,
    payments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import type { BillingDeadlineValues } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-12T12:00:00.000Z') });
const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
const subjects = createSubjects();
let server: FakeProviderServer;
let app: ReturnType<typeof initApp>;
let lifterId: string;

/**
 * Migration `0138_woozy_dagger.sql` owns billing deadline version 1, but every
 * `hospeda-api` integration file shares one database and runs in series, and
 * `billing-deadlines.test.ts` truncates `billing_deadline_version` after its
 * tests. The signup reads version 1, so this file recreates it instead of
 * assuming it survives (same pattern as `billing-subscription/reuse.test.ts`).
 * `onConflictDoNothing` keeps the seed idempotent and never triggers the
 * UPDATE/DELETE-only immutability trigger.
 */
const billingDeadlineVersion1Values = {
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

const ensureBillingDeadlineVersion1 = async (): Promise<void> => {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
};

const outcomeFrom = (entry: LogEntry): unknown => {
    if (
        entry.message !== 'Mercado Pago delivery received' ||
        typeof entry.data !== 'object' ||
        entry.data === null
    )
        return undefined;
    return 'outcome' in entry.data ? entry.data.outcome : undefined;
};

describe('TEST:1731:7 signed first-charge decline webhook', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
        await testDb.setup();
        await ensureBillingDeadlineVersion1();
        validateApiEnv();
        server = await startFakeProviderServer({ provider: fake, clock });
        app = initApp({
            clock,
            paymentProvider: new MercadoPagoPaymentProvider({
                clock,
                baseUrl: server.url,
                accessToken: 'test-token'
            })
        });
        lifterId = await createLifter();
    });

    afterEach(async () => {
        unregisterHook('hos1731-signed-outcome');
        await retireSubjects(subjects, lifterId);
    });

    afterAll(async () => {
        await server.close();
        await testDb.teardown();
    });

    it('processes only the signed payment notice, deduplicates redelivery and allows a new signup', async () => {
        const billingOptionId = await createSignupOption();
        const first = await signup({ app, billingOptionId, subjects });
        const declined = await fake.declineCharge({
            authorizationId: first.authorizationId,
            declineReason: 'cc_rejected_insufficient_amount'
        });
        await fake.cancel({ authorizationId: first.authorizationId });

        const outcomes: unknown[] = [];
        registerHook('hos1731-signed-outcome', (entry) => {
            const outcome = outcomeFrom(entry);
            if (outcome !== undefined) outcomes.push(outcome);
        });
        const delivery = signedNotice({
            clock,
            type: 'payment',
            id: declined.chargeId,
            version: '1'
        });
        subjects.deliveries.push(delivery);
        const response = await postDelivery(app, delivery);
        expect(response.status, await response.clone().text()).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
        expect(outcomes).toContain('S16');
        const saved = await noticeRowsOf(delivery);
        expect(saved).toHaveLength(1);
        expect(saved[0]?.channel).toBe('WEBHOOKS');

        const [row] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, first.subscriptionId));
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, first.subscriptionId));
        const [payment] = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.providerFactId, declined.chargeId));
        const mails = await getDb()
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, first.userId));
        expect(row?.status).toBe('CHARGE_DECLINED');
        expect(link?.cancelledSeenAt).toEqual(clock.now());
        expect(payment?.status).toBe('PENDING');
        expect(
            mails.filter(
                (mail) =>
                    mail.template === 'billing.signup-declined' &&
                    (mail.payload as { subscriptionId?: string }).subscriptionId ===
                        first.subscriptionId
            )
        ).toHaveLength(1);

        const repeated = await postDelivery(app, delivery);
        expect(repeated.status, await repeated.clone().text()).toBe(200);
        expect(
            await getDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, first.userId))
                .then((rows) =>
                    rows.filter(
                        (mail) =>
                            mail.template === 'billing.signup-declined' &&
                            (mail.payload as { subscriptionId?: string }).subscriptionId ===
                                first.subscriptionId
                    )
                )
        ).toHaveLength(1);

        const retry = await signup({ app, billingOptionId, subjects, userId: first.userId });
        expect(retry.authorizationId).not.toBe(first.authorizationId);
        expect(retry.subscriptionId).not.toBe(first.subscriptionId);
    });
});
