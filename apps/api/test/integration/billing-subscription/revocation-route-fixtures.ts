/**
 * Seeding for the admin action 8 revocation route tests (HOS-1543, TEST:B5:11, TEST:B5:12).
 * Every row gets a random id and is registered here. `retireRevocationRouteRows` deletes the
 * money and the side rows (refunds, payments, manual payments, pauses, outbox, coverage loss)
 * children first, and leaves each subscription `CANCELLED`, out of every live population:
 * `domain_event` is append-only (extras 056), so the rows a decision event names stay, as in
 * the service tests of S36. Plan versions are immutable and non-sellable. Never TRUNCATE.
 */
import {
    and,
    billingOptions,
    buildEmailDedupKey,
    buildEventOccurrence,
    coverageLosses,
    domainEventModel,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    inArray,
    LIVE_SUBSCRIPTION_STATUSES,
    manualPayments,
    payments,
    plans,
    planVersions,
    refunds,
    subscriptionModel,
    subscriptionPauses,
    subscriptions,
    userRole,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, type RoleEnum, VerticalEnum } from '@repo/schemas';
import { startSubscription } from '@repo/service-core';

export const DAY_MS = 86_400_000;
/** The instant every request of these tests happens at: 2026-10-05 09:00 in Buenos Aires. */
export const NOW = new Date('2026-10-05T12:00:00.000Z');
/** The revoked charge: 2026-10-01 10:00 in Buenos Aires, day 4 of its 10-day window. */
export const CHARGED_AT = new Date('2026-10-01T13:00:00.000Z');
/** The end of the window of `CHARGED_AT`: midnight that starts 2026-10-12 in Buenos Aires. */
export const WINDOW_ENDS_AT = new Date('2026-10-12T03:00:00.000Z');
/** A charge 12 days before `NOW`: its window is closed (AC:B5:21). */
export const CHARGED_12_DAYS_AGO = new Date(NOW.getTime() - 12 * DAY_MS);
/** The anchored monthly price of every seeded option. */
export const OPTION_AMOUNT = 10000;

/** Permissions of a person who may register the revocation (D-2: SUPER_ADMIN's own permission). */
export const REVOKER_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
] as const;

const created = {
    users: [] as string[],
    subscriptions: [] as string[],
    payments: [] as string[],
    manualPayments: [] as string[]
};

/** The clock the app reads and the fake shares; each read moves it 1 ms (fresh re-reads). */
export function routeClock(start = NOW) {
    let at = start.getTime();
    return {
        now: () => new Date(at++),
        set: (instant: Date) => {
            at = instant.getTime();
        }
    };
}

/** The API's fake provider for these tests. */
export function routeFake(clock: ReturnType<typeof routeClock>): FakePaymentProvider {
    return new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [
            { lie: 'M1', why: 'fixture signup' },
            { lie: 'M6', why: 'single notice delivery' }
        ]
    });
}

/** The fake with its `cancel` replaced by one that throws (the call that was not applied). */
export function failingCancel(fake: FakePaymentProvider): PaymentProvider {
    return new Proxy(fake, {
        get(target, property) {
            if (property === 'cancel')
                return async () => {
                    throw new Error('provider cancel failed');
                };
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as PaymentProvider;
}

/** The fake behind a Proxy that records every provider method a request calls. */
export function spyingProvider(fake: FakePaymentProvider): {
    readonly provider: PaymentProvider;
    readonly calls: string[];
} {
    const calls: string[] = [];
    const provider = new Proxy(fake, {
        get(target, property) {
            const value = Reflect.get(target, property, target) as unknown;
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
                calls.push(String(property));
                return (value as (...input: unknown[]) => unknown).apply(target, args);
            };
        }
    }) as PaymentProvider;
    return { provider, calls };
}

/** Gives `userId` a persisted role (the subject's rank, I-9). */
export async function grantRole(userId: string, role: RoleEnum): Promise<void> {
    await getDb().insert(userRole).values({ userId, role });
}

/** A fresh account, registered for cleanup. */
export async function seedUser(label: string): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b55-route-${label}-${crypto.randomUUID()}@example.test`,
            displayName: `B5.5 ${label}`,
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    created.users.push(user.id);
    return user.id;
}

/** A non-sellable plan version with its monthly option of `OPTION_AMOUNT`. */
async function seedOption(): Promise<{ planVersionId: string; optionId: string }> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b55-route-${crypto.randomUUID()}`,
            name: 'B5.5 route'
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
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: OPTION_AMOUNT,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    return { planVersionId: version.id, optionId: option.id };
}

/** A principal row of `ownerId`, without provider link. */
export async function seedPrincipal(input: {
    readonly ownerId: string;
    readonly status?: string;
    readonly paymentMethod?: 'CARD' | 'MANUAL';
    readonly succeededById?: string;
}): Promise<string> {
    const option = await seedOption();
    const [row] = await getDb()
        .insert(subscriptions)
        .values({
            userId: input.ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: option.planVersionId,
            billingOptionId: option.optionId,
            paymentMethod: input.paymentMethod ?? 'CARD',
            status: input.status ?? 'ACTIVE',
            class: 'PRINCIPAL',
            succeededById: input.succeededById ?? null
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    created.subscriptions.push(row.id);
    return row.id;
}

/** A credited (`SUCCEEDED`) provider payment on `subscriptionId`. */
export async function seedCreditedPayment(input: {
    readonly subscriptionId: string;
    readonly factAt?: Date;
    readonly amount?: number;
}): Promise<string> {
    const [row] = await getDb()
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amount ?? OPTION_AMOUNT,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'FAKE',
            providerFactId: `b55-route-${crypto.randomUUID()}`,
            factAt: input.factAt ?? CHARGED_AT
        })
        .returning({ id: payments.id });
    if (!row) throw new Error('Expected payment');
    created.payments.push(row.id);
    return row.id;
}

/** A `REGISTERED` manual payment on `subscriptionId`, registered by `registeredBy`. */
export async function seedManualPayment(input: {
    readonly subscriptionId: string;
    readonly registeredBy: string;
    readonly registeredAt?: Date;
}): Promise<string> {
    const [row] = await getDb()
        .insert(manualPayments)
        .values({
            subscriptionId: input.subscriptionId,
            periodStart: new Date('2026-10-01T03:00:00.000Z'),
            status: 'REGISTERED',
            registeredBy: input.registeredBy,
            registeredAt: input.registeredAt ?? CHARGED_AT
        })
        .returning({ id: manualPayments.id });
    if (!row) throw new Error('Expected manual payment');
    created.manualPayments.push(row.id);
    return row.id;
}

/** An ACTIVE card principal of a fresh owner, without provider link, paid at `factAt`. */
export async function seedRevocable(input: { readonly factAt?: Date } = {}) {
    const ownerId = await seedUser('owner');
    const subscriptionId = await seedPrincipal({ ownerId });
    const paymentId = await seedCreditedPayment({ subscriptionId, factAt: input.factAt });
    return { ownerId, subscriptionId, paymentId };
}

/**
 * A real signup over `fake`, authorized and activated: an ACTIVE card principal WITH its
 * provider link and a live preapproval, plus a credited payment at `CHARGED_AT`.
 */
export async function seedCardRevocable(input: {
    readonly fake: FakePaymentProvider;
    readonly clock: ReturnType<typeof routeClock>;
}) {
    const ownerId = await seedUser('card-owner');
    const option = await seedOption();
    const started = await startSubscription(
        { userId: ownerId, billingOptionId: option.optionId, returnUrl: 'https://example.test' },
        {
            provider: input.fake,
            clock: input.clock,
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
    created.subscriptions.push(started.subscriptionId);
    await input.fake.approve({ authorizationId: started.authorizationId });
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: input.clock.now()
    });
    input.fake.takeDeliveries();
    const paymentId = await seedCreditedPayment({ subscriptionId: started.subscriptionId });
    return {
        ownerId,
        subscriptionId: started.subscriptionId,
        authorizationId: started.authorizationId,
        paymentId
    };
}

/**
 * Puts the before-cancel notice of S36 in the outbox ahead of the act, in a final state, so the
 * real `beforeCancelNotice` reads it: `sent` → `SENT`; `failed` with a hard bounce →
 * `NO_RECIPIENT`; `failed` otherwise → `DELIVERY_EXHAUSTED`.
 */
export async function presetBeforeCancelNotice(input: {
    readonly ownerId: string;
    readonly subscriptionId: string;
    readonly status: 'sent' | 'failed';
    readonly lastError?: string;
}): Promise<void> {
    const template = 'billing.before-cancel';
    const dedupKey = buildEmailDedupKey({
        recipient: input.ownerId,
        template,
        occurrence: buildEventOccurrence({ eventId: input.subscriptionId })
    });
    await emailOutboxModel.enqueue({
        recipientUserId: input.ownerId,
        recipientEmail: `preset-${crypto.randomUUID()}@example.test`,
        template,
        payload: { subscriptionId: input.subscriptionId },
        dedupKey
    });
    await getDb()
        .update(emailOutbox)
        .set({ status: input.status, lastError: input.lastError ?? null })
        .where(eq(emailOutbox.dedupKey, dedupKey));
}

/** Request headers of a mock actor; without an actor, the request carries no session. */
export function actorHeaders(actor?: {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
}): Record<string, string> {
    const base = { 'content-type': 'application/json', 'user-agent': 'vitest' };
    if (!actor) return base;
    return {
        ...base,
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

/**
 * Everything S36 writes for one subscription: what a refused revocation must leave as it was
 * (the row, its refunds, its owner's outbox and coverage loss, its decision events).
 */
export async function revocationWrites(input: {
    readonly subscriptionId: string;
    readonly ownerId: string;
}) {
    const db = getDb();
    const [row] = await db
        .select({
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt,
            updatedAt: subscriptions.updatedAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    const paid = await db
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.subscriptionId, input.subscriptionId));
    const refundRows =
        paid.length === 0
            ? []
            : await db
                  .select()
                  .from(refunds)
                  .where(
                      inArray(
                          refunds.paymentId,
                          paid.map(({ id }) => id)
                      )
                  );
    const outbox = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, input.ownerId));
    const losses = await db
        .select({ vertical: coverageLosses.vertical })
        .from(coverageLosses)
        .where(eq(coverageLosses.userId, input.ownerId));
    return {
        row,
        refunds: refundRows,
        outbox: outbox.length,
        coverageLosses: losses.length,
        decisions: (await decisionsOf(input.subscriptionId)).length
    };
}

/** The `subscription.provider_cancellation_decided` events of a subscription. */
export async function decisionsOf(subscriptionId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: subscriptionId
        })
    ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
}

/** Every refund of one manual payment. */
export async function refundsOfManualPayment(manualPaymentId: string) {
    return getDb().select().from(refunds).where(eq(refunds.manualPaymentId, manualPaymentId));
}

/** Delete the money and side rows this file seeded, children first; retire the subscriptions. */
export async function retireRevocationRouteRows(): Promise<void> {
    const db = getDb();
    const paymentIds = created.payments.splice(0);
    const manualIds = created.manualPayments.splice(0);
    const subscriptionIds = created.subscriptions.splice(0);
    const userIds = created.users.splice(0);
    if (paymentIds.length > 0) {
        await db.delete(refunds).where(inArray(refunds.paymentId, paymentIds));
        await db.delete(payments).where(inArray(payments.id, paymentIds));
    }
    if (manualIds.length > 0) {
        await db.delete(refunds).where(inArray(refunds.manualPaymentId, manualIds));
        await db.delete(manualPayments).where(inArray(manualPayments.id, manualIds));
    }
    if (subscriptionIds.length > 0) {
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, subscriptionIds));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(
                and(
                    inArray(subscriptions.id, subscriptionIds),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            );
    }
    if (userIds.length > 0) {
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, userIds));
        await db.delete(userRole).where(inArray(userRole.userId, userIds));
    }
}
