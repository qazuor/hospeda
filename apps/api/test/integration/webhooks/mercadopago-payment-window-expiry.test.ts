/** TEST:1710:9 AC:1710:8 proves expiry through the real adapter over fake HTTP. */
import { and, eq, getDb, payments } from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { paymentWindowExpiryJob } from '../../../src/cron/jobs/payment-window-expiry.job';
import {
    createSubjects,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;
beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(subjects, fixture.lifterId));
afterAll(async () => fixture.stop());

async function deliver(type: 'subscription_preapproval' | 'payment', id: string) {
    const candidate = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (item) => item.query.includes(`type=${type}`) && item.query.includes(`data.id=${id}`)
        );
    const delivery: SignedDelivery =
        candidate ?? signedNotice({ clock: fixture.clock, type, id, version: String(Date.now()) });
    subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
}
async function runJob() {
    return paymentWindowExpiryJob.handler({
        logger: { info() {}, warn() {}, error() {}, debug() {} },
        startedAt: fixture.clock.now(),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun: false
    });
}
async function rowStatus(subscriptionId: string, chargeId: string) {
    const [row] = await getDb()
        .select({ status: payments.status })
        .from(payments)
        .where(
            and(eq(payments.subscriptionId, subscriptionId), eq(payments.providerFactId, chargeId))
        );
    return row?.status;
}

describe('TEST:1710:9 AC:1710:8 payment window expiry job over fake HTTP', () => {
    it('TEST:1710:9 AC:1710:8 keeps a rejected renewal pending until its window closes', async () => {
        const created = await signup({
            app: fixture.app,
            billingOptionId: fixture.billingOptionId,
            subjects
        });
        await fixture.fake.approve({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver('subscription_preapproval', created.authorizationId);
        const first = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `window-opening-${crypto.randomUUID()}`
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await deliver('payment', first.chargeId);
        const failed = await fixture.fake.failChargeCycle({
            authorizationId: created.authorizationId,
            declineReason: 'issuer_declined'
        });
        const expiresAt = (await fixture.fake.readCharge(failed)).snapshot.expiresAt;
        expect(expiresAt).toEqual(expect.any(String));
        await deliver('payment', failed.chargeId);
        expect(await rowStatus(created.subscriptionId, failed.chargeId)).toBe('PENDING');
        fixture.clock.set({ at: new Date(Date.parse(expiresAt!) - 60_000) });
        await runJob();
        expect(await rowStatus(created.subscriptionId, failed.chargeId)).toBe('PENDING');
        fixture.clock.set({ at: new Date(Date.parse(expiresAt!) + 60_000) });
        await runJob();
        expect(await rowStatus(created.subscriptionId, failed.chargeId)).toBe('FAILED');
    });
});
