/**
 * Billing entity factories for E2E tests (SPEC-143 T-143-07).
 *
 * Strict, RO-RO factories for the billing tables that depend on plans and
 * prices (which are seeded separately via {@link seedBillingTestPlans} in
 * `../setup/seed-helpers`).
 *
 * Convention:
 * - Every factory accepts an explicit `input` object — dependencies are NOT
 *   auto-created. If the test wants a subscription, it must first call
 *   {@link createTestBillingCustomer} and pass the resulting `customerId`.
 *   This keeps test setup explicit and surface-debuggable.
 * - Every factory accepts an optional `db` (defaults to `getDb()`). Pass the
 *   transaction client from {@link TestDatabaseManager.withRollback} when
 *   you want the writes scoped to a rolled-back transaction.
 * - Every factory returns the new row's `id` plus the key fields tests
 *   typically assert on, so callers can do `expect(result.email).toBe(...)`
 *   without re-querying the DB.
 * - Uses `as typeof <table>.$inferInsert` for typing — the qzpay-drizzle
 *   table types ship from a versioned external package with strict shapes;
 *   the cast keeps the factories resilient to point-version differences
 *   while still surfacing missing required fields at test time.
 *
 * Out of scope here (intentionally):
 * - Sponsorships (Phase 3 — depend on sponsorship_levels + sponsorship_packages
 *   tables; factory will live alongside the sponsorship flow tests).
 * - billing_customer_entitlements / billing_customer_limits / billing_invoices —
 *   these are populated by the billing system itself once a subscription is
 *   activated; tests assert against them but rarely seed them directly.
 *
 * @module test/e2e/helpers/billing-factories
 */

import { randomUUID } from 'node:crypto';
import {
    type DrizzleClient,
    billingAddons,
    billingCustomers,
    billingPromoCodes,
    billingSubscriptionAddons,
    billingSubscriptions,
    getDb
} from '@repo/db';

// ---------------------------------------------------------------------------
// billing_customers
// ---------------------------------------------------------------------------

/**
 * Customer status values accepted by `billing_customers.status`.
 */
export type TestBillingCustomerStatus = 'active' | 'inactive' | 'suspended';

/**
 * Customer segment values accepted by `billing_customers.segment`.
 * NOTE: column is `segment`, NOT `category` (engram gotcha).
 */
export type TestBillingCustomerSegment = 'individual' | 'business' | 'enterprise';

/**
 * Input for {@link createTestBillingCustomer}. `externalId` is required because
 * it is the hospeda-side link (typically the user UUID from `users.id`).
 */
export interface CreateTestBillingCustomerInput {
    /** Hospeda-side user id; written to `external_id`. */
    readonly externalId: string;
    readonly email?: string;
    readonly name?: string;
    readonly status?: TestBillingCustomerStatus;
    readonly segment?: TestBillingCustomerSegment;
    readonly livemode?: boolean;
    readonly metadata?: Readonly<Record<string, unknown>>;
    /**
     * Map of payment-provider identifiers (e.g. `{ mercadopago: 'mp_cust_xxx' }`).
     * Required by qzpay-core flows that hit the provider with the customer's
     * provider-side id — specifically `billing.subscriptions.create` for the
     * monthly preapproval path (billing.ts:1258-1263 throws
     * `QZPayValidationError` if the entry for the active provider is missing).
     * One-time annual `billing.checkout.create({ mode: 'payment' })` does not
     * read this map, so tests that exercise the annual flow can leave it unset.
     * Defaults to `{}` to preserve backwards compatibility with existing tests.
     */
    readonly providerCustomerIds?: Readonly<Record<string, string>>;
}

/**
 * Result of {@link createTestBillingCustomer}.
 */
export interface CreateTestBillingCustomerResult {
    readonly customerId: string;
    readonly externalId: string;
    readonly email: string;
    readonly status: TestBillingCustomerStatus;
    readonly segment: TestBillingCustomerSegment;
}

/**
 * Insert a `billing_customers` row.
 *
 * @param input - Required `externalId` plus optional overrides
 * @param db - Drizzle client; defaults to {@link getDb}
 * @returns The created customer id and key fields
 */
export async function createTestBillingCustomer(
    input: CreateTestBillingCustomerInput,
    db: DrizzleClient = getDb()
): Promise<CreateTestBillingCustomerResult> {
    const email = input.email ?? `test-customer-${Date.now()}@example.com`;
    const status: TestBillingCustomerStatus = input.status ?? 'active';
    const segment: TestBillingCustomerSegment = input.segment ?? 'individual';

    // The qzpay drizzle schema stores provider customer ids in dedicated
    // columns (`mp_customer_id`, `stripe_customer_id`), NOT in a jsonb map.
    // The QZPayCustomer record reconstructs `providerCustomerIds` from those
    // columns at read time (see qzpay's customer mapper). Translate the
    // map-shaped helper input into the column-shaped insert values.
    const mpCustomerId = input.providerCustomerIds?.mercadopago;
    const stripeCustomerId = input.providerCustomerIds?.stripe;

    const inserted = await db
        .insert(billingCustomers)
        .values({
            externalId: input.externalId,
            email,
            name: input.name ?? 'Test Customer',
            status,
            segment,
            livemode: input.livemode ?? false,
            metadata: input.metadata ?? {},
            ...(mpCustomerId !== undefined ? { mpCustomerId } : {}),
            ...(stripeCustomerId !== undefined ? { stripeCustomerId } : {})
        } as typeof billingCustomers.$inferInsert)
        .returning({ id: billingCustomers.id });

    const row = inserted[0];
    if (!row) {
        throw new Error(
            `Insert of test billing customer for externalId=${input.externalId} returned no row`
        );
    }

    return {
        customerId: row.id,
        externalId: input.externalId,
        email,
        status,
        segment
    };
}

// ---------------------------------------------------------------------------
// billing_subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscription status values accepted by `billing_subscriptions.status`.
 */
export type TestSubscriptionStatus =
    | 'incomplete'
    | 'pending_provider'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'paused'
    | 'cancelled'
    | 'ended';

/**
 * Billing interval for the subscription. Must match the interval of the
 * associated price row (qzpay enforces this at the application layer; the DB
 * does not have a FK constraint linking subscription.intervalCount to
 * price.intervalCount).
 */
export type TestSubscriptionInterval = 'month' | 'year';

/**
 * Input for {@link createTestSubscription}. `customerId` and `planId` are
 * required; pass the values returned by {@link createTestBillingCustomer} and
 * {@link createTestPlan}/{@link seedBillingTestPlans} respectively.
 *
 * NOTE: `planId` is varchar in `billing_subscriptions` even though
 * `billing_plans.id` is UUID (engram gotcha — the legacy qzpay schema accepts
 * either the UUID string or a slug, the test factory passes the UUID).
 */
export interface CreateTestSubscriptionInput {
    readonly customerId: string;
    readonly planId: string;
    readonly billingInterval?: TestSubscriptionInterval;
    readonly intervalCount?: number;
    readonly status?: TestSubscriptionStatus;
    /** Defaults to now. */
    readonly currentPeriodStart?: Date;
    /** Defaults to now + 1 cycle. */
    readonly currentPeriodEnd?: Date;
    readonly providerSubscriptionId?: string;
    readonly livemode?: boolean;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result of {@link createTestSubscription}.
 */
export interface CreateTestSubscriptionResult {
    readonly subscriptionId: string;
    readonly customerId: string;
    readonly planId: string;
    readonly status: TestSubscriptionStatus;
    readonly currentPeriodStart: Date;
    readonly currentPeriodEnd: Date;
}

function defaultPeriodEnd(start: Date, interval: TestSubscriptionInterval, count: number): Date {
    const end = new Date(start);
    if (interval === 'year') {
        end.setFullYear(end.getFullYear() + count);
    } else {
        end.setMonth(end.getMonth() + count);
    }
    return end;
}

/**
 * Insert a `billing_subscriptions` row.
 *
 * @param input - Required customer + plan plus optional overrides
 * @param db - Drizzle client; defaults to {@link getDb}
 * @returns The created subscription id and key fields
 */
export async function createTestSubscription(
    input: CreateTestSubscriptionInput,
    db: DrizzleClient = getDb()
): Promise<CreateTestSubscriptionResult> {
    const subscriptionId = randomUUID();
    const billingInterval = input.billingInterval ?? 'month';
    const intervalCount = input.intervalCount ?? 1;
    const status: TestSubscriptionStatus = input.status ?? 'active';
    const currentPeriodStart = input.currentPeriodStart ?? new Date();
    const currentPeriodEnd =
        input.currentPeriodEnd ??
        defaultPeriodEnd(currentPeriodStart, billingInterval, intervalCount);

    await db.insert(billingSubscriptions).values({
        id: subscriptionId,
        customerId: input.customerId,
        planId: input.planId,
        billingInterval,
        intervalCount,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        providerSubscriptionId: input.providerSubscriptionId,
        livemode: input.livemode ?? false,
        metadata: input.metadata ?? { source: 'test-factory' }
    } as typeof billingSubscriptions.$inferInsert);

    return {
        subscriptionId,
        customerId: input.customerId,
        planId: input.planId,
        status,
        currentPeriodStart,
        currentPeriodEnd
    };
}

// ---------------------------------------------------------------------------
// billing_addons (catalog)
// ---------------------------------------------------------------------------

/**
 * Addon billing kind matching `billing_addons.billing_type`.
 */
export type TestAddonBillingType = 'one_time' | 'recurring';

/**
 * Input for {@link createTestAddon}.
 */
export interface CreateTestAddonInput {
    readonly slug?: string;
    readonly name?: string;
    readonly description?: string;
    readonly billingType?: TestAddonBillingType;
    /** Stored in centavos. */
    readonly unitAmount?: number;
    readonly currency?: string;
    readonly active?: boolean;
    readonly livemode?: boolean;
    readonly entitlements?: readonly string[];
    readonly limits?: Readonly<Record<string, number>>;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result of {@link createTestAddon}.
 */
export interface CreateTestAddonResult {
    readonly addonId: string;
    readonly slug: string;
    readonly name: string;
    readonly billingType: TestAddonBillingType;
    readonly unitAmount: number;
}

/**
 * Insert a `billing_addons` catalog row.
 *
 * Distinct from {@link createTestSubscriptionAddon} which links a subscription
 * to a purchased addon.
 *
 * NOTE: the DB column is `billing_interval` (NOT NULL); the Drizzle JS key is
 * `billingInterval`. Using `billingType` as the key (the old bug) silently fails
 * the NOT NULL constraint — fixed here.
 *
 * @param input - All fields optional
 * @param db - Drizzle client; defaults to {@link getDb}
 */
export async function createTestAddon(
    input: CreateTestAddonInput = {},
    db: DrizzleClient = getDb()
): Promise<CreateTestAddonResult> {
    const timestamp = Date.now();
    const slug = input.slug ?? `test-addon-${timestamp}`;
    const name = input.name ?? `Test Addon ${timestamp}`;
    const billingType: TestAddonBillingType = input.billingType ?? 'one_time';
    const unitAmount = input.unitAmount ?? 50_000; // 500 ARS

    const inserted = await db
        .insert(billingAddons)
        .values({
            name,
            description: input.description ?? `E2E test addon ${slug}`,
            // billingInterval is the correct Drizzle key (maps to the NOT NULL
            // `billing_interval` DB column). The old `billingType` key caused a
            // silent NOT NULL violation — fixed here.
            billingInterval: billingType,
            unitAmount,
            currency: input.currency ?? 'ARS',
            active: input.active ?? true,
            livemode: input.livemode ?? false,
            entitlements: [...(input.entitlements ?? [])],
            limits: { ...(input.limits ?? {}) },
            metadata: {
                slug,
                ...(input.metadata ?? {})
            }
        } as typeof billingAddons.$inferInsert)
        .returning({ id: billingAddons.id });

    const row = inserted[0];
    if (!row) {
        throw new Error(`Insert of test addon "${slug}" returned no row`);
    }

    return {
        addonId: row.id,
        slug,
        name,
        billingType,
        unitAmount
    };
}

// ---------------------------------------------------------------------------
// billing_subscription_addons (link table)
// ---------------------------------------------------------------------------

/**
 * Input for {@link createTestSubscriptionAddon}. Both ids are required.
 *
 * NOTE: this table has NO `livemode` and NO `deleted_at` columns (engram gotcha).
 */
export interface CreateTestSubscriptionAddonInput {
    readonly subscriptionId: string;
    readonly addonId: string;
    /** Defaults to now. */
    readonly startsAt?: Date;
    /** Optional expiry (one-time addons). */
    readonly expiresAt?: Date;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result of {@link createTestSubscriptionAddon}.
 */
export interface CreateTestSubscriptionAddonResult {
    readonly id: string;
    readonly subscriptionId: string;
    readonly addonId: string;
    readonly startsAt: Date;
    readonly expiresAt: Date | null;
}

/**
 * Link a subscription to an addon by inserting a row into
 * `billing_subscription_addons`.
 *
 * @param input - Required ids plus optional dates / metadata
 * @param db - Drizzle client; defaults to {@link getDb}
 */
export async function createTestSubscriptionAddon(
    input: CreateTestSubscriptionAddonInput,
    db: DrizzleClient = getDb()
): Promise<CreateTestSubscriptionAddonResult> {
    const startsAt = input.startsAt ?? new Date();
    const expiresAt = input.expiresAt ?? null;

    const inserted = await db
        .insert(billingSubscriptionAddons)
        .values({
            subscriptionId: input.subscriptionId,
            addonId: input.addonId,
            startsAt,
            expiresAt,
            metadata: input.metadata ?? {}
        } as typeof billingSubscriptionAddons.$inferInsert)
        .returning({ id: billingSubscriptionAddons.id });

    const row = inserted[0];
    if (!row) {
        throw new Error(
            `Insert of test subscription_addon (sub=${input.subscriptionId}, addon=${input.addonId}) returned no row`
        );
    }

    return {
        id: row.id,
        subscriptionId: input.subscriptionId,
        addonId: input.addonId,
        startsAt,
        expiresAt
    };
}

// ---------------------------------------------------------------------------
// billing_promo_codes
// ---------------------------------------------------------------------------

/**
 * Promo code kind matching `billing_promo_codes.type`.
 */
export type TestPromoCodeKind = 'percentage' | 'fixed';

/**
 * Input for {@link createTestPromoCode}.
 */
export interface CreateTestPromoCodeInput {
    /** Code string the user types. Defaults to a random TEST-<8 hex>. */
    readonly code?: string;
    readonly type?: TestPromoCodeKind;
    /** Percentage points (0-100) for `percentage`, centavos for `fixed`. */
    readonly value?: number;
    readonly active?: boolean;
    readonly maxUses?: number;
    readonly usedCount?: number;
    readonly expiresAt?: Date | null;
    readonly validPlans?: readonly string[] | null;
    readonly newCustomersOnly?: boolean;
    readonly livemode?: boolean;
    readonly config?: Readonly<Record<string, unknown>>;
}

/**
 * Result of {@link createTestPromoCode}.
 */
export interface CreateTestPromoCodeResult {
    readonly promoCodeId: string;
    readonly code: string;
    readonly type: TestPromoCodeKind;
    readonly value: number;
    readonly maxUses: number;
}

/**
 * Insert a `billing_promo_codes` row.
 *
 * @param input - All fields optional
 * @param db - Drizzle client; defaults to {@link getDb}
 */
export async function createTestPromoCode(
    input: CreateTestPromoCodeInput = {},
    db: DrizzleClient = getDb()
): Promise<CreateTestPromoCodeResult> {
    const code = input.code ?? `TEST-${randomUUID().slice(0, 8).toUpperCase()}`;
    const type: TestPromoCodeKind = input.type ?? 'percentage';
    const value = input.value ?? 10;
    const maxUses = input.maxUses ?? 100;

    const inserted = await db
        .insert(billingPromoCodes)
        .values({
            code,
            type,
            value,
            active: input.active ?? true,
            maxUses,
            usedCount: input.usedCount ?? 0,
            expiresAt: input.expiresAt,
            validPlans: input.validPlans,
            newCustomersOnly: input.newCustomersOnly ?? false,
            livemode: input.livemode ?? false,
            config: input.config ?? { description: `E2E test code ${code}` }
        } as typeof billingPromoCodes.$inferInsert)
        .returning({ id: billingPromoCodes.id });

    const row = inserted[0];
    if (!row) {
        throw new Error(`Insert of test promo code "${code}" returned no row`);
    }

    return {
        promoCodeId: row.id,
        code,
        type,
        value,
        maxUses
    };
}
