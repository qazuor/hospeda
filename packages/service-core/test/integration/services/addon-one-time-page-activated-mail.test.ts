/**
 * HOS-2405 (owner, 2026-11-20): when a one-time add-on bought on a payment page becomes ACTIVE,
 * its owner gets exactly one «tu destaque está activo» mail through the outbox, whichever entry
 * activated it (the provider's notice or A3's search by reference, the late path of P-1). The
 * recipient is the account that owns the instance, never the payer's declared email, and a
 * failure to enqueue the mail never undoes the activation. Runs end to end with the fake, lies on.
 */
import { and, emailOutbox, emailOutboxModel, eq, sql, subscriptions, users } from '@repo/db';
import type { NoticeDelivery } from '@repo/payments';
import { FAKE_NOTICE_CHANNEL_HEADER } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../src/services/billing/addon/addon-instance-a2-one-time-page';
import { expireOneTimePageAddon } from '../../../src/services/billing/addon/expire-addon-authorization-windows-one-time';
import {
    enqueueOneTimeAddonActivatedNotice,
    ONE_TIME_ADDON_ACTIVATED_TEMPLATE
} from '../../../src/services/billing/addon/one-time-addon-activated-notice';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import {
    boughtPage,
    pageInstance,
    pagePayments,
    pageSetup,
    retirePageMarks
} from './support/one-time-page-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Setup = Awaited<ReturnType<typeof pageSetup>>;
type Instance = Awaited<ReturnType<typeof boughtPage>>['instance'];

/** A paying owner buying a LISTING one-time add-on for one of their accommodations on a page. */
async function listingPageSetup(): Promise<Setup & { readonly listingId: string }> {
    const f = await purchaseFixture({ scopeType: 'LISTING' });
    await payingPrincipal(f);
    const listingId = crypto.randomUUID();
    f.setListing(listingId, {
        vertical: VerticalEnum.ACCOMMODATION,
        ownerId: f.ownerId,
        acceptsFeature: true
    });
    const request = { ...f.input(crypto.randomUUID(), listingId), oneTimeChannel: 'PAGE' as const };
    const ports = {
        ...f.ports,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) }
    };
    return { f, request, ports, listingId };
}

/** Hands the given Webhooks deliveries to the receiver, wired as the API wires it. */
async function deliver(s: Setup, deliveries: readonly NoticeDelivery[]) {
    const answers = [];
    for (const delivery of deliveries)
        answers.push(
            await receiveProviderDelivery(
                {
                    url: 'https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks',
                    delivery
                },
                {
                    provider: s.f.fake,
                    clock: s.f.ports.clock,
                    beforeCancelNotice: s.ports.beforeCancelNotice,
                    coverageNotices: s.ports.coverageNotices,
                    complements: { addonPolicy: s.f.ports.addonPolicy, listing: s.f.ports.listing }
                }
            )
        );
    return answers;
}

/** The due primary-channel deliveries, taken from the fake. */
function takeDue(s: Setup): readonly NoticeDelivery[] {
    return s.f.fake
        .takeDeliveries()
        .deliveries.filter(
            (delivery: NoticeDelivery) =>
                delivery.headers[FAKE_NOTICE_CHANNEL_HEADER] !== 'secondary'
        );
}

/** Every activated mail of this instance (any recipient), so a misaddressed row is seen too. */
async function activatedMails(instance: Instance) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, ONE_TIME_ADDON_ACTIVATED_TEMPLATE),
                sql`${emailOutbox.payload}->>'addonInstanceId' = ${instance.id}`
            )
        );
}

async function ownerEmail(instance: Instance): Promise<string> {
    const [owner] = await getServiceTestDb()
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, instance.ownerId));
    if (!owner?.email) throw new Error('owner email missing');
    return owner.email;
}

/** The payer email the owner DECLARED on their principal subscription's checkout. */
async function declaredPayerEmail(ownerId: string): Promise<string | null> {
    const [row] = await getServiceTestDb()
        .select({ declared: subscriptions.declaredPayerEmail })
        .from(subscriptions)
        .where(eq(subscriptions.userId, ownerId))
        .limit(1);
    return row?.declared ?? null;
}

describe('HOS-2405 the owner is mailed once when a one-time page add-on activates', () => {
    it.skipIf(skip)(
        'activation by the notice writes one row to the owner naming add-on, listing and expiry',
        async () => {
            // Arrange
            const s = await listingPageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            expect(await activatedMails(instance)).toHaveLength(0);

            // Act
            const answers = await deliver(s, takeDue(s));

            // Assert
            expect(answers.map((answer) => answer.outcome)).toContain('ADDON_PAYMENT_ACTIVATED');
            const active = await pageInstance(instance.id);
            expect(active.status).toBe('ACTIVE');
            const mails = await activatedMails(instance);
            expect(mails).toHaveLength(1);
            expect(mails[0]).toMatchObject({
                recipientUserId: instance.ownerId,
                recipientEmail: await ownerEmail(instance),
                status: 'pending'
            });
            expect(mails[0]?.payload).toEqual({
                addonInstanceId: instance.id,
                locale: 'es',
                addonSlug: expect.any(String),
                addonName: expect.any(String),
                listingId: s.listingId,
                vertical: 'accommodation',
                endsAt: active.endsAt?.toISOString()
            });
            expect(active.endsAt).not.toBeNull();
            expect(mails[0]?.dedupKey).toContain(instance.id);
        }
    );

    it.skipIf(skip)('activation by A3 (the late path) writes one row too', async () => {
        // Arrange
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        // The notice never arrives: A3 finds the payment by its reference.
        s.f.fake.takeDeliveries();

        // Act
        const result = await expireOneTimePageAddon({ instanceId: instance.id }, s.ports);

        // Assert
        expect(result).toBe('ACTIVATED');
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        const mails = await activatedMails(instance);
        expect(mails).toHaveLength(1);
        // A USER-scoped add-on targets no listing: the mail names none.
        expect(mails[0]?.payload).toMatchObject({ listingId: null, vertical: null });
    });

    it.skipIf(skip)(
        'the notice, A3 and a direct re-enqueue for the same instance leave ONE row',
        async () => {
            // Arrange
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
            const deliveries = takeDue(s);

            // Act: A3 activates first (the notice was late), then the notice and A3 come again.
            const late = await expireOneTimePageAddon({ instanceId: instance.id }, s.ports);
            const answers = await deliver(s, deliveries);
            const lateAgain = await expireOneTimePageAddon({ instanceId: instance.id }, s.ports);
            const again = await confirmOneTimePagePayment(
                { instanceId: instance.id, chargeId: paid.chargeId },
                s.ports
            );
            const reEnqueued = await getServiceTestDb().transaction((tx) =>
                enqueueOneTimeAddonActivatedNotice({ tx, instanceId: instance.id, listing: null })
            );

            // Assert
            expect(late).toBe('ACTIVATED');
            expect(answers.map((answer) => answer.outcome)).toContain(
                'ADDON_PAYMENT_ALREADY_CONFIRMED'
            );
            expect(lateAgain).toBe('DEFERRED');
            expect(again).toEqual({ outcome: 'ALREADY_CONFIRMED' });
            expect(reEnqueued).toEqual({ outcome: 'ALREADY_ENQUEUED' });
            expect(await pagePayments(instance.id)).toHaveLength(1);
            expect(await activatedMails(instance)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        'goes to the owner account, not to the payer email declared on checkout',
        async () => {
            // Arrange
            const s = await pageSetup();
            const { instance, paymentPageId } = await boughtPage(s);
            const declared = await declaredPayerEmail(instance.ownerId);
            const owner = await ownerEmail(instance);
            expect(declared).toBe('payer@example.test');
            expect(declared).not.toBe(owner);
            s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });

            // Act
            await deliver(s, takeDue(s));

            // Assert
            const mails = await activatedMails(instance);
            expect(mails).toHaveLength(1);
            expect(mails[0]?.recipientEmail).toBe(owner);
            expect(mails[0]?.recipientUserId).toBe(instance.ownerId);
        }
    );

    it.skipIf(skip)('writes the payload in the owner account locale', async () => {
        // Arrange
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        await getServiceTestDb()
            .update(users)
            .set({
                settings: sql`coalesce(${users.settings}, '{}'::jsonb) || '{"languageWeb":"pt"}'`
            })
            .where(eq(users.id, instance.ownerId));
        s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });

        // Act
        await deliver(s, takeDue(s));

        // Assert
        const [mail] = await activatedMails(instance);
        expect(mail?.payload).toMatchObject({ locale: 'pt' });
    });

    it.skipIf(skip)('a failure to enqueue the mail does not undo the activation', async () => {
        // Arrange
        const s = await pageSetup();
        const { instance, paymentPageId } = await boughtPage(s);
        const paid = s.f.fake.payOnPage({ paymentPageId, outcome: 'approved' });
        const original = emailOutboxModel.enqueue.bind(emailOutboxModel);
        vi.spyOn(emailOutboxModel, 'enqueue').mockImplementation(async (input, tx) => {
            if (input.template === ONE_TIME_ADDON_ACTIVATED_TEMPLATE)
                throw new Error('outbox unavailable');
            return original(input, tx);
        });

        // Act
        const result = await confirmOneTimePagePayment(
            { instanceId: instance.id, chargeId: paid.chargeId },
            s.ports
        );

        // Assert
        expect(result).toMatchObject({ outcome: 'ACTIVATED' });
        expect((await pageInstance(instance.id)).status).toBe('ACTIVE');
        const [payment] = await pagePayments(instance.id);
        expect(payment?.providerFactId).toBe(paid.chargeId);
        expect(payment?.status).toBe('SUCCEEDED');
        expect(await activatedMails(instance)).toHaveLength(0);
    });
});
