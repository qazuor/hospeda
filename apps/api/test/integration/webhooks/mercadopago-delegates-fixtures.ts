/**
 * Fixtures of TEST:1676:6 (HOS-1676, AC:1676:6): signed Mercado Pago Webhooks
 * deliveries posted to the real API, rows seeded over the fake provider served by
 * HTTP, and the per-subject cleanup. Copied from `mercadopago-receiver.test.ts`
 * (not refactored out of it, by design).
 */
import { createHmac } from 'node:crypto';
import {
    and,
    billingOptions,
    coverageLosses,
    emailOutbox,
    eq,
    getDb,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    payments,
    plans,
    planVersions,
    providerLinks,
    providerNotifications,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import type { initApp } from '../../../src/app';

/** The test-only key the API validates the Webhooks signatures of these tests with. */
export const SIGNING_KEY = 'hos1676-delegates-test-signing-key';

type App = ReturnType<typeof initApp>;
type Clock = { readonly now: () => Date };

/** One signed Webhooks delivery as the API receives it. */
export interface SignedDelivery {
    readonly query: string;
    readonly headers: Record<string, string>;
    readonly body: string;
}

/** The headers Mercado Pago signs a Webhooks delivery with (`id;request-id;ts`). */
export function signedHeaders(input: { readonly clock: Clock; readonly dataId: string }) {
    const requestId = crypto.randomUUID();
    const timestamp = String(Math.floor(input.clock.now().getTime() / 1000));
    const manifestId = /^[a-z\d]+$/i.test(input.dataId) ? input.dataId.toLowerCase() : input.dataId;
    const manifest = `id:${manifestId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac('sha256', SIGNING_KEY).update(manifest).digest('hex');
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-request-id': requestId,
        'x-signature': `ts=${timestamp},v1=${signature}`
    };
}

/**
 * A signed Webhooks notice of one resource, built by hand: used when the fake has
 * nothing new to notify (a row we changed in the database) or to post exactly ONE
 * notice. The body carries a nonce so its `provider_notification` row is unique.
 */
export function signedNotice(input: {
    readonly clock: Clock;
    readonly type: 'subscription_preapproval' | 'payment';
    readonly id: string;
    readonly version: string;
}): SignedDelivery {
    const query = new URLSearchParams({
        source_news: 'webhooks',
        'data.id': input.id,
        type: input.type
    }).toString();
    const body = JSON.stringify({
        action: 'updated',
        api_version: 'v1',
        data: { id: input.id },
        date: input.clock.now().toISOString(),
        id: crypto.randomUUID(),
        type: input.type,
        version: input.version,
        live_mode: false
    });
    return { query, headers: signedHeaders({ clock: input.clock, dataId: input.id }), body };
}

/** Posts one delivery to `POST /api/v1/webhooks/mercadopago`. */
export function postDelivery(app: App, delivery: SignedDelivery) {
    return app.request(`/api/v1/webhooks/mercadopago?${delivery.query}`, {
        method: 'POST',
        headers: { ...delivery.headers, 'user-agent': delivery.headers['user-agent'] ?? 'vitest' },
        body: delivery.body
    });
}

/** The `provider_notification` rows the API stored for exactly this delivery. */
export async function noticeRowsOf(delivery: SignedDelivery) {
    return getDb()
        .select()
        .from(providerNotifications)
        .where(
            and(
                eq(
                    providerNotifications.url,
                    `http://localhost/api/v1/webhooks/mercadopago?${delivery.query}`
                ),
                eq(providerNotifications.body, delivery.body)
            )
        );
}

/** The ids every case registers, so `retireSubjects` cleans only its own rows. */
export interface Subjects {
    readonly users: Set<string>;
    readonly subscriptions: Set<string>;
    readonly tombstones: Set<string>;
    readonly deliveries: SignedDelivery[];
}

/** An empty subject registry. */
export function createSubjects(): Subjects {
    return { users: new Set(), subscriptions: new Set(), tombstones: new Set(), deliveries: [] };
}

/** One plan, version and monthly option the signups of the file share. */
export async function createSignupOption() {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `hos1676-${crypto.randomUUID()}`,
            name: 'HOS-1676 delegates'
        })
        .returning();
    if (!plan) throw new Error('No plan created');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No plan version created');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option created');
    return option.id;
}

/** A user the cleanup lifts the marks with (`lifted_by`). */
export async function createLifter() {
    const [lifter] = await getDb()
        .insert(users)
        .values({
            email: `hos1676-lifter-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1676 lifter',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!lifter) throw new Error('No lifter created');
    return lifter.id;
}

/** A real signup through the API: `PENDING_AUTHORIZATION` with its preapproval in the fake. */
export async function signup(input: {
    readonly app: App;
    readonly billingOptionId: string;
    readonly subjects: Subjects;
    /** Signs up an existing user of the file instead of a new one (a successor, HOS-1557). */
    readonly userId?: string;
}) {
    const user = input.userId
        ? { id: input.userId }
        : (
              await getDb()
                  .insert(users)
                  .values({
                      email: `hos1676-delegates-${crypto.randomUUID()}@example.test`,
                      displayName: 'HOS-1676 delegates user',
                      emailVerified: true,
                      lifecycleState: 'ACTIVE'
                  })
                  .returning()
          )[0];
    if (!user) throw new Error('No user created');
    input.subjects.users.add(user.id);
    const response = await input.app.request('/api/v1/protected/billing/subscriptions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': user.id,
            'x-mock-actor-role': 'USER',
            'x-mock-actor-permissions': '[]'
        },
        body: JSON.stringify({
            billingOptionId: input.billingOptionId,
            payerEmail: `mp-${crypto.randomUUID()}@example.test`
        })
    });
    const text = await response.text();
    if (response.status !== 201 && response.status !== 200)
        throw new Error(`Signup failed: ${response.status} ${text}`);
    const body = JSON.parse(text) as {
        data?: { authorizationId?: string; subscriptionId?: string };
    };
    const authorizationId = body.data?.authorizationId;
    const subscriptionId = body.data?.subscriptionId;
    if (!authorizationId || !subscriptionId) throw new Error('Signup response lacked identifiers');
    input.subjects.subscriptions.add(subscriptionId);
    return { userId: user.id, authorizationId, subscriptionId };
}

/**
 * A preapproval created straight in the fake with a reference that is not ours
 * (`legacy-<uuid>`), authorized: the API has no `provider_link` for it.
 */
export async function legacyAuthorization(fake: FakePaymentProvider) {
    const reference = `legacy-${crypto.randomUUID()}`;
    const { authorizationId } = await fake.authorize({
        reference,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'HOS-1676 unknown authorization',
        returnUrl: 'https://example.test/return',
        payerEmail: `legacy-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId });
    return { authorizationId, reference };
}

/** The row a notice wrote for `authorizationId`, read through its `provider_link`. */
export async function rowOfAuthorization(authorizationId: string) {
    const db = getDb();
    const [link] = await db
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.providerId, authorizationId));
    if (!link) return undefined;
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, link.subscriptionId));
    const links = await db
        .select()
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, link.subscriptionId));
    const paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.subscriptionId, link.subscriptionId));
    const marks = await db
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, link.subscriptionId));
    const markIds = marks.map((mark) => mark.id);
    const hung =
        markIds.length === 0
            ? []
            : await db
                  .select()
                  .from(reconciliationMarkPayments)
                  .where(inArray(reconciliationMarkPayments.markId, markIds));
    return { link, subscription, links, payments: paymentRows, marks, hung };
}

/**
 * Per-subject cleanup, never TRUNCATE nor a global count: every mark of the
 * subjects is lifted and its hung payments resolved; the signups' live rows are
 * left terminal (`CANCELLED`); the users' `coverage_loss` and outbox mails and the
 * stored deliveries are deleted. What cannot be deleted stays and every assertion
 * filters by its subject: receipt tombstones are born `CANCELLED` and a trigger
 * keeps their `provider_link` (`ck_subscription_tombstone_provider_link`), the
 * tombstone payment carries a receipt, `domain_event` is append-only and plan
 * versions are immutable.
 */
export async function retireSubjects(subjects: Subjects, lifterId: string) {
    const db = getDb();
    const tombstones = [...subjects.tombstones];
    const rows = [...subjects.subscriptions];
    const all = [...rows, ...tombstones];
    if (all.length > 0) {
        const markIds = (
            await db
                .select({ id: reconciliationMarks.id })
                .from(reconciliationMarks)
                .where(inArray(reconciliationMarks.subscriptionId, all))
        ).map((mark) => mark.id);
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
                    inArray(reconciliationMarks.subscriptionId, all),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    }
    if (rows.length > 0)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(
                and(
                    inArray(subscriptions.id, rows),
                    inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES])
                )
            );
    const userIds = [...subjects.users];
    if (userIds.length > 0) {
        await db.delete(coverageLosses).where(inArray(coverageLosses.userId, userIds));
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
    }
    for (const delivery of subjects.deliveries.splice(0))
        await db
            .delete(providerNotifications)
            .where(
                and(
                    eq(
                        providerNotifications.url,
                        `http://localhost/api/v1/webhooks/mercadopago?${delivery.query}`
                    ),
                    eq(providerNotifications.body, delivery.body)
                )
            );
    subjects.tombstones.clear();
    subjects.subscriptions.clear();
    subjects.users.clear();
}
