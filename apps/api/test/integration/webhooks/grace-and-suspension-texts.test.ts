import {
    and,
    emailOutbox,
    eq,
    getDb,
    inArray,
    payments,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptions
} from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildOutboxSenderRender } from '../../../src/cron/jobs/email-outbox-sender.job';
import {
    createSubjects,
    noticeRowsOf,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    type SignedDelivery,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const subjects = createSubjects();
const promoIds: string[] = [];
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;
const render = buildOutboxSenderRender({ siteUrl: 'https://hospeda.test' });

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => {
    const userIds = [...subjects.users];
    await retireSubjects(subjects, fixture.lifterId);
    if (userIds.length)
        await getDb().delete(promoRedemptions).where(inArray(promoRedemptions.userId, userIds));
    if (promoIds.length)
        await getDb()
            .delete(promoCodes)
            .where(inArray(promoCodes.id, promoIds.splice(0)));
});
afterAll(async () => fixture.stop());

async function delivery(
    type: 'subscription_preapproval' | 'payment',
    id: string
): Promise<SignedDelivery> {
    const candidate = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (item) => item.query.includes(`type=${type}`) && item.query.includes(`data.id=${id}`)
        );
    if (candidate) return candidate;
    const [link] = await getDb()
        .select({ lastAppliedVersion: providerLinks.lastAppliedVersion })
        .from(providerLinks)
        .where(eq(providerLinks.providerId, id));
    if (!link) throw new Error(`Missing provider link for ${id}`);
    return signedNotice({
        clock: fixture.clock,
        type,
        id,
        version: String(BigInt(link.lastAppliedVersion ?? '0') + 1n)
    });
}

async function deliver(input: SignedDelivery) {
    subjects.deliveries.push(input);
    const response = await postDelivery(fixture.app, input);
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await noticeRowsOf(input)).map((row) => row.channel)).toEqual(['WEBHOOKS']);
}

async function createGrace() {
    const created = await signup({
        app: fixture.app,
        billingOptionId: fixture.billingOptionId,
        subjects
    });
    await fixture.fake.approve({ authorizationId: created.authorizationId });
    fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
    await deliver(await delivery('subscription_preapproval', created.authorizationId));
    const paid = await fixture.fake.charge({
        authorizationId: created.authorizationId,
        amount: { amountMinor: 100000, currency: 'ARS' },
        reference: `hos1617-paid-${crypto.randomUUID()}`
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver(await delivery('payment', paid.chargeId));
    expect(
        await getDb()
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, created.subscriptionId))
    ).toHaveLength(1);
    const rejected = await fixture.fake.declineCharge({
        authorizationId: created.authorizationId,
        declineReason: 'issuer_declined'
    });
    fixture.clock.advance({ ms: 60 * 60 * 1000 });
    await deliver(await delivery('payment', rejected.chargeId));
    return created;
}

async function seedPromo(userId: string, subscriptionId: string) {
    const [code] = await getDb()
        .insert(promoCodes)
        .values({
            code: `HOS1617-${crypto.randomUUID()}`,
            discountKind: 'PERCENTAGE',
            value: 10,
            allVerticals: true,
            verticals: null,
            totalQuota: 10,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        })
        .returning({ id: promoCodes.id });
    if (!code) throw new Error('promo code missing');
    promoIds.push(code.id);
    await getDb().insert(promoRedemptions).values({
        promoCodeId: code.id,
        userId,
        subscriptionId,
        redeemedAt: fixture.clock.now(),
        remainingCharges: 2
    });
}

async function suspendedMail(created: Awaited<ReturnType<typeof createGrace>>, withPromo: boolean) {
    if (withPromo) await seedPromo(created.userId, created.subscriptionId);
    const [grace] = await getDb()
        .select({ graceEndsAt: subscriptions.graceEndsAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    if (!grace?.graceEndsAt) throw new Error('grace end missing');
    fixture.clock.set({ at: new Date(grace.graceEndsAt.getTime() + 1000) });
    await fixture.runSweep();
    await fixture.markOutboxSent({
        userId: created.userId,
        template: 'billing.arrears-suspension'
    });
    await fixture.runSweep();
    const [subscription] = await getDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, created.subscriptionId));
    expect(subscription?.status).toBe('SUSPENDED');
    const [row] = await getDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, created.userId),
                eq(emailOutbox.template, 'billing.arrears-suspension')
            )
        );
    if (!row) throw new Error('arrears suspension notice missing');
    return renderToStaticMarkup((await render({ row })).react);
}

describe('TEST:B13a:2 grace and suspension mail contract', () => {
    it('renders the grace end and card retry assurances, then includes promo loss only with a live promo', async () => {
        const created = await createGrace();
        const [grace] = await getDb()
            .select({ graceEndsAt: subscriptions.graceEndsAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, created.subscriptionId));
        if (!grace?.graceEndsAt) throw new Error('grace end missing');
        const [graceMail] = await getDb()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, created.userId),
                    eq(emailOutbox.template, 'billing.grace-started')
                )
            );
        if (!graceMail) throw new Error('grace notice missing');
        expect(
            await getDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, created.userId),
                        eq(emailOutbox.template, 'billing.grace-started')
                    )
                )
        ).toHaveLength(1);
        const graceHtml = renderToStaticMarkup((await render({ row: graceMail })).react);
        const marketDate = new Intl.DateTimeFormat('es-AR', {
            timeZone: 'America/Argentina/Buenos_Aires',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(grace.graceEndsAt);
        expect(graceHtml).toContain(marketDate);
        expect(graceHtml).toContain('el cobro se vuelve a intentar en el momento');
        expect(graceHtml).toContain('No podemos asegurarte que entre');
        expect(graceHtml).toContain('volver a suscribirte');

        const promoHtml = await suspendedMail(created, true);
        expect(promoHtml).toContain('Si tenías una promo, al volver la perdés.');
        const withoutPromo = await createGrace();
        const noPromoHtml = await suspendedMail(withoutPromo, false);
        expect(noPromoHtml).not.toContain('Si tenías una promo, al volver la perdés.');
    });
});
