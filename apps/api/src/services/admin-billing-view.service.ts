/**
 * Admin billing VIEW service — payments + subscriptions
 *
 * DB-backed read model behind `GET /api/v1/admin/billing/payments` and
 * `GET /api/v1/admin/billing/subscriptions`.
 *
 * ## Why this exists instead of the qzpay admin tier
 *
 * Those two paths used to be served raw by `@qazuor/qzpay-hono`'s
 * `createAdminRoutes()`. qzpay's storage shape carries a `customerId` and a
 * `planId` and nothing else — no user, no plan slug, no amount for a
 * subscription — because qzpay does not know Hospeda's `users` table and keeps
 * prices on the plan rather than the subscription. No client-side adapter can
 * invent those fields, so the enrichment has to happen here, next to the joins.
 *
 * This module only READS. Every write path (`/refund`, `/cancel`,
 * `/change-plan`, `/extend-trial`, ...) and the single-resource `GET /:id`
 * remain owned by the qzpay tier, which is still mounted — these routes shadow
 * exactly two collection paths and nothing else.
 *
 * ## Joins that are not obvious
 *
 * - `billing_customers.external_id` (varchar) → `users.id` (uuid). The cast goes
 *   on the uuid side (`users.id::text`), never the other way: `external_id` is
 *   free-form text and casting a non-uuid value to uuid errors the whole query
 *   instead of just failing to match. The join is LEFT — a billing customer can
 *   outlive its user row, and an operator still needs to see the payment.
 * - `billing_subscriptions.plan_id` (varchar) → `billing_plans.id` (uuid). The
 *   column is a varchar that stores a UUID. That is the shipped schema, not a
 *   defect; same cast rule applies.
 *
 * @module services/admin-billing-view.service
 */

import {
    billingCustomers,
    billingPayments,
    billingPlans,
    billingSubscriptions,
    getDb,
    safeIlike,
    users
} from '@repo/db';
import type {
    AdminBillingPlanRef,
    AdminBillingUserRef,
    AdminPaymentView,
    AdminPaymentViewSearch,
    AdminSubscriptionView,
    AdminSubscriptionViewSearch
} from '@repo/schemas';
import { and, count, desc, eq, gte, inArray, isNull, lte, or, type SQL, sql } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';
import {
    isPaymentRefundable,
    normalizePaymentStatusForView,
    normalizeSubscriptionStatusForView,
    resolveRecurringAmountInCents,
    widenPaymentStatusFilter,
    widenSubscriptionStatusFilter
} from './admin-billing-view.status';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Pagination envelope expected by the API's list-route factory.
 * Mirrors `PaginationMetadata` in `utils/response-helpers.ts`.
 */
export interface AdminBillingViewPagination {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPreviousPage: boolean;
}

/** Result of {@link listPayments}. */
export interface ListAdminPaymentsResult {
    readonly items: readonly AdminPaymentView[];
    readonly pagination: AdminBillingViewPagination;
}

/** Result of {@link listSubscriptions}. */
export interface ListAdminSubscriptionsResult {
    readonly items: readonly AdminSubscriptionView[];
    readonly pagination: AdminBillingViewPagination;
}

/**
 * The customer/user/plan columns both queries select, shared so the two row
 * mappers cannot drift apart.
 */
interface JoinedRefColumns {
    readonly customerEmail: string;
    readonly customerName: string | null;
    readonly userId: string | null;
    readonly userDisplayName: string | null;
    readonly userFirstName: string | null;
    readonly userLastName: string | null;
    readonly userEmail: string | null;
    readonly planId: string | null;
    readonly planSlug: string | null;
    readonly planDisplayName: string | null;
    readonly planMonthlyPriceInCents: number | null;
    readonly planAnnualPriceInCents: number | null;
    readonly planProductDomain: string | null;
}

// ---------------------------------------------------------------------------
// Shared select fragments
// ---------------------------------------------------------------------------

/** Column projection for the joined user/customer/plan references. */
const REF_COLUMNS = {
    customerEmail: billingCustomers.email,
    customerName: billingCustomers.name,
    userId: users.id,
    userDisplayName: users.displayName,
    userFirstName: users.firstName,
    userLastName: users.lastName,
    userEmail: users.email,
    planId: billingPlans.id,
    planSlug: billingPlans.name,
    planDisplayName: billingPlans.displayName,
    planMonthlyPriceInCents: billingPlans.monthlyPriceArs,
    planAnnualPriceInCents: billingPlans.annualPriceArs,
    planProductDomain: billingPlans.productDomain
} as const;

/**
 * Join predicate for `billing_customers.external_id` → `users.id`.
 * @see the module doc for why the cast lives on the uuid side.
 */
const CUSTOMER_TO_USER_JOIN: SQL = sql`${users.id}::text = ${billingCustomers.externalId}`;

/**
 * Join predicate for `billing_subscriptions.plan_id` → `billing_plans.id`.
 * @see the module doc for why the cast lives on the uuid side.
 */
const SUBSCRIPTION_TO_PLAN_JOIN: SQL = sql`${billingPlans.id}::text = ${billingSubscriptions.planId}`;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Build the user reference for a row, or `null` when the `users` row is gone.
 *
 * The display name degrades through the sources an operator would accept, in
 * order: the user's own display name, their first/last name, the name held by
 * the billing customer, and finally the email. It never degrades to an empty
 * string — an empty cell is what made the previous screen unreadable.
 */
function mapUserRef(row: JoinedRefColumns): AdminBillingUserRef | null {
    if (!row.userId) {
        return null;
    }

    const fullName = [row.userFirstName, row.userLastName].filter(Boolean).join(' ').trim();
    const email = row.userEmail ?? row.customerEmail;
    const displayName =
        row.userDisplayName?.trim() || fullName || row.customerName?.trim() || email;

    return { id: row.userId, displayName, email };
}

/**
 * Build the plan reference for a row, or `null` when no plan resolved.
 *
 * A null plan is a real state (a one-off payment with no subscription, or a
 * subscription whose plan row was hard-deleted) and must reach the UI as null
 * rather than as a default plan — defaulting is what rendered every subscription
 * as "Turista".
 */
function mapPlanRef(row: JoinedRefColumns): AdminBillingPlanRef | null {
    if (!row.planId || !row.planSlug) {
        return null;
    }

    return {
        id: row.planId,
        slug: row.planSlug,
        displayName: row.planDisplayName ?? row.planSlug,
        monthlyPriceInCents: row.planMonthlyPriceInCents ?? null,
        productDomain: row.planProductDomain ?? null
    };
}

/**
 * Extract the provider-side payment identifier from qzpay's
 * `provider_payment_ids` jsonb (shape: `{ "<provider>": "<id>" }`).
 *
 * Prefers the entry keyed by the row's own provider, then falls back to the
 * first string value present. Returns `null` rather than `""` when absent.
 */
function extractProviderPaymentId(params: {
    readonly providerPaymentIds: unknown;
    readonly provider: string | null;
}): string | null {
    const ids = params.providerPaymentIds;
    if (!ids || typeof ids !== 'object' || Array.isArray(ids)) {
        return null;
    }

    const record = ids as Record<string, unknown>;
    const preferred = params.provider ? record[params.provider] : undefined;
    if (typeof preferred === 'string' && preferred.length > 0) {
        return preferred;
    }

    for (const value of Object.values(record)) {
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }

    return null;
}

/**
 * Raise on a status the vocabulary does not know.
 *
 * Deliberately loud. The alternative — coercing to a plausible state or dropping
 * the row — is how the original defect stayed invisible: an unrenderable row
 * silently became a missing row, and nobody could tell a filter bug from an
 * empty result. The response pipeline is fail-closed anyway
 * (`stripWithSchema` 500s on a payload the schema rejects), so this only makes
 * the diagnostic name the offending row.
 */
function assertKnownStatus<T>(params: {
    readonly normalised: T | null;
    readonly rawStatus: string;
    readonly rowId: string;
    readonly table: string;
}): T {
    if (params.normalised === null) {
        apiLogger.error(
            { rowId: params.rowId, rawStatus: params.rawStatus, table: params.table },
            'Admin billing view: unknown stored status, cannot map to the admin vocabulary'
        );
        throw new Error(
            `Unknown ${params.table}.status "${params.rawStatus}" on row ${params.rowId}`
        );
    }
    return params.normalised;
}

/** Build the pagination envelope from a total row count. */
function buildPagination(params: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
}): AdminBillingViewPagination {
    const { page, pageSize, total } = params;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
    };
}

/**
 * Free-text condition over the payer/subscriber identity.
 *
 * Uses `safeIlike` from `@repo/db` (never drizzle's raw `ilike`) so `%`, `_` and
 * `\` in operator input are escaped instead of behaving as wildcards.
 */
function buildIdentitySearchCondition(search: string): SQL | undefined {
    const term = search.trim();
    if (term.length === 0) {
        return undefined;
    }

    return or(
        safeIlike(billingCustomers.email, term),
        safeIlike(billingCustomers.name, term),
        safeIlike(users.displayName, term),
        safeIlike(users.email, term)
    );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * List billing payments enriched with the paying user and the plan behind them.
 *
 * @param params - Normalised filters, `page`/`pageSize` (admin convention — never `limit`).
 * @returns The page of payment views plus its pagination envelope.
 *
 * @example
 * ```ts
 * const { items } = await listPayments({ status: 'succeeded', page: 1, pageSize: 20 });
 * ```
 */
export async function listPayments(
    params: AdminPaymentViewSearch
): Promise<ListAdminPaymentsResult> {
    const db = getDb();
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [isNull(billingPayments.deletedAt)];

    if (params.status) {
        // Widened so a normalised filter value matches every spelling the
        // column physically holds. See admin-billing-view.status.ts.
        conditions.push(
            inArray(billingPayments.status, [
                ...widenPaymentStatusFilter({ status: params.status })
            ])
        );
    }

    if (params.search) {
        const searchCondition = buildIdentitySearchCondition(params.search);
        if (searchCondition) {
            conditions.push(searchCondition);
        }
    }

    if (params.startDate) {
        conditions.push(gte(billingPayments.createdAt, new Date(params.startDate)));
    }

    if (params.endDate) {
        conditions.push(lte(billingPayments.createdAt, new Date(params.endDate)));
    }

    if (params.minAmountInCents !== undefined) {
        conditions.push(gte(billingPayments.amount, params.minAmountInCents));
    }

    if (params.maxAmountInCents !== undefined) {
        conditions.push(lte(billingPayments.amount, params.maxAmountInCents));
    }

    const whereClause = and(...conditions);

    const totalRows = await db
        .select({ total: count() })
        .from(billingPayments)
        .innerJoin(billingCustomers, eq(billingPayments.customerId, billingCustomers.id))
        .leftJoin(users, CUSTOMER_TO_USER_JOIN)
        .leftJoin(billingSubscriptions, eq(billingPayments.subscriptionId, billingSubscriptions.id))
        .leftJoin(billingPlans, SUBSCRIPTION_TO_PLAN_JOIN)
        .where(whereClause);

    const total = totalRows[0]?.total ?? 0;

    const rows = await db
        .select({
            id: billingPayments.id,
            amountInCents: billingPayments.amount,
            currency: billingPayments.currency,
            refundedAmountInCents: billingPayments.refundedAmount,
            rawStatus: billingPayments.status,
            createdAt: billingPayments.createdAt,
            subscriptionId: billingPayments.subscriptionId,
            invoiceId: billingPayments.invoiceId,
            provider: billingPayments.provider,
            providerPaymentIds: billingPayments.providerPaymentIds,
            ...REF_COLUMNS
        })
        .from(billingPayments)
        .innerJoin(billingCustomers, eq(billingPayments.customerId, billingCustomers.id))
        .leftJoin(users, CUSTOMER_TO_USER_JOIN)
        .leftJoin(billingSubscriptions, eq(billingPayments.subscriptionId, billingSubscriptions.id))
        .leftJoin(billingPlans, SUBSCRIPTION_TO_PLAN_JOIN)
        .where(whereClause)
        .orderBy(desc(billingPayments.createdAt))
        .limit(pageSize)
        .offset(offset);

    const items: AdminPaymentView[] = rows.map((row) => {
        const status = assertKnownStatus({
            normalised: normalizePaymentStatusForView({ rawStatus: row.rawStatus }),
            rawStatus: row.rawStatus,
            rowId: row.id,
            table: 'billing_payments'
        });

        const amountInCents = row.amountInCents;
        const refundedAmountInCents = row.refundedAmountInCents ?? 0;

        return {
            id: row.id,
            amountInCents,
            currency: row.currency,
            refundedAmountInCents,
            status,
            createdAt: row.createdAt.toISOString(),
            user: mapUserRef(row),
            plan: mapPlanRef(row),
            subscriptionId: row.subscriptionId ?? null,
            invoiceId: row.invoiceId ?? null,
            provider: row.provider ?? null,
            providerPaymentId: extractProviderPaymentId({
                providerPaymentIds: row.providerPaymentIds,
                provider: row.provider ?? null
            }),
            isRefundable: isPaymentRefundable({ status, amountInCents, refundedAmountInCents })
        };
    });

    return { items, pagination: buildPagination({ page, pageSize, total }) };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * List billing subscriptions enriched with the subscriber, the plan, and the
 * recurring amount derived from that plan's price for the billing interval.
 *
 * @param params - Normalised filters, `page`/`pageSize` (admin convention — never `limit`).
 * @returns The page of subscription views plus its pagination envelope.
 *
 * @example
 * ```ts
 * // Matches rows stored as `cancelled` AND as qzpay's `canceled`.
 * const { items } = await listSubscriptions({ status: 'cancelled', page: 1, pageSize: 20 });
 * ```
 */
export async function listSubscriptions(
    params: AdminSubscriptionViewSearch
): Promise<ListAdminSubscriptionsResult> {
    const db = getDb();
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [isNull(billingSubscriptions.deletedAt)];

    if (params.status) {
        // THE fix for "the Cancelada filter finds 2 of 8": one normalised value
        // expands to every spelling the column physically holds.
        conditions.push(
            inArray(billingSubscriptions.status, [
                ...widenSubscriptionStatusFilter({ status: params.status })
            ])
        );
    }

    if (params.planSlug) {
        conditions.push(eq(billingPlans.name, params.planSlug));
    }

    if (params.productDomain) {
        conditions.push(eq(billingSubscriptions.productDomain, params.productDomain));
    }

    if (params.search) {
        const searchCondition = buildIdentitySearchCondition(params.search);
        if (searchCondition) {
            conditions.push(searchCondition);
        }
    }

    const whereClause = and(...conditions);

    const totalRows = await db
        .select({ total: count() })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingSubscriptions.customerId, billingCustomers.id))
        .leftJoin(users, CUSTOMER_TO_USER_JOIN)
        .leftJoin(billingPlans, SUBSCRIPTION_TO_PLAN_JOIN)
        .where(whereClause);

    const total = totalRows[0]?.total ?? 0;

    const rows = await db
        .select({
            id: billingSubscriptions.id,
            rawStatus: billingSubscriptions.status,
            billingInterval: billingSubscriptions.billingInterval,
            currentPeriodStart: billingSubscriptions.currentPeriodStart,
            currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
            trialEnd: billingSubscriptions.trialEnd,
            cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
            createdAt: billingSubscriptions.createdAt,
            productDomain: billingSubscriptions.productDomain,
            ...REF_COLUMNS
        })
        .from(billingSubscriptions)
        .innerJoin(billingCustomers, eq(billingSubscriptions.customerId, billingCustomers.id))
        .leftJoin(users, CUSTOMER_TO_USER_JOIN)
        .leftJoin(billingPlans, SUBSCRIPTION_TO_PLAN_JOIN)
        .where(whereClause)
        .orderBy(desc(billingSubscriptions.createdAt))
        .limit(pageSize)
        .offset(offset);

    const items: AdminSubscriptionView[] = rows.map((row) => {
        const status = assertKnownStatus({
            normalised: normalizeSubscriptionStatusForView({ rawStatus: row.rawStatus }),
            rawStatus: row.rawStatus,
            rowId: row.id,
            table: 'billing_subscriptions'
        });

        return {
            id: row.id,
            status,
            rawStatus: row.rawStatus,
            user: mapUserRef(row),
            plan: mapPlanRef(row),
            recurringAmountInCents: resolveRecurringAmountInCents({
                billingInterval: row.billingInterval ?? null,
                monthlyPriceInCents: row.planMonthlyPriceInCents ?? null,
                annualPriceInCents: row.planAnnualPriceInCents ?? null
            }),
            billingInterval: row.billingInterval ?? null,
            currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
            trialEnd: row.trialEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? false,
            createdAt: row.createdAt.toISOString(),
            productDomain: row.productDomain ?? null
        };
    });

    return { items, pagination: buildPagination({ page, pageSize, total }) };
}
