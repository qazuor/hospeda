// HOS-1676, AC:1676:4 (TEST:1676:4): the Webhooks receiver hands an authorization with no
// `provider_link` to `handleUnknownAuthorization` (B11 §2.4). Every case goes through
// `processProviderNotice`, never through the handler directly: mutation (1) of the run, which
// deletes the receiver's call, is what proves the call comes from production code.
//
// Cleanup: the marks these notices open are lifted and their hung payments resolved in
// `afterEach`; the seeded rows are taken to CANCELLED. Receipt tombstones are born CANCELLED and
// `domain_event` is append-only, so both stay; every assertion filters by the subject's rows.
import {
    and,
    eq,
    inArray,
    isNull,
    payments,
    providerLinks,
    reconciliationInventoryModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import type { ProviderNotice } from '@repo/payments';
import { encodeFakeNotice } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type ProcessProviderNoticePorts,
    processProviderNotice
} from '../../../src/services/billing/notice/process-provider-notice.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { reconciliationClock, seedSubscription } from './reconciliation-sweep-fixtures.js';
import {
    createChargingFake,
    tombstoneRows,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';

/**
 * The receiver exposes no `probeManifest` port, so the probe case goes through the handler's
 * DEFAULT, the versioned module: it is replaced here by a manifest whose ids each test fills.
 */
const probes = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock('@repo/payments', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/payments')>();
    return { ...original, PROBE_MANIFEST: probes };
});

const subjects = new Set<string>();
const seeded = new Set<string>();
let lifterId: string;

beforeAll(async () => {
    const [lifter] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `unknown-notice-lifter-${crypto.randomUUID()}@example.test`,
            displayName: 'Unknown notice lifter',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!lifter) throw new Error('missing lifter');
    lifterId = lifter.id;
});
afterAll(closeServiceTestPool);
beforeEach(() => {
    vi.restoreAllMocks();
    probes.ids.length = 0;
});
afterEach(async () => {
    const db = getServiceTestDb();
    const ids = [...subjects, ...seeded];
    subjects.clear();
    if (ids.length > 0) {
        const marks = await db
            .select({ id: reconciliationMarks.id })
            .from(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, ids));
        const markIds = marks.map((mark) => mark.id);
        if (markIds.length > 0)
            await db
                .update(reconciliationMarkPayments)
                .set({ resolvedAt: new Date() })
                .where(
                    and(
                        inArray(reconciliationMarkPayments.markId, markIds),
                        isNull(reconciliationMarkPayments.resolvedAt)
                    )
                );
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: lifterId })
            .where(
                and(
                    inArray(reconciliationMarks.subscriptionId, ids),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    }
    if (seeded.size > 0)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, [...seeded]));
    seeded.clear();
});

const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };

function webhook(notice: ProviderNotice) {
    return {
        channel: 'WEBHOOKS' as const,
        delivery: {
            headers: { 'content-type': 'application/json' },
            body: encodeFakeNotice({ notice, format: 'json' }).body
        }
    };
}

function receiverPorts(
    provider: ProcessProviderNoticePorts['provider']
): ProcessProviderNoticePorts {
    return { provider, clock: reconciliationClock, beforeCancelNotice };
}

async function legacyAuthorization(
    fake: ReturnType<typeof createChargingFake>['fake'],
    reference = `legacy-${crypto.randomUUID()}`
) {
    const { authorizationId } = await fake.authorize({
        reference,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'unknown authorization notice',
        returnUrl: 'https://example.test/return',
        payerEmail: `legacy-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId });
    return authorizationId;
}

async function linkOf(authorizationId: string) {
    const [link] = await getServiceTestDb()
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.providerId, authorizationId));
    return link;
}

async function chargePayments(chargeId: string) {
    return getServiceTestDb()
        .select()
        .from(payments)
        .where(and(eq(payments.provider, 'MERCADO_PAGO'), eq(payments.providerFactId, chargeId)));
}

/** The tombstone a notice wrote for `authorizationId`, read through its link. */
async function tombstoneOf(authorizationId: string) {
    const link = await linkOf(authorizationId);
    if (!link) throw new Error('Expected a provider link for the tombstone');
    subjects.add(link.subscriptionId);
    return { subscriptionId: link.subscriptionId, rows: await tombstoneRows(link.subscriptionId) };
}

describe('TEST:1676:4 the receiver hands an unknown authorization to the B11 handler', () => {
    it('TEST:1676:4 (i) an unknown preapproval with no reference of ours ⇒ LAPIDA/CANCELLED with its link, reason 6, RECEPTION_TOMBSTONE and the cancellation', async () => {
        const { fake, provider } = createChargingFake();
        const authorizationId = await legacyAuthorization(fake);
        const cancel = vi.spyOn(fake, 'cancel');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'TOMBSTONE_WRITTEN' });
        const { subscriptionId, rows } = await tombstoneOf(authorizationId);
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
            (await reconciliationInventoryModel.findCancellationDecision({ subscriptionId }))
                ?.transition
        ).toBe('RECEPTION_TOMBSTONE');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });

    it('TEST:1676:4 (ii) a manifest probe (the handler default) ⇒ tombstone and mark, ZERO cancellations and no decision', async () => {
        const { fake, provider } = createChargingFake();
        const authorizationId = await legacyAuthorization(fake);
        probes.ids.push(authorizationId);
        const cancel = vi.spyOn(fake, 'cancel');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'TOMBSTONE_WRITTEN' });
        const { subscriptionId, rows } = await tombstoneOf(authorizationId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['TRANSICION_NO_DECLARADA']);
        expect(
            await reconciliationInventoryModel.findCancellationDecision({ subscriptionId })
        ).toBeNull();
        expect(cancel).not.toHaveBeenCalled();
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('active');
    });

    it('TEST:1676:4 (iii) a preapproval naming our row with no link ⇒ RELINKED, the link written and the row unchanged', async () => {
        const { fake, provider } = createChargingFake();
        const owned = await seedSubscription({ status: 'ACTIVE' });
        seeded.add(owned.subscription.id);
        subjects.add(owned.subscription.id);
        const [before] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, owned.subscription.id));
        const authorizationId = await legacyAuthorization(fake, owned.subscription.id);
        const cancel = vi.spyOn(fake, 'cancel');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: authorizationId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'RELINKED' });
        expect(await linkOf(authorizationId)).toMatchObject({
            subscriptionId: owned.subscription.id,
            provider: 'MERCADO_PAGO'
        });
        const [after] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, owned.subscription.id));
        expect(after).toEqual(before);
        expect(
            await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, owned.subscription.id))
        ).toHaveLength(0);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:1676:4 (iv) a CHARGE of an unknown preapproval ⇒ tombstone, its payment hung, reason 7 and the cancellation', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'charge', resourceId: chargeId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'TOMBSTONE_WRITTEN' });
        const { subscriptionId, rows } = await tombstoneOf(authorizationId);
        expect(rows.subscription).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(rows.payments.map((payment) => payment.providerFactId)).toEqual([chargeId]);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        expect(rows.hung.map((hung) => hung.paymentId)).toEqual([rows.payments[0]?.id]);
        expect(
            (await reconciliationInventoryModel.findCancellationDecision({ subscriptionId }))
                ?.transition
        ).toBe('RECEPTION_TOMBSTONE');
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
    });

    it('TEST:1676:4 (v) a CHARGE of a preapproval naming a row with a LIVE link ⇒ reason 7 on that row, no payment hung (H-11 A)', async () => {
        const { fake, provider } = createChargingFake();
        const owned = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        seeded.add(owned.subscription.id);
        subjects.add(owned.subscription.id);
        const { authorizationId, chargeId } = await unknownCharge(fake, {
            reference: owned.subscription.id
        });
        const cancel = vi.spyOn(fake, 'cancel');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'charge', resourceId: chargeId, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'DIVERGENCE_MARKED' });
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, owned.subscription.id));
        expect(marks.map((mark) => [mark.reason, mark.liftedAt])).toEqual([
            ['PAGO_TARDIO_RECHAZADO', null]
        ]);
        expect(
            await getServiceTestDb()
                .select()
                .from(reconciliationMarkPayments)
                .where(
                    inArray(
                        reconciliationMarkPayments.markId,
                        marks.map((mark) => mark.id)
                    )
                )
        ).toHaveLength(0);
        expect(await chargePayments(chargeId)).toHaveLength(0);
        expect(await linkOf(authorizationId)).toBeUndefined();
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, owned.subscription.id))
        ).toHaveLength(1);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:1676:4 (vi) a resource the provider does not have ⇒ ack OK UNKNOWN_RESOURCE, nothing written', async () => {
        const { fake, provider } = createChargingFake();
        const missing = `missing-${crypto.randomUUID()}`;
        const reads = vi.spyOn(fake, 'readAuthorization');

        const answer = await processProviderNotice(
            webhook({ resourceKind: 'authorization', resourceId: missing, version: '1' }),
            receiverPorts(provider)
        );

        expect(answer).toEqual({ ack: 'OK', outcome: 'UNKNOWN_RESOURCE' });
        expect(reads).toHaveBeenCalledTimes(1);
        expect(await linkOf(missing)).toBeUndefined();
    });

    it('TEST:1676:4 (vii) the notice of (i) repeated ⇒ one tombstone; the second finds the link and answers NOOP', async () => {
        const { fake, provider } = createChargingFake();
        const authorizationId = await legacyAuthorization(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const notice = webhook({
            resourceKind: 'authorization',
            resourceId: authorizationId,
            version: '1'
        });

        const first = await processProviderNotice(notice, receiverPorts(provider));
        const second = await processProviderNotice(notice, receiverPorts(provider));

        expect(first).toEqual({ ack: 'OK', outcome: 'TOMBSTONE_WRITTEN' });
        // The link now exists, so the second notice takes the known path: the re-read sees the
        // preapproval cancelled against a CANCELLED row, which the mirror grid leaves alone.
        expect(second).toEqual({ ack: 'OK', outcome: 'NOOP' });
        const links = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.providerId, authorizationId));
        expect(links).toHaveLength(1);
        const { rows } = await tombstoneOf(authorizationId);
        expect(rows.marks).toHaveLength(1);
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
