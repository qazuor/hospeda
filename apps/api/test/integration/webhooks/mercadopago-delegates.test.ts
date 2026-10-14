/**
 * TEST:1676:6 (HOS-1676, AC:1676:6): the three delegates are registered in the
 * API and one signed Webhooks notice of each case, posted to
 * `POST /api/v1/webhooks/mercadopago` of the real app (`initApp`) with the fake
 * provider served over HTTP, ends processed: `200`, its `provider_notification`
 * row, and the state its AC expects. None answers `500`.
 *
 * (1) a cancelled preapproval over a `GRACE_PERIOD` row → `CANCELLED_ON_GRACE`;
 * (2) a live preapproval over a `CHARGE_DECLINED` row seen cancelled 2 days ago →
 *     `LIVE_PREAPPROVAL_ON_CLOSED_ROW` branch (b), `REJECTION_REVIVED`;
 * (3) an unknown preapproval with no reference of ours → the receipt tombstone:
 *     this is the case that proves `handleUnknownAuthorization` has a caller in
 *     production code (HOS-1597, B11.G1);
 * (4) a charge of an unknown preapproval → the tombstone with its payment.
 *
 * Cleanup: per subject in `afterEach` (see `retireSubjects`); never TRUNCATE.
 */
import {
    and,
    billingDeadlineVersions,
    domainEventModel,
    emailOutbox,
    eq,
    getDb,
    providerLinks,
    reconciliationInventoryModel,
    subscriptions
} from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS, FakePaymentProvider } from '@repo/payments/fake';
import { type FakeProviderServer, startFakeProviderServer } from '@repo/payments/fake-server';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    createLifter,
    createSignupOption,
    createSubjects,
    legacyAuthorization,
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    rowOfAuthorization,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';

const DAY = 24 * 60 * 60 * 1000;
const clock = createAdjustableClock({ start: new Date('2026-10-12T12:00:00.000Z') });
const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
const subjects = createSubjects();
let server: FakeProviderServer;
let app: ReturnType<typeof initApp>;
let billingOptionId: string;
let lifterId: string;

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    process.env.HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET = SIGNING_KEY;
    await testDb.setup();
    validateApiEnv();
    server = await startFakeProviderServer({ provider: fake, clock });
    const mercadoPagoProvider = new MercadoPagoPaymentProvider({
        clock,
        baseUrl: server.url,
        accessToken: 'test-token'
    });
    app = initApp({ clock, paymentProvider: mercadoPagoProvider });
    // PLAZO:16 is read by case (2); without a current version it fails closed.
    await getDb()
        .insert(billingDeadlineVersions)
        .values({
            version: 1,
            values: {
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
            }
        })
        .onConflictDoNothing();
    billingOptionId = await createSignupOption();
    lifterId = await createLifter();
});

afterEach(async () => {
    vi.restoreAllMocks();
    await retireSubjects(subjects, lifterId);
});

afterAll(async () => {
    await server.close();
    await testDb.teardown();
});

/** Posts one delivery, registers it for cleanup and asserts `200` plus its stored row. */
async function deliver(delivery: SignedDelivery) {
    subjects.deliveries.push(delivery);
    const response = await postDelivery(app, delivery);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { received: true } });
    const rows = await noticeRowsOf(delivery);
    expect(rows.map((row) => row.channel)).toEqual(['WEBHOOKS']);
}

/** The due fake delivery of one resource; earlier ones are drained first by the caller. */
function dueDeliveryOf(input: { readonly type: string; readonly id: string }) {
    const delivery = server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (candidate) =>
                candidate.query.includes(`type=${input.type}`) &&
                candidate.query.includes(`data.id=${input.id}`)
        );
    if (!delivery) throw new Error(`Expected a signed ${input.type} notice of ${input.id}`);
    return delivery;
}

/** A real signup activated by the provider's approval notice: an `ACTIVE` row with its link. */
async function activeSignup() {
    const created = await signup({ app, billingOptionId, subjects });
    server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
    await fake.approve({ authorizationId: created.authorizationId });
    clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(dueDeliveryOf({ type: 'subscription_preapproval', id: created.authorizationId }));
    expect(await statusOf(created.subscriptionId)).toBe('ACTIVE');
    return created;
}

async function statusOf(subscriptionId: string) {
    const [row] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.status;
}

/**
 * A signed preapproval notice whose version follows the one the link already applied,
 * so the receiver never discards it as old.
 */
async function nextPreapprovalNotice(authorizationId: string) {
    const [link] = await getDb()
        .select({ lastAppliedVersion: providerLinks.lastAppliedVersion })
        .from(providerLinks)
        .where(eq(providerLinks.providerId, authorizationId));
    if (!link) throw new Error('Expected the signup provider link');
    return signedNotice({
        clock,
        type: 'subscription_preapproval',
        id: authorizationId,
        version: String(BigInt(link.lastAppliedVersion ?? '0') + 1n)
    });
}

/**
 * The before-cancel mails of REJECTION_REVIVED (`LIVE_AUTHORIZATION_ON_CLOSED_ROW`,
 * `billing.closed-subscription-authorization-cancel`) enqueued for one user.
 */
async function beforeCancelMails(userId: string) {
    return getDb()
        .select({ id: emailOutbox.id, status: emailOutbox.status })
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(
                    emailOutbox.template,
                    BEFORE_CANCEL_TEMPLATE_BY_KIND.LIVE_AUTHORIZATION_ON_CLOSED_ROW
                )
            )
        );
}

/** The tombstone a notice wrote for `authorizationId`, registered for cleanup. */
async function tombstoneOf(authorizationId: string) {
    const rows = await rowOfAuthorization(authorizationId);
    if (!rows) throw new Error('Expected a provider link for the tombstone');
    subjects.tombstones.add(rows.link.subscriptionId);
    return rows;
}

describe('TEST:1676:6 the three delegates are registered in the API, one notice end to end each', () => {
    it('TEST:1676:6 (1) a cancelled preapproval over a GRACE_PERIOD row ⇒ 200, CANCELLED and subscription.provider_cancelled_after_rejection', async () => {
        // Arrange: ACTIVE, one paid cycle, then a rejected cycle ⇒ GRACE_PERIOD.
        const created = await activeSignup();
        const paid = await fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'hos1676-paid-cycle'
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        await fake.readCharge({ chargeId: paid.chargeId });
        await deliver(dueDeliveryOf({ type: 'payment', id: paid.chargeId }));
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        const { chargeId } = await fake.failChargeCycle({
            authorizationId: created.authorizationId,
            declineReason: 'issuer_declined'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(dueDeliveryOf({ type: 'payment', id: chargeId }));
        expect(await statusOf(created.subscriptionId)).toBe('GRACE_PERIOD');
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });

        // Act: the provider cancels the preapproval and notifies it. The notice is built
        // by hand (the fake may hand an authorization notice to its secondary channel,
        // which Mercado Pago never sends as Webhooks): the receiver re-reads by id anyway.
        await fake.cancel({ authorizationId: created.authorizationId });
        await deliver(await nextPreapprovalNotice(created.authorizationId));

        // Assert
        expect(await statusOf(created.subscriptionId)).toBe('CANCELLED');
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: created.subscriptionId
        });
        expect(
            events
                .filter(
                    (event) => event.eventType === 'subscription.provider_cancelled_after_rejection'
                )
                .map((event) => event.reason)
        ).toEqual(['CANCELLED_ON_GRACE']);
    });

    it('TEST:B7:2 (AC:B7:4, D-8) a cancelled preapproval over the successor of a paying predecessor in grace ⇒ 200, SUSPENDED by S6, not CANCELLED', async () => {
        // Arrange: a paying predecessor (one credited cycle), cancelled as S17 leaves it.
        const predecessor = await activeSignup();
        const paid = await fake.charge({
            authorizationId: predecessor.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: 'hos1557-paid-cycle'
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        await fake.readCharge({ chargeId: paid.chargeId });
        await deliver(dueDeliveryOf({ type: 'payment', id: paid.chargeId }));
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, predecessor.subscriptionId));
        // Its successor, declared from ACTIVE: the first charge after its window (AC:B3:24).
        const successor = await signup({
            app,
            billingOptionId,
            subjects,
            userId: predecessor.userId
        });
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        await fake.approve({ authorizationId: successor.authorizationId });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(
            dueDeliveryOf({ type: 'subscription_preapproval', id: successor.authorizationId })
        );
        expect(await statusOf(successor.subscriptionId)).toBe('ACTIVE');
        const windowEndsAt = new Date(clock.now().getTime() + 3 * DAY);
        await getDb()
            .update(subscriptions)
            .set({
                succeedsId: predecessor.subscriptionId,
                authorizationWindowEndsAt: windowEndsAt,
                firstChargeAt: new Date(windowEndsAt.getTime() + DAY)
            })
            .where(eq(subscriptions.id, successor.subscriptionId));
        await getDb()
            .update(subscriptions)
            .set({ succeededById: successor.subscriptionId })
            .where(eq(subscriptions.id, predecessor.subscriptionId));
        // Its first charge is rejected ⇒ S4's successor branch opens grace.
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });
        const { chargeId } = await fake.declineCharge({
            authorizationId: successor.authorizationId,
            declineReason: 'issuer_declined'
        });
        clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        await deliver(dueDeliveryOf({ type: 'payment', id: chargeId }));
        expect(await statusOf(successor.subscriptionId)).toBe('GRACE_PERIOD');
        server.mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY });

        // Act: the provider cancels the successor's preapproval and notifies it.
        await fake.cancel({ authorizationId: successor.authorizationId });
        await deliver(await nextPreapprovalNotice(successor.authorizationId));

        // Assert: S6 by its fifth event, never the mirror.
        expect(await statusOf(successor.subscriptionId)).toBe('SUSPENDED');
        const events = await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: successor.subscriptionId
        });
        expect(
            events.filter(
                (event) => event.eventType === 'subscription.provider_cancelled_after_rejection'
            )
        ).toEqual([]);
        const arrears = await getDb()
            .select({ id: emailOutbox.id })
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, predecessor.userId),
                    eq(emailOutbox.template, 'billing.arrears-suspension')
                )
            );
        expect(arrears).toHaveLength(1);
    });

    it('TEST:1676:6 (2) a live preapproval over a CHARGE_DECLINED row seen cancelled 2 days ago ⇒ 200, REJECTION_REVIVED; once the before-cancel mail is out, the next live notice sends the cancellation to the fake', async () => {
        // Arrange: an S16 terminal without a decision whose preapproval the provider shows alive.
        const created = await activeSignup();
        await getDb()
            .update(subscriptions)
            .set({ status: 'CHARGE_DECLINED' })
            .where(eq(subscriptions.id, created.subscriptionId));
        await getDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: new Date(clock.now().getTime() - 2 * DAY) })
            .where(eq(providerLinks.providerId, created.authorizationId));
        expect(
            await reconciliationInventoryModel.findCancellationDecision({
                subscriptionId: created.subscriptionId
            })
        ).toBeNull();
        const cancel = vi.spyOn(fake, 'cancel');

        // Act: branch (b) of H-7 records the decision; the production before-cancel notice
        // only ENQUEUES the mail, so the call waits for it (NOTICE_PENDING).
        await deliver(await nextPreapprovalNotice(created.authorizationId));

        // Assert
        expect(
            (
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: created.subscriptionId
                })
            )?.transition
        ).toBe('REJECTION_REVIVED');
        const mails = await beforeCancelMails(created.userId);
        expect(mails.map((mail) => mail.status)).toEqual(['pending']);
        expect(cancel).not.toHaveBeenCalled();
        expect(await statusOf(created.subscriptionId)).toBe('CHARGE_DECLINED');

        // Act: the outbox sent the mail; the next live notice finds the decision (branch (a))
        // and retries the cancellation, which now goes out.
        await getDb()
            .update(emailOutbox)
            .set({ status: 'sent' })
            .where(eq(emailOutbox.id, mails[0]?.id ?? ''));
        await deliver(await nextPreapprovalNotice(created.authorizationId));

        // Assert
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId: created.authorizationId });
        expect(
            (await fake.readAuthorization({ authorizationId: created.authorizationId })).snapshot
                .status
        ).toBe('cancelled');
        expect(
            (
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: created.subscriptionId
                })
            )?.transition
        ).toBe('REJECTION_REVIVED');
        expect(await statusOf(created.subscriptionId)).toBe('CHARGE_DECLINED');
    });

    it('TEST:1676:6 (3) an unknown preapproval with no reference of ours ⇒ 200, LAPIDA/CANCELLED with its link, reason 6 and the cancellation in the fake', async () => {
        // Arrange
        const { authorizationId } = await legacyAuthorization(fake);
        const cancel = vi.spyOn(fake, 'cancel');

        // Act
        await deliver(
            signedNotice({
                clock,
                type: 'subscription_preapproval',
                id: authorizationId,
                version: '1'
            })
        );

        // Assert
        const rows = await tombstoneOf(authorizationId);
        expect(rows.subscription).toMatchObject({
            class: 'LAPIDA',
            status: 'CANCELLED',
            userId: null
        });
        expect(rows.links.map((link) => link.providerId)).toEqual([authorizationId]);
        expect(rows.marks.map((mark) => [mark.reason, mark.liftedAt])).toEqual([
            ['TRANSICION_NO_DECLARADA', null]
        ]);
        expect(rows.payments).toHaveLength(0);
        expect(
            (
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: rows.link.subscriptionId
                })
            )?.transition
        ).toBe('RECEPTION_TOMBSTONE');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });

    it('TEST:1676:6 (4) a charge of an unknown preapproval ⇒ 200, the tombstone with its payment hung from reason 7 and the cancellation in the fake', async () => {
        // Arrange
        const { authorizationId, reference } = await legacyAuthorization(fake);
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference
        });
        clock.advance({ ms: 60 * 60 * 1000 });
        await fake.readCharge({ chargeId });
        const cancel = vi.spyOn(fake, 'cancel');

        // Act
        await deliver(signedNotice({ clock, type: 'payment', id: chargeId, version: '1' }));

        // Assert
        const rows = await tombstoneOf(authorizationId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.payments.map((payment) => payment.providerFactId)).toEqual([chargeId]);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        expect(rows.hung.map((hung) => hung.paymentId)).toEqual([rows.payments[0]?.id]);
        expect(
            (
                await reconciliationInventoryModel.findCancellationDecision({
                    subscriptionId: rows.link.subscriptionId
                })
            )?.transition
        ).toBe('RECEPTION_TOMBSTONE');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
    });
});
