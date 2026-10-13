// TEST:B4:11 (AC:B4:11; DEC-ARCH-017📌12) — the real «anotar la cancelación vista» writes
// provider_link.cancelled_seen_at once, whoever calls it and in whatever order, and a newer live
// re-read clears it (AC:B4:5, column half).
import {
    and,
    billingDeadlineVersions,
    eq,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    providerLinks,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { recordCancellationSeen } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { billingDeadlineValues } from './support/payment-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

const ONE_HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-09-20T08:00:00.000Z');

/**
 * Subscriptions this file seeded directly: deleted after each test with their link. Catalog rows
 * (non-sellable plan versions, which are immutable and never deleted) and users stay behind.
 */
const seeded: string[] = [];
/** Subscriptions the real handler fixture created: left terminal after each test. */
const handled: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    if (seeded.length > 0) {
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

/** A terminal subscription with a provider_link whose cancelled_seen_at is the given value. */
async function seedLinkedSubscription(input: {
    readonly cancelledSeenAt: Date | null;
    readonly withLink?: boolean;
}): Promise<string> {
    const db = getServiceTestDb();
    const { userId } = await seedCoverageUser(db);
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(db, 'accommodation');
    const { subscriptionId } = await seedCoverageSubscription(db, {
        userId,
        vertical: 'accommodation',
        planVersionId,
        billingOptionId,
        status: 'CANCELLED'
    });
    seeded.push(subscriptionId);
    if (input.withLink !== false)
        await db.insert(providerLinks).values({
            subscriptionId,
            provider: 'MERCADO_PAGO',
            providerId: `b43-${crypto.randomUUID()}`,
            cancelledSeenAt: input.cancelledSeenAt
        });
    return subscriptionId;
}

/** A live card subscription whose authorization the fake provider has cancelled (B3 fixture). */
async function handlerFixture(clock: TestClock) {
    const db = getServiceTestDb();
    await db
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineValues })
        .onConflictDoNothing();
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
    await provider.cancel({ authorizationId: started.authorizationId });
    return { provider, subscriptionId: started.subscriptionId };
}

/** The notice handler, for real: a cancelled re-read annotates through the real annotator. */
async function callHandler(
    clock: TestClock,
    fixture: Awaited<ReturnType<typeof handlerFixture>>
): Promise<void> {
    const deliveries = fixture.provider.takeDeliveries().deliveries;
    let delivery: (typeof deliveries)[number] | undefined;
    for (const candidate of deliveries)
        if ((await fixture.provider.decodeNotice(candidate)).resourceKind === 'authorization')
            delivery = candidate;
    if (!delivery) throw new Error('missing authorization notice');
    const result = await processProviderNotice(
        { channel: 'WEBHOOKS', delivery },
        {
            provider: fixture.provider,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            payments: { hasCreditedPayment: async () => true },
            cancellationSeen: providerLinkCancellationSeen
        }
    );
    expect(result.ack).toBe('OK');
}

/** S16 and the sweep call the port the same way: best-effort, with the re-read instant. */
function portCaller(clock: TestClock) {
    return async (subscriptionId: string) =>
        recordCancellationSeen({
            annotator: providerLinkCancellationSeen,
            subscriptionId,
            seenAt: clock.now()
        });
}

async function cancelledSeenAt(subscriptionId: string): Promise<Date | null | undefined> {
    const [row] = await getServiceTestDb()
        .select({ cancelledSeenAt: providerLinks.cancelledSeenAt })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    return row?.cancelledSeenAt;
}

async function subscriptionStatus(subscriptionId: string): Promise<string | undefined> {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    return row?.status;
}

describe('TEST:B4:11 cancellation seen is written once, whoever calls it and in any order', () => {
    it('(a) handler → S16 → sweep: the empty row keeps the first instant, the written one keeps T0', async () => {
        // Arrange
        const clock = adjustableClock();
        const fixture = await handlerFixture(clock);
        const written = await seedLinkedSubscription({ cancelledSeenAt: T0 });
        const s16 = portCaller(clock);
        const sweep = portCaller(clock);
        const first = clock.now();

        // Act
        await callHandler(clock, fixture);
        await s16(written);
        clock.advance(ONE_HOUR);
        await s16(fixture.subscriptionId);
        await sweep(written);
        clock.advance(ONE_HOUR);
        await sweep(fixture.subscriptionId);

        // Assert
        expect({
            empty: await cancelledSeenAt(fixture.subscriptionId),
            written: await cancelledSeenAt(written)
        }).toEqual({ empty: first, written: T0 });
        expect(LIVE_SUBSCRIPTION_STATUSES).not.toContain(
            await subscriptionStatus(fixture.subscriptionId)
        );
    });

    it('(b) sweep → S16 → handler on fresh rows: the same result, the first instant whoever made it', async () => {
        // Arrange
        const clock = adjustableClock();
        const fixture = await handlerFixture(clock);
        const written = await seedLinkedSubscription({ cancelledSeenAt: T0 });
        const s16 = portCaller(clock);
        const sweep = portCaller(clock);
        const first = clock.now();

        // Act
        await sweep(fixture.subscriptionId);
        await sweep(written);
        clock.advance(ONE_HOUR);
        await s16(fixture.subscriptionId);
        await s16(written);
        clock.advance(ONE_HOUR);
        await callHandler(clock, fixture);

        // Assert
        expect({
            empty: await cancelledSeenAt(fixture.subscriptionId),
            written: await cancelledSeenAt(written)
        }).toEqual({ empty: first, written: T0 });
    });

    it('(c) a re-read older than the written instant does not move it either', async () => {
        // Arrange
        const subscriptionId = await seedLinkedSubscription({ cancelledSeenAt: T0 });

        // Act
        await providerLinkCancellationSeen.annotateCancellationSeen({
            subscriptionId,
            seenAt: new Date(T0.getTime() - 24 * ONE_HOUR)
        });

        // Assert
        expect(await cancelledSeenAt(subscriptionId)).toEqual(T0);
    });

    it('(d) a live re-read newer than the cancellation clears it; an older one does not', async () => {
        // Arrange
        const older = await seedLinkedSubscription({ cancelledSeenAt: T0 });
        const newer = await seedLinkedSubscription({ cancelledSeenAt: T0 });

        // Act
        await providerLinkCancellationSeen.clearCancellationSeen({
            subscriptionId: older,
            seenAliveAt: new Date(T0.getTime() - ONE_HOUR)
        });
        await providerLinkCancellationSeen.clearCancellationSeen({
            subscriptionId: newer,
            seenAliveAt: new Date(T0.getTime() + ONE_HOUR)
        });

        // Assert
        expect({
            older: await cancelledSeenAt(older),
            newer: await cancelledSeenAt(newer)
        }).toEqual({ older: T0, newer: null });
    });

    it('(d) after a clear, the next cancelled re-read writes its own instant again', async () => {
        // Arrange
        const subscriptionId = await seedLinkedSubscription({ cancelledSeenAt: T0 });
        const later = new Date(T0.getTime() + 2 * ONE_HOUR);
        await providerLinkCancellationSeen.clearCancellationSeen({
            subscriptionId,
            seenAliveAt: new Date(T0.getTime() + ONE_HOUR)
        });

        // Act
        await providerLinkCancellationSeen.annotateCancellationSeen({
            subscriptionId,
            seenAt: later
        });

        // Assert
        expect(await cancelledSeenAt(subscriptionId)).toEqual(later);
    });

    it('(e) without a provider_link (manual payer) neither method throws nor writes', async () => {
        // Arrange
        const subscriptionId = await seedLinkedSubscription({
            cancelledSeenAt: null,
            withLink: false
        });

        // Act
        await providerLinkCancellationSeen.annotateCancellationSeen({ subscriptionId, seenAt: T0 });
        await providerLinkCancellationSeen.clearCancellationSeen({
            subscriptionId,
            seenAliveAt: T0
        });

        // Assert
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, subscriptionId))
        ).toEqual([]);
    });
});
