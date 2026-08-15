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
    users
} from '@repo/db';
import type {
    AdminPaymentView,
    AdminPaymentViewSearch,
    AdminSubscriptionView,
    AdminSubscriptionViewSearch
} from '@repo/schemas';
import { and, count, desc, eq, gte, inArray, isNull, lte, type SQL } from 'drizzle-orm';
import {
    assertKnownStatus,
    buildIdentitySearchCondition,
    buildPagination,
    CUSTOMER_TO_USER_JOIN,
    extractProviderPaymentId,
    type ListAdminPaymentsResult,
    type ListAdminSubscriptionsResult,
    mapPlanRef,
    mapUserRef,
    REF_COLUMNS,
    SUBSCRIPTION_TO_PLAN_JOIN
} from './admin-billing-view.shared';
import {
    isPaymentRefundable,
    normalizePaymentStatusForView,
    normalizeSubscriptionStatusForView,
    resolveRecurringAmountInCents,
    widenPaymentStatusFilter,
    widenSubscriptionStatusFilter
} from './admin-billing-view.status';

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
