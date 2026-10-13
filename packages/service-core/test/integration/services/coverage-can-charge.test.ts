// TEST:B4:4 (AC:B4:5) and TEST:B4:5 (AC:B4:6) — the real `puedeCobrarle` answers on the
// cancellation confirmed by the provider (provider_link.cancelled_seen_at), not on the row's
// state; an open CANCELACION_SIN_CONFIRMAR mark answers yes; and a CHARGE_DECLINED keeps counting
// for the 16th deadline (7 days) from that column (contract §4.1; DEC-ARCH-006📌10/📌11).
//
// Cleanup: rows seeded directly are DELETED after each test (reconciliation_mark, provider_link,
// subscription, children first); rows created by the real signup are left terminal (CANCELLED).
// Users and the non-sellable plan versions stay (plan versions are immutable).
import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingDeadlineVersions,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    reconciliationMarks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import type { AuthorizationSnapshot, PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBillingCanCharge } from '../../../src/services/billing/coverage/can-charge.js';
import { getCurrentBillingDeadlines } from '../../../src/services/billing/deadlines/billing-deadlines.service.js';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { declineFirstCharge } from '../../../src/services/billing/subscription/decline-first-charge.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    frozenClock,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { billingDeadlineValues } from './support/payment-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const T = new Date('2026-10-02T10:00:00.000Z');

/** Rows seeded directly: deleted after each test, children first. */
const seeded: string[] = [];
/** Rows the real signup created: left terminal after each test. */
const handled: string[] = [];

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
});

afterEach(async () => {
    const db = getServiceTestDb();
    if (seeded.length > 0) {
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, seeded));
        await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, seeded));
        await db.delete(subscriptions).where(inArray(subscriptions.id, seeded));
    }
    if (handled.length > 0)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(
                and(
                    inArray(subscriptions.id, handled),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            );
    seeded.length = 0;
    handled.length = 0;
});
afterAll(closeServiceTestPool);

function adjustableClock(start = new Date('2026-10-01T03:00:00.000Z')) {
    let at = start.getTime();
    return {
        now: () => new Date(at),
        advance: (ms: number) => {
            at += ms;
        }
    };
}
type TestClock = ReturnType<typeof adjustableClock>;

function canChargeAt(clock: Clock) {
    return createBillingCanCharge({ ports: { clock } });
}

/** One account with one subscription seeded directly, optionally linked to the provider. */
async function seedAccount(input: {
    readonly status: string;
    readonly withLink?: boolean;
    readonly cancelledSeenAt?: Date | null;
}): Promise<{ readonly userId: string; readonly subscriptionId: string }> {
    const db = getServiceTestDb();
    const { userId } = await seedCoverageUser(db);
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(db, 'accommodation');
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId,
        vertical: 'accommodation',
        planVersionId,
        billingOptionId,
        status: input.status,
        serviceEndsAt:
            input.status === 'CANCEL_SCHEDULED' ? new Date('2026-11-01T00:00:00.000Z') : null
    });
    seeded.push(subscriptionId);
    if (input.withLink !== false)
        await db.insert(providerLinks).values({
            subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: `b43-can-charge-${crypto.randomUUID()}`,
            cancelledSeenAt: input.cancelledSeenAt ?? null
        });
    return { userId, subscriptionId };
}

/** A real signup, authorized by the fake and activated: the fake answers `active` (authorized). */
async function signup(clock: TestClock) {
    const db = getServiceTestDb();
    const { userId } = await seedCoverageUser(db);
    const { billingOptionId } = await seedCoveragePlanVersion(db, 'accommodation');
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [
            { lie: 'M1', why: 'fixture signup' },
            { lie: 'M6', why: 'single notice delivery' }
        ]
    });
    const started = await startSubscription(
        { userId, billingOptionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    handled.push(started.subscriptionId);
    await provider.approve({ authorizationId: started.authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    provider.takeDeliveries();
    return { provider, userId, ...started };
}

/** Moves a row as one of our transitions would, leaving the provider's authorization untouched. */
async function moveRow(input: {
    readonly subscriptionId: string;
    readonly status: 'CANCEL_SCHEDULED' | 'CANCELLED';
}): Promise<void> {
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: input.status, serviceEndsAt: new Date('2026-11-01T00:00:00.000Z') })
        .where(eq(subscriptions.id, input.subscriptionId));
}

/** The fake, with the authorization state its re-reads report forced. */
function proxyProvider(
    fake: FakePaymentProvider,
    status: AuthorizationSnapshot['status'],
    cancelImpl?: PaymentProvider['cancel']
): PaymentProvider {
    return new Proxy(fake, {
        get(target, property) {
            if (property === 'readAuthorization')
                return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                    const read = await fake.readAuthorization(input);
                    return { ...read, snapshot: { ...read.snapshot, status } };
                };
            if (property === 'cancel' && cancelImpl) return cancelImpl;
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
}

/** Runs the REAL notice handler on the newest authorization delivery, re-reading `status`. */
async function rereadThroughHandler(input: {
    readonly clock: TestClock;
    readonly fake: FakePaymentProvider;
    readonly status: AuthorizationSnapshot['status'];
}): Promise<void> {
    let delivery: Parameters<FakePaymentProvider['decodeNotice']>[0] | undefined;
    for (const candidate of input.fake.takeDeliveries().deliveries)
        if ((await input.fake.decodeNotice(candidate)).resourceKind === 'authorization')
            delivery = candidate;
    if (!delivery) throw new Error('missing authorization notice');
    const result = await processProviderNotice(
        { channel: 'WEBHOOKS', delivery },
        {
            provider: proxyProvider(input.fake, input.status),
            clock: input.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            payments: { hasCreditedPayment: async () => true },
            delegates: { delegate: vi.fn(async () => undefined) },
            cancellationSeen: providerLinkCancellationSeen
        }
    );
    expect(result).toEqual({ ack: 'OK', outcome: expect.any(String) });
}

async function cancelledSeenAt(subscriptionId: string): Promise<Date | null | undefined> {
    const [row] = await getServiceTestDb()
        .select({ cancelledSeenAt: providerLinks.cancelledSeenAt })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    return row?.cancelledSeenAt;
}

describe('TEST:B4:4 puedeCobrarle answers on the confirmed cancellation (AC:B4:5)', () => {
    it('(a) a CANCEL_SCHEDULED whose authorization the fake still gives authorized ⇒ yes', async () => {
        // Arrange
        const clock = adjustableClock();
        const account = await signup(clock);
        await moveRow({ subscriptionId: account.subscriptionId, status: 'CANCEL_SCHEDULED' });
        const read = await account.provider.readAuthorization({
            authorizationId: account.authorizationId
        });

        // Act
        const answer = await canChargeAt(clock).canCharge({ userId: account.userId });

        // Assert
        expect(read.snapshot.status).toBe('active');
        expect(answer).toEqual({ canCharge: true });
    });

    it('(b) a terminal row one of our transitions closed, still authorized at the fake ⇒ yes', async () => {
        // Arrange
        const clock = adjustableClock();
        const account = await signup(clock);
        await moveRow({ subscriptionId: account.subscriptionId, status: 'CANCELLED' });

        // Act
        const answer = await canChargeAt(clock).canCharge({ userId: account.userId });

        // Assert
        expect(answer).toEqual({ canCharge: true });
    });

    it('(c)(d) the handler re-read sees it cancelled ⇒ no; a later authorized re-read clears it ⇒ yes', async () => {
        // Arrange
        const clock = adjustableClock();
        const account = await signup(clock);
        await moveRow({ subscriptionId: account.subscriptionId, status: 'CANCELLED' });
        const canCharge = canChargeAt(clock);
        const before = await canCharge.canCharge({ userId: account.userId });

        // Act
        clock.advance(ONE_HOUR);
        const cancelledReadAt = clock.now();
        await account.provider.pause({ authorizationId: account.authorizationId });
        await rereadThroughHandler({ clock, fake: account.provider, status: 'cancelled' });
        const afterCancelled = {
            column: await cancelledSeenAt(account.subscriptionId),
            answer: await canCharge.canCharge({ userId: account.userId })
        };
        clock.advance(ONE_HOUR);
        await account.provider.resume({ authorizationId: account.authorizationId });
        await rereadThroughHandler({ clock, fake: account.provider, status: 'active' });
        const afterAuthorized = {
            column: await cancelledSeenAt(account.subscriptionId),
            answer: await canCharge.canCharge({ userId: account.userId })
        };

        // Assert
        expect(before).toEqual({ canCharge: true });
        expect(afterCancelled).toEqual({
            column: cancelledReadAt,
            answer: { canCharge: false }
        });
        expect(afterAuthorized).toEqual({ column: null, answer: { canCharge: true } });
    });

    it('(e) an open CANCELACION_SIN_CONFIRMAR mark ⇒ yes over a seen cancellation; lifted ⇒ no', async () => {
        // Arrange
        const clock = frozenClock(new Date(T.getTime() + ONE_HOUR));
        const account = await seedAccount({ status: 'CANCELLED', cancelledSeenAt: T });
        const [mark] = await getServiceTestDb()
            .insert(reconciliationMarks)
            .values({
                subscriptionId: account.subscriptionId,
                reason: 'CANCELACION_SIN_CONFIRMAR'
            })
            .returning({ id: reconciliationMarks.id });
        if (!mark) throw new Error('mark missing');

        // Act
        const withOpenMark = await canChargeAt(clock).canCharge({ userId: account.userId });
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: clock.now(), liftedBy: account.userId })
            .where(eq(reconciliationMarks.id, mark.id));
        const withLiftedMark = await canChargeAt(clock).canCharge({ userId: account.userId });

        // Assert
        expect({ withOpenMark, withLiftedMark }).toEqual({
            withOpenMark: { canCharge: true },
            withLiftedMark: { canCharge: false }
        });
    });

    it('(f) a SUSPENDED row counts even with its cancellation seen (D-3, rule 1) ⇒ yes', async () => {
        // Arrange
        const clock = frozenClock(new Date(T.getTime() + 30 * DAY_MS));
        const account = await seedAccount({ status: 'SUSPENDED', cancelledSeenAt: T });

        // Act
        const answer = await canChargeAt(clock).canCharge({ userId: account.userId });

        // Assert
        expect(answer).toEqual({ canCharge: true });
    });

    it("(g) another account's rows and marks do not change an account without subscriptions ⇒ no", async () => {
        // Arrange
        const clock = frozenClock(T);
        const other = await seedAccount({ status: 'ACTIVE' });
        await getServiceTestDb().insert(reconciliationMarks).values({
            subscriptionId: other.subscriptionId,
            reason: 'CANCELACION_SIN_CONFIRMAR'
        });
        const { userId } = await seedCoverageUser(getServiceTestDb());

        // Act
        const answers = {
            empty: await canChargeAt(clock).canCharge({ userId }),
            other: await canChargeAt(clock).canCharge({ userId: other.userId })
        };

        // Assert
        expect(answers).toEqual({ empty: { canCharge: false }, other: { canCharge: true } });
    });

    it('fails closed: a failed read throws instead of answering no (Coord-242)', async () => {
        // Arrange
        const account = await seedAccount({ status: 'CANCELLED', cancelledSeenAt: T });
        const canCharge = createBillingCanCharge({
            ports: {
                clock: frozenClock(T),
                deadlines: {
                    current: async () => {
                        throw new Error('deadlines unreadable');
                    }
                }
            }
        });

        // Act
        const attempt = canCharge.canCharge({ userId: account.userId });

        // Assert
        await expect(attempt).rejects.toThrow('deadlines unreadable');
    });

    it('the S16 and S6 re-reads that see the authorization alive clear the column too (I-1)', async () => {
        // Arrange
        const clock = adjustableClock();
        const declined = await signup(clock);
        const charge = await declined.provider.declineCharge({
            authorizationId: declined.authorizationId,
            declineReason: 'issuer_declined'
        });
        const arrears = await signup(clock);
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                status: 'GRACE_PERIOD',
                graceStartedAt: new Date('2026-09-25T00:00:00.000Z'),
                graceEndsAt: new Date('2026-09-30T00:00:00.000Z')
            })
            .where(eq(subscriptions.id, arrears.subscriptionId));
        const olderCancellation = new Date('2026-09-20T08:00:00.000Z');
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: olderCancellation })
            .where(
                inArray(providerLinks.subscriptionId, [
                    declined.subscriptionId,
                    arrears.subscriptionId
                ])
            );
        const acceptCancel: PaymentProvider['cancel'] = async (input) => ({
            accepted: true,
            resourceId: input.authorizationId
        });

        // Act
        const s16 = await declineFirstCharge(
            { chargeId: charge.chargeId },
            {
                provider: proxyProvider(declined.provider, 'active', acceptCancel),
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: providerLinkCancellationSeen
            }
        );
        const s6 = await suspendForArrears(
            {
                subscriptionId: arrears.subscriptionId,
                event: 'GRACE_EXPIRED',
                occurrenceId: crypto.randomUUID()
            },
            {
                provider: proxyProvider(arrears.provider, 'active', acceptCancel),
                clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                cancellationSeen: providerLinkCancellationSeen
            }
        );

        // Assert
        expect({ s16: s16.outcome, s6: s6.outcome }).toEqual({
            s16: 'DECLINED',
            s6: 'SUSPENDED'
        });
        expect({
            s16: await cancelledSeenAt(declined.subscriptionId),
            s6: await cancelledSeenAt(arrears.subscriptionId)
        }).toEqual({ s16: null, s6: null });
    });
});

describe('TEST:B4:5 a provider cancellation after a rejection counts for the 16th deadline (AC:B4:6)', () => {
    it('yes at the column and on day 6, no from 7 days on, with the authorization still cancelled', async () => {
        // Arrange
        const account = await seedAccount({ status: 'CHARGE_DECLINED', cancelledSeenAt: T });
        const deadlines = await getCurrentBillingDeadlines();
        const ask = (at: Date) =>
            canChargeAt(frozenClock(at)).canCharge({ userId: account.userId });

        // Act
        const answers = {
            seen: await ask(T),
            day6: await ask(new Date(T.getTime() + 6 * DAY_MS)),
            day7: await ask(new Date(T.getTime() + 7 * DAY_MS)),
            pastDeadline: await ask(new Date(T.getTime() + 7 * DAY_MS + 60_000))
        };

        // Assert
        expect(deadlines.values['16']).toEqual({ days: 7 });
        expect(answers).toEqual({
            seen: { canCharge: true },
            day6: { canCharge: true },
            day7: { canCharge: false },
            pastDeadline: { canCharge: false }
        });
        expect(await cancelledSeenAt(account.subscriptionId)).toEqual(T);
    });
});
