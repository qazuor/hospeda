/**
 * Admin billing VIEW — shared types, join fragments and row mappers
 *
 * Split out of `admin-billing-view.service.ts` to keep both files inside the
 * repo's 500-line ceiling. The seam is deliberate rather than arbitrary: this
 * module owns everything that describes HOW a stored row becomes a DTO, while
 * the service owns the queries that decide WHICH rows are fetched. The two
 * list queries share every piece in here, which is what keeps the payments and
 * subscriptions mappings from drifting apart.
 *
 * @module services/admin-billing-view.shared
 */

import { billingCustomers, billingPlans, billingSubscriptions, safeIlike, users } from '@repo/db';
import type {
    AdminBillingPlanRef,
    AdminBillingUserRef,
    AdminPaymentView,
    AdminSubscriptionView
} from '@repo/schemas';
import { or, type SQL, sql } from 'drizzle-orm';
import { apiLogger } from '../utils/logger';

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
export interface JoinedRefColumns {
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
export const REF_COLUMNS = {
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
export const CUSTOMER_TO_USER_JOIN: SQL = sql`${users.id}::text = ${billingCustomers.externalId}`;

/**
 * Join predicate for `billing_subscriptions.plan_id` → `billing_plans.id`.
 * @see the module doc for why the cast lives on the uuid side.
 */
export const SUBSCRIPTION_TO_PLAN_JOIN: SQL = sql`${billingPlans.id}::text = ${billingSubscriptions.planId}`;

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
export function mapUserRef(row: JoinedRefColumns): AdminBillingUserRef | null {
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
export function mapPlanRef(row: JoinedRefColumns): AdminBillingPlanRef | null {
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
export function extractProviderPaymentId(params: {
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
export function assertKnownStatus<T>(params: {
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
export function buildPagination(params: {
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
export function buildIdentitySearchCondition(search: string): SQL | undefined {
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
