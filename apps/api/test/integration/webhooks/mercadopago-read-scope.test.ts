import { eq, getDb, payments, subscriptions } from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    createSubjects,
    postDelivery,
    retireSubjects,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const DAY = 86_400_000;
const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(subjects, fixture.lifterId));
afterAll(async () => fixture.stop());

async function deliver(delivery: SignedDelivery) {
    subjects.deliveries.push(delivery);
    const response = await postDelivery(fixture.app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
}

async function activate() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(
        signedNotice({
            clock: fixture.clock,
            type: 'subscription_preapproval',
            id: created.authorizationId,
            version: '1'
        })
    );
    return created;
}

describe('HOS-1999 provider read scope', () => {
    it('keeps the active credited 12-record row at 15 HTTP requests (kills a bypassed B1/B2 scope)', async () => {
        const created = await activate();
        const chargeIds: string[] = [];
        for (let index = 0; index < 12; index += 1) {
            const charge = await fixture.fake.charge({
                authorizationId: created.authorizationId,
                amount: { amountMinor: 100000, currency: 'ARS' },
                reference: `read-scope-${index}-${crypto.randomUUID()}`
            });
            chargeIds.push(charge.chargeId);
            if (index === 0) {
                fixture.clock.advance({ ms: 60 * 60 * 1000 });
                await deliver(
                    signedNotice({
                        clock: fixture.clock,
                        type: 'payment',
                        id: charge.chargeId,
                        version: '1'
                    })
                );
            }
            fixture.clock.advance({ ms: 31 * DAY });
        }
        const before = fixture.server.requests().length;
        await fixture.runSweep();
        const paths = fixture.server
            .requests()
            .slice(before)
            .map(({ path }) => path);
        const inventoryRequests = paths.filter(
            (path) =>
                path.includes(`preapproval_id=${created.authorizationId}`) ||
                path === `/preapproval/${created.authorizationId}` ||
                chargeIds.some((chargeId) => path === `/v1/payments/${chargeId}`)
        );
        // Expected wire count: 15 = 1 authorization + 2 listing pages + 12 charge reads; spec baseline without memoization: 77.
        expect(inventoryRequests).toHaveLength(15);
        expect(inventoryRequests.length).toBeLessThanOrEqual(15);
        expect(
            await getDb()
                .select({ id: payments.id })
                .from(payments)
                .where(eq(payments.subscriptionId, created.subscriptionId))
        ).toHaveLength(1);
    });

    it('settles a grace row through a fresh nested act without a freshness error (AC-26)', async () => {
        const created = await activate();
        const prior = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'credited-prior'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: prior.chargeId,
                version: '1'
            })
        );
        fixture.clock.advance({ ms: 31 * DAY });
        const current = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'grace-current'
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        await fixture.fake.readCharge({ chargeId: current.chargeId });
        await getDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date(fixture.clock.now().getTime() - 9 * DAY),
                graceEndsAt: new Date(fixture.clock.now().getTime() - 1)
            })
            .where(eq(subscriptions.id, created.subscriptionId));
        const result = await fixture.runSweep();
        expect(result.details?.failedSubscriptionIds).not.toContain(created.subscriptionId);
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
    });

    it('performs two live payment reads for two webhook notices of one charge', async () => {
        const created = await activate();
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'webhook-live-read'
        });
        const before = fixture.server.requests().length;
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '1'
            })
        );
        await deliver(
            signedNotice({
                clock: fixture.clock,
                type: 'payment',
                id: charge.chargeId,
                version: '2'
            })
        );
        const liveReads = fixture.server
            .requests()
            .slice(before)
            .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`);
        expect(liveReads).toHaveLength(2);
    });
});
