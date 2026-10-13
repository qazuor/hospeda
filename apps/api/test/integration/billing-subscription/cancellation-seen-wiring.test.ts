/**
 * AC:B4:11 (HOS-1534), composition half: the provider notice handler, run with
 * the PRODUCTION receiver ports (`buildMercadoPagoNoticePorts()`), annotates
 * `provider_link.cancelled_seen_at` when its re-read sees the preapproval
 * `cancelled`, and a newer re-read that sees it alive clears the column (AC:B4:5).
 * The row stays `ACTIVE` with no credited charge, so the mirror waits for the
 * first charge's reading and then no-ops: the annotation is the only write
 * under test, and it runs right after the re-read, before the mirror acts.
 * Before HOS-1534 the receiver ports carried no annotator, so the handler fell
 * back to the no-op and the column was never written in production.
 *
 * Cleanup: the real signup's row is left terminal (`CANCELLED`) and its
 * `coverage_loss` deleted; plan versions are immutable and stay non-sellable;
 * never TRUNCATE.
 */
import {
    and,
    billingOptions,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    plans,
    planVersions,
    providerLinks,
    sql,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { AuthorizationSnapshot, PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { processProviderNotice, startSubscription } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildMercadoPagoNoticePorts } from '../../../src/routes/webhooks/mercadopago-ports';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';

const ONE_HOUR = 60 * 60 * 1000;

/** An adjustable clock the API reads (`getClock()`) and the fake shares. */
function adjustableClock(start = new Date('2026-10-12T12:00:00.000Z')) {
    let at = start.getTime();
    return {
        now: () => new Date(at),
        advance: (ms: number) => {
            at += ms;
        }
    };
}

/** Subscriptions the real signup created: left terminal after each case. */
const handled: string[] = [];
const createdUsers: string[] = [];

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});

afterEach(async () => {
    const db = getDb();
    const ids = handled.splice(0);
    if (ids.length > 0)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(
                and(
                    inArray(subscriptions.id, ids),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            );
    for (const id of createdUsers.splice(0))
        await db.execute(sql`DELETE FROM coverage_loss WHERE user_id = ${id}::uuid`);
});

/** A real signup over the fake, authorized and activated (the fake answers `active`). */
async function signup(clock: ReturnType<typeof adjustableClock>) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `b43-cancel-seen-${crypto.randomUUID()}@example.test`,
            displayName: 'B4.3 cancellation seen',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    createdUsers.push(user.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b43-cancel-seen-${crypto.randomUUID()}`,
            name: 'B4.3 cancellation seen'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [
            { lie: 'M1', why: 'fixture signup' },
            { lie: 'M6', why: 'single notice delivery' }
        ]
    });
    const started = await startSubscription(
        { userId: user.id, billingOptionId: option.id, returnUrl: 'https://example.test' },
        {
            provider: fake,
            clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: { inherits: async () => false },
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    handled.push(started.subscriptionId);
    await fake.approve({ authorizationId: started.authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    fake.takeDeliveries();
    return { fake, userId: user.id, ...started };
}

/** The fake, with the authorization state its re-reads report forced to `status()`. */
function proxyProvider(
    fake: FakePaymentProvider,
    status: () => AuthorizationSnapshot['status']
): PaymentProvider {
    return new Proxy(fake, {
        get(target, property) {
            if (property === 'readAuthorization')
                return async (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                    const read = await fake.readAuthorization(input);
                    return { ...read, snapshot: { ...read.snapshot, status: status() } };
                };
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
}

/** Runs the REAL handler with the PRODUCTION receiver ports on the newest authorization notice. */
async function rereadThroughProductionPorts(fake: FakePaymentProvider) {
    let delivery: Parameters<FakePaymentProvider['decodeNotice']>[0] | undefined;
    for (const candidate of fake.takeDeliveries().deliveries)
        if ((await fake.decodeNotice(candidate)).resourceKind === 'authorization')
            delivery = candidate;
    if (!delivery) throw new Error('missing authorization notice');
    return processProviderNotice({ channel: 'WEBHOOKS', delivery }, buildMercadoPagoNoticePorts());
}

async function cancelledSeenAt(subscriptionId: string): Promise<Date | null | undefined> {
    const [row] = await getDb()
        .select({ cancelledSeenAt: providerLinks.cancelledSeenAt })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, subscriptionId));
    return row?.cancelledSeenAt;
}

describe('AC:B4:11 the webhook annotates and clears the cancellation seen in production (HOS-1534)', () => {
    it('a cancelled re-read writes cancelled_seen_at; a newer active re-read clears it', async () => {
        // Arrange
        const clock = adjustableClock();
        injectClock({ clock });
        const account = await signup(clock);
        let readStatus: AuthorizationSnapshot['status'] = 'cancelled';
        injectPaymentProvider({ provider: proxyProvider(account.fake, () => readStatus) });
        const before = await cancelledSeenAt(account.subscriptionId);

        // Act
        clock.advance(ONE_HOUR);
        const cancelledReadAt = clock.now();
        await account.fake.pause({ authorizationId: account.authorizationId });
        const cancelledResult = await rereadThroughProductionPorts(account.fake);
        const afterCancelled = await cancelledSeenAt(account.subscriptionId);
        clock.advance(ONE_HOUR);
        readStatus = 'active';
        await account.fake.resume({ authorizationId: account.authorizationId });
        const activeResult = await rereadThroughProductionPorts(account.fake);
        const afterActive = await cancelledSeenAt(account.subscriptionId);

        // Assert
        expect({ cancelledResult, activeResult }).toEqual({
            cancelledResult: { ack: 'OK', outcome: 'WAITING_FIRST_CHARGE_READING' },
            activeResult: { ack: 'OK', outcome: 'NOOP' }
        });
        expect({ before, afterCancelled, afterActive }).toEqual({
            before: null,
            afterCancelled: cancelledReadAt,
            afterActive: null
        });
    });
});
