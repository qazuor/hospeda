// TEST:1676:3 (AC:1676:3) — `LIVE_PREAPPROVAL_ON_CLOSED_ROW` is registered and never answers
// `ERROR` by itself: `processProviderNotice` with the REAL `createProviderNoticeMirrorDelegates`
// over a `CANCEL_SCHEDULED` or terminal row whose preapproval the fake keeps ALIVE answers
// `ack: 'OK'` and (a) retries our decided cancellation, (b) sends the one S16 would have sent on
// a revived rejection terminal inside PLAZO:16 (recording `REJECTION_REVIVED`), or (c) marks the
// divergence (HOS-1676 H-7, H-8). The `cancelledSeenAt` the delegate decides on is the column
// BEFORE the live re-read emptied it (H-4).
//
// Cleanup: `retireSuccessionCases` lifts the marks, deletes the users' outbox rows and leaves every
// seeded row CANCELLED; the coverage losses of the users are deleted. `domain_event` is
// append-only, so the decisions stay; assertions filter by row.
import {
    and,
    coverageLosses,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    providerLinks,
    reconciliationMarks
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { handleLivePreapprovalOnClosedRow } from '../../../src/services/billing/notice/live-preapproval-on-closed-row.js';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import type { ProviderCancellationTransition } from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    createReconciliationFake,
    seedCancellationDecision,
    seedSubscription
} from './reconciliation-sweep-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    authorizationDelivery,
    retireSuccessionCases,
    type SeededSuccession,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T10:00:00.000Z');
const clock = { now: () => new Date(NOW) };
const DECIDED = 'subscription.provider_cancellation_decided';

const seeded: SeededSuccession[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    if (cases.length > 0)
        await getServiceTestDb()
            .delete(coverageLosses)
            .where(
                inArray(
                    coverageLosses.userId,
                    cases.map((c) => c.userId)
                )
            );
});
afterAll(closeServiceTestPool);

type Fake = FakePaymentProvider;

/** The receiver's ports and its real delegates, over one fake and one clock. */
function receiverPorts(input: { readonly fake: Fake; readonly clock: { now(): Date } }) {
    const ports = {
        provider: input.fake,
        clock: input.clock,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
    };
    return { ports, delegates: createProviderNoticeMirrorDelegates(ports) };
}

/** Delivers one Webhooks notice about `authorizationId` to the receiver with the REAL delegates. */
function receive(input: {
    readonly fake: Fake;
    readonly clock: { now(): Date };
    readonly authorizationId: string;
}) {
    const { ports, delegates } = receiverPorts(input);
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery: authorizationDelivery(input.authorizationId) },
        { ...ports, cancellationSeen: providerLinkCancellationSeen, delegates }
    );
}

/** A row seeded in `status`, linked to a preapproval the fake keeps alive (`active` once approved). */
async function closedRow(input: {
    readonly fake: Fake;
    readonly status: string;
    readonly cancelledSeenAt?: Date;
    readonly decision?: { readonly transition: ProviderCancellationTransition; readonly at: Date };
}) {
    const row = await seedSubscription({ status: input.status, withLink: true, fake: input.fake });
    const subscriptionId = row.subscription.id;
    const userId = row.subscription.userId;
    if (!userId || !row.providerId) throw new Error('Seeded row lacks a user or a link');
    seeded.push({ subscriptionIds: [subscriptionId], userId });
    if (input.cancelledSeenAt)
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: input.cancelledSeenAt })
            .where(eq(providerLinks.subscriptionId, subscriptionId));
    if (input.decision)
        await seedCancellationDecision({
            subscriptionId,
            transition: input.decision.transition,
            decidedAt: input.decision.at
        });
    return { subscriptionId, userId, authorizationId: row.providerId };
}

async function decisionsOf(subscriptionId: string) {
    return getServiceTestDb()
        .select({ reason: domainEvent.reason, occurredAt: domainEvent.occurredAt })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId),
                eq(domainEvent.eventType, DECIDED)
            )
        );
}

async function openReasonsOf(subscriptionId: string) {
    const marks = await getServiceTestDb()
        .select({ reason: reconciliationMarks.reason, liftedAt: reconciliationMarks.liftedAt })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    return marks.filter((mark) => mark.liftedAt === null).map((mark) => mark.reason);
}

async function cancelledSeenAtOf(subscriptionId: string) {
    const [link] = await getServiceTestDb()
        .select({ cancelledSeenAt: providerLinks.cancelledSeenAt })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    if (!link) throw new Error('Provider link disappeared');
    return link.cancelledSeenAt;
}

async function beforeCancelOutboxOf(userId: string) {
    return getServiceTestDb()
        .select({ template: emailOutbox.template })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, userId));
}

async function providerStatus(fake: Fake, authorizationId: string) {
    return (await fake.readAuthorization({ authorizationId })).snapshot.status;
}

const DELEGATED = { ack: 'OK', outcome: 'DELEGATED' } as const;

describe('TEST:1676:3 LIVE_PREAPPROVAL_ON_CLOSED_ROW is registered and answers OK (AC:1676:3)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a1) CHARGE_DECLINED with an S16 decision of 1 day ago ⇒ the fake records a new cancellation, no mark',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const row = await closedRow({
                fake,
                status: 'CHARGE_DECLINED',
                decision: { transition: 'S16', at: new Date(NOW.getTime() - DAY) }
            });
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(await providerStatus(fake, row.authorizationId)).toBe('cancelled');
            expect(await openReasonsOf(row.subscriptionId)).toEqual([]);
            expect((await decisionsOf(row.subscriptionId)).map((d) => d.reason)).toEqual(['S16']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(a2) the same row with the S16 decision of 4 days ago ⇒ CANCELACION_SIN_CONFIRMAR and ZERO cancel calls',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const row = await closedRow({
                fake,
                status: 'CHARGE_DECLINED',
                decision: { transition: 'S16', at: new Date(NOW.getTime() - 4 * DAY) }
            });
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(cancel).not.toHaveBeenCalled();
            expect(await providerStatus(fake, row.authorizationId)).toBe('active');
            expect(await openReasonsOf(row.subscriptionId)).toEqual(['CANCELACION_SIN_CONFIRMAR']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b1)(b3) CHARGE_DECLINED without a decision, cancelled_seen_at 2 days before the re-read ⇒ REJECTION_REVIVED at the re-read, the cancellation sent with its notice first, the column emptied; a second live delegate call falls to (a)',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const seenAt = new Date(NOW.getTime() - 2 * DAY);
            const row = await closedRow({
                fake,
                status: 'CHARGE_DECLINED',
                cancelledSeenAt: seenAt
            });
            const order: string[] = [];
            const realCancel = fake.cancel.bind(fake);
            const cancel = vi.spyOn(fake, 'cancel').mockImplementation(async (ref) => {
                order.push(`cancel:${(await beforeCancelOutboxOf(row.userId)).length}`);
                return realCancel(ref);
            });

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert (b1)
            expect(result).toEqual(DELEGATED);
            expect(await decisionsOf(row.subscriptionId)).toEqual([
                { reason: 'REJECTION_REVIVED', occurredAt: NOW }
            ]);
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(order).toEqual(['cancel:1']);
            expect(await beforeCancelOutboxOf(row.userId)).toEqual([
                { template: 'billing.before-cancel' }
            ]);
            expect(await providerStatus(fake, row.authorizationId)).toBe('cancelled');
            expect(await cancelledSeenAtOf(row.subscriptionId)).toBeNull();
            expect(await openReasonsOf(row.subscriptionId)).toEqual([]);

            // Act (b3): the same live input again, straight to the delegate and to the handler.
            const { ports, delegates } = receiverPorts({ fake, clock });
            const again = {
                subscriptionId: row.subscriptionId,
                readAt: NOW,
                cancelledSeenAt: seenAt
            };
            await expect(
                delegates.delegate({ pair: 'LIVE_PREAPPROVAL_ON_CLOSED_ROW', ...again })
            ).resolves.toBeUndefined();
            const direct = await handleLivePreapprovalOnClosedRow(again, ports);

            // Assert (b3)
            expect(direct).toEqual({
                outcome: 'RETRIED',
                retry: { outcome: 'CONFIRMED', read: true }
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(await decisionsOf(row.subscriptionId)).toHaveLength(1);
            expect(await openReasonsOf(row.subscriptionId)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b2) the CANCELLED the real CANCELLED_ON_GRACE delegate left (with its H-2 event) ⇒ same as b1',
        async () => {
            // Arrange: the mirror's CANCELLED after a rejection, its preapproval still alive.
            const fixture = await graceWithFailedCycle();
            const subscriptionId = fixture.started.subscriptionId;
            const authorizationId = fixture.started.authorizationId;
            seeded.push({ subscriptionIds: [subscriptionId], userId: fixture.user.id });
            const { delegates } = receiverPorts({ fake: fixture.provider, clock: fixture.clock });
            await delegates.delegate({
                pair: 'CANCELLED_ON_GRACE',
                subscriptionId,
                readAt: fixture.clock.now(),
                cancelledSeenAt: null
            });
            expect((await subscriptionRow(subscriptionId)).status).toBe('CANCELLED');
            const seenAt = new Date(fixture.clock.now().getTime() - 2 * DAY);
            await getServiceTestDb()
                .update(providerLinks)
                .set({ cancelledSeenAt: seenAt })
                .where(eq(providerLinks.subscriptionId, subscriptionId));
            const cancel = vi.spyOn(fixture.provider, 'cancel');
            const readAt = fixture.clock.now();

            // Act
            const result = await receive({
                fake: fixture.provider,
                clock: fixture.clock,
                authorizationId
            });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(await decisionsOf(subscriptionId)).toEqual([
                { reason: 'REJECTION_REVIVED', occurredAt: readAt }
            ]);
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(await beforeCancelOutboxOf(fixture.user.id)).toContainEqual({
                template: 'billing.before-cancel'
            });
            expect(await providerStatus(fixture.provider, authorizationId)).toBe('cancelled');
            expect(await cancelledSeenAtOf(subscriptionId)).toBeNull();
            expect(await openReasonsOf(subscriptionId)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c1) the b1 row with cancelled_seen_at 8 days before the re-read (PLAZO:16 elapsed) ⇒ TRANSICION_NO_DECLARADA, zero calls, zero decisions',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const row = await closedRow({
                fake,
                status: 'CHARGE_DECLINED',
                cancelledSeenAt: new Date(NOW.getTime() - 8 * DAY)
            });
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(await openReasonsOf(row.subscriptionId)).toEqual(['TRANSICION_NO_DECLARADA']);
            expect(cancel).not.toHaveBeenCalled();
            expect(await decisionsOf(row.subscriptionId)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c2) a CANCELLED of the mirror ACTIVE → CANCELLED (no H-2 event), seen 2 days before ⇒ TRANSICION_NO_DECLARADA',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const row = await closedRow({
                fake,
                status: 'CANCELLED',
                cancelledSeenAt: new Date(NOW.getTime() - 2 * DAY)
            });
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(await openReasonsOf(row.subscriptionId)).toEqual(['TRANSICION_NO_DECLARADA']);
            expect(cancel).not.toHaveBeenCalled();
            expect(await decisionsOf(row.subscriptionId)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c3) a CANCEL_SCHEDULED without a decision (S7) ⇒ TRANSICION_NO_DECLARADA',
        async () => {
            // Arrange
            const { fake } = createReconciliationFake(clock);
            const row = await closedRow({ fake, status: 'CANCEL_SCHEDULED' });
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: row.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(await openReasonsOf(row.subscriptionId)).toEqual(['TRANSICION_NO_DECLARADA']);
            expect(cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(row.subscriptionId)).status).toBe('CANCEL_SCHEDULED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c4) `pending` read on an ABANDONED row without a decision ⇒ TRANSICION_NO_DECLARADA',
        async () => {
            // Arrange: a preapproval the fake leaves `pending` (authorized, never approved).
            const { fake } = createReconciliationFake(clock);
            const row = await seedSubscription({ status: 'ABANDONED' });
            const userId = row.subscription.userId;
            if (!userId) throw new Error('Seeded row lacks a user');
            seeded.push({ subscriptionIds: [row.subscription.id], userId });
            const auth = await fake.authorize({
                reference: row.subscription.id,
                amount: { amountMinor: 250000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'TEST:1676:3 c4',
                returnUrl: 'https://example.test/return',
                payerEmail: `payer-${crypto.randomUUID()}@example.test`
            });
            await getServiceTestDb().insert(providerLinks).values({
                subscriptionId: row.subscription.id,
                provider: 'MERCADO_PAGO',
                providerId: auth.authorizationId
            });
            expect(await providerStatus(fake, auth.authorizationId)).toBe('pending');
            const cancel = vi.spyOn(fake, 'cancel');

            // Act
            const result = await receive({ fake, clock, authorizationId: auth.authorizationId });

            // Assert
            expect(result).toEqual(DELEGATED);
            expect(await openReasonsOf(row.subscription.id)).toEqual(['TRANSICION_NO_DECLARADA']);
            expect(cancel).not.toHaveBeenCalled();
            expect((await subscriptionRow(row.subscription.id)).status).toBe('ABANDONED');
        }
    );
});
