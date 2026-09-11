/**
 * The duplicate-subscription guard the four creation primitives run on their
 * own behalf (HOS-1322).
 *
 * ---
 * WHY IT LIVES HERE AND NOT IN THE CALLERS
 *
 * Every duplicate guard on this surface used to live in a caller — `start-paid.ts`
 * has one, `routes/commerce/protected/start-subscription.ts` has one,
 * `commerce-subscription-attach.service.ts` has one scoped to its own vertical —
 * and none of the four primitives that actually mint a subscription had any. So
 * the same defect was fixed four times, in four call sites, by four issues, and
 * stayed alive in every path that was not one of them: `reactivateFromTrial`
 * (`trial.service.ts`), the admin commerce `start-subscription`, the admin
 * `partners/{id}/send-link`, and the rest of the seven this issue enumerates.
 *
 * The failure mode is a DOUBLE CHARGE — two live MercadoPago preapprovals on one
 * customer for one vertical — and it is invisible from the API, because both
 * requests answer 2xx with a valid checkout URL.
 *
 * Placing the check inside the primitives inverts the default: a new checkout
 * path is guarded because it calls the primitive, not because its author
 * remembered. The caller-side guards stay where they are (defence in depth, and
 * they answer with more specific messages — a pending soft-cancel, a listing that
 * already has its own subscription); this is the floor beneath them.
 *
 * ---
 * IT FILTERS BY DOMAIN, AND THAT IS THE HALF THAT IS EASY TO GET WRONG
 *
 * One billing customer legitimately holds several subscriptions at once: a host
 * who also runs a restaurant holds an `accommodation` one and a `gastronomy` one
 * (`host-provider@local.test` is seeded to prove it). A guard that asked only
 * `WHERE customer_id = ?` would refuse that host's gastronomy checkout — a
 * refused legitimate purchase, which is a worse outcome than the bug it set out
 * to fix, because it is silent from the buyer's side too: they simply cannot pay.
 *
 * So the comparison runs through {@link subscriptionMatchesDomain}, the ONE place
 * in the codebase that compares a subscription's domain, and inherits its
 * deliberate asymmetry: `accommodation` fails OPEN (a `null` column is a legacy
 * row and still counts), every other domain fails CLOSED. Applied here that reads
 * exactly right — a pre-column row blocks an accommodation duplicate and does not
 * block a gastronomy purchase.
 *
 * The rows are read STRAIGHT OFF `billing_subscriptions` with Drizzle rather than
 * through `billing.subscriptions.getByCustomerId()`, which never populates
 * `productDomain` (HOS-934) and would make every non-accommodation comparison a
 * silent no-op. That is exemption (b) of
 * `scripts/check-subscription-domain-hydration.sh`.
 *
 * ---
 * `addon` IS EXEMPT, ON PURPOSE
 *
 * A recurring add-on's subscription carries `product_domain = 'addon'`
 * (HOS-847), and one customer legitimately holds SEVERAL of them at once — they
 * are purchases, not a plan. Worse, an add-on borrows the owner's own plan row to
 * satisfy qzpay's plan+price requirement (`addon.checkout.recurring-resolve.ts`),
 * so the plan-resolved domain of an add-on checkout is the OWNER's vertical.
 * Guarding that would refuse every add-on purchase by a subscribed host. Hence
 * both halves of the exemption: the `addon` domain is skipped, and the callers
 * that mint one state their real domain (see `subscriptionProductDomain` on
 * {@link CreatePaidSubscriptionInput}) instead of letting the borrowed plan speak
 * for them.
 *
 * @module services/billing/duplicate-subscription-guard
 */

import { isLiveSubscriptionStatus } from '@repo/billing';
import { and, billingSubscriptions, type DrizzleClient, eq, getDb, isNull } from '@repo/db';
import { ProductDomainEnum, type ProductDomainValue, ServiceErrorCode } from '@repo/schemas';
import { ServiceError, subscriptionMatchesDomain } from '@repo/service-core';
import { apiLogger } from '../../utils/logger.js';

/**
 * The `error.code` every duplicate refusal carries, on every path.
 *
 * Deliberately the same string `start-paid.ts`'s own caller-side guard already
 * answers with: a client that learned to read one of them reads all of them, and
 * the two refusals mean the same thing to the buyer.
 */
export const DUPLICATE_SUBSCRIPTION_ERROR_CODE = 'ALREADY_SUBSCRIBED';

/**
 * The self-serve exit a customer actually has, per domain — and nothing else.
 *
 * MEASURED against this worktree on 2026-09-10 rather than taken from an issue
 * description, because two issues disagreed about it and a refusal that names a
 * remedy the platform does not have is worse than no message at all: it sends the
 * buyer to a 404 and costs them the complaint.
 *
 * - `accommodation` / `tourist` — `POST /api/v1/protected/billing/subscriptions/change-plan`
 *   (`routes/billing/plan-change.ts`), which selects the accommodation-or-tourist
 *   subscription via `selectAccommodationSubscription` and refuses a target slug
 *   from any other domain (`assertAccommodationPlanChangeTarget`).
 * - `gastronomy` / `experience` — `POST /api/v1/protected/commerce/subscriptions/{entityType}/change-plan`
 *   (`routes/commerce/protected/change-plan.ts:711`). BOTH directions work: a
 *   dearer tier is charged now, a cheaper one is scheduled for period end. The
 *   "commerce can only upgrade, a downgrade answers 422" state HOS-1122 describes
 *   is that issue's BEFORE, and its own fix has landed here.
 * - `partner` — no self-serve plan-change route exists for partner tiers, so the
 *   only honest exit is support.
 *
 * Cancellation is deliberately NOT offered anywhere in these strings.
 * `subscription-cancel.ts` exposes exactly one cancel — a soft-cancel that runs
 * to the end of the period (`UserCancelSubscriptionResponseSchema.cancelAtPeriodEnd`
 * is `z.literal(true)`) — plus its undo, and the whole route is behind
 * `HOSPEDA_USER_CANCEL_ENABLED`, which defaults to `false` and answers 404 when
 * off. Telling a buyer to cancel is therefore a remedy that may not exist for
 * them at all.
 */
const REMEDY_BY_DOMAIN: Readonly<Record<string, string>> = {
    [ProductDomainEnum.ACCOMMODATION]:
        'To move to another plan, use POST /api/v1/protected/billing/subscriptions/change-plan.',
    [ProductDomainEnum.TOURIST]:
        'To move to another plan, use POST /api/v1/protected/billing/subscriptions/change-plan.',
    [ProductDomainEnum.GASTRONOMY]:
        'To move to another tier, use POST /api/v1/protected/commerce/subscriptions/gastronomy/change-plan. To cover another listing, publish it — it attaches to the subscription you already pay for, with no second charge.',
    [ProductDomainEnum.EXPERIENCE]:
        'To move to another tier, use POST /api/v1/protected/commerce/subscriptions/experience/change-plan. To cover another listing, publish it — it attaches to the subscription you already pay for, with no second charge.',
    [ProductDomainEnum.PARTNER]:
        'Partner tiers have no self-serve plan change — please contact support to change it.'
};

/** Fallback remedy for a domain with no entry above. Names no route at all. */
const DEFAULT_REMEDY = 'Please contact support to change it.';

/**
 * Narrows the raw `product_domain` string the primitives carry to the canonical
 * union {@link subscriptionMatchesDomain} accepts.
 *
 * The primitives type this field as a plain `string` because the column is one
 * and because two of them receive it straight off a row (`string | null`). A
 * runtime check is therefore the honest way to reach the union — a bare cast
 * would assert something no caller has proved.
 *
 * @param value - The raw domain string.
 * @returns Whether it names a member of {@link ProductDomainEnum}.
 */
function isKnownProductDomain(value: string): value is ProductDomainValue {
    return (Object.values(ProductDomainEnum) as readonly string[]).includes(value);
}

/**
 * Input for {@link assertNoLiveSubscriptionForDomain}.
 */
export interface AssertNoLiveSubscriptionForDomainInput {
    /** The billing customer the new subscription would belong to. */
    readonly customerId: string;
    /**
     * The domain the new subscription ROW would belong to, as the primitives
     * carry it — a raw `string`, because that is what the column is and what two
     * of the four already receive off a row. A value outside
     * {@link ProductDomainEnum} is logged and lets the creation through: the
     * canonical predicate cannot place it, and of the two ways to be wrong about
     * a domain nobody can name, refusing a legitimate purchase is the one that
     * silently costs money.
     */
    readonly productDomain: string;
    /**
     * The ids of the subscriptions this creation REPLACES, excluded from the scan.
     *
     * Three real flows convert or re-mint an existing row rather than adding a
     * second one — trial → paid reactivation (`trial.service.ts`), the past-due
     * payment-method replacement, and the HOS-937 preapproval retry — and all
     * three legitimately run while a live row exists in the same domain. NAMING
     * the rows is what separates them from a duplicate: the exemption is a list
     * of ids, never a boolean, so it cannot be used to switch the guard off
     * wholesale, and a live subscription that is not on the list still refuses.
     *
     * A list rather than one id because `reactivateFromTrial` already collects
     * the trialing subscriptions it supersedes as a set — one is the expected
     * case, and it defensively covers more without dropping any.
     */
    readonly supersedesSubscriptionIds?: readonly string[];
    /**
     * Read client. Pass the caller's transaction when the creation runs inside
     * one, so the check and the insert see the same snapshot.
     */
    readonly db?: DrizzleClient;
    /** Label folded into the log line, naming which primitive refused. */
    readonly source: string;
}

/**
 * Refuse to create a second live subscription for one customer in one domain.
 *
 * @param input - See {@link AssertNoLiveSubscriptionForDomainInput}.
 * @throws {ServiceError} `ALREADY_EXISTS` (HTTP 409, `error.code`
 *   {@link DUPLICATE_SUBSCRIPTION_ERROR_CODE}) when the customer already holds a
 *   subscription in this domain whose status is live per
 *   `isLiveSubscriptionStatus` — `active`, `trialing`, `comp`, `courtesy` or
 *   `past_due`, in either the Hospeda or the qzpay spelling.
 *
 * @example
 * ```ts
 * await assertNoLiveSubscriptionForDomain({
 *   customerId,
 *   productDomain: ProductDomainEnum.GASTRONOMY,
 *   source: 'createPendingProviderSubscription'
 * });
 * ```
 */
export async function assertNoLiveSubscriptionForDomain(
    input: AssertNoLiveSubscriptionForDomainInput
): Promise<void> {
    const { customerId, productDomain, source } = input;
    const supersedes = new Set(input.supersedesSubscriptionIds ?? []);

    // See the module docblock: an add-on is a purchase, not a plan, and several
    // concurrent ones are the normal case.
    if (productDomain === ProductDomainEnum.ADDON) {
        return;
    }

    if (!isKnownProductDomain(productDomain)) {
        apiLogger.warn(
            { source, customerId, productDomain },
            'HOS-1322: duplicate-subscription guard skipped — the product domain is not a ProductDomainEnum member and cannot be compared'
        );
        return;
    }

    const readClient = input.db ?? getDb();

    // Statuses are compared in TypeScript and never in SQL. `billing_subscriptions.status`
    // holds TWO vocabularies (Hospeda's and qzpay's `incomplete` / `unpaid` /
    // `canceled`), and `isLiveSubscriptionStatus` normalizes before comparing —
    // an `IN (...)` list against the raw column would miss `unpaid`, which is
    // `past_due` wearing qzpay's spelling (HOS-1310).
    const rows = await readClient
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            productDomain: billingSubscriptions.productDomain
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.customerId, customerId),
                isNull(billingSubscriptions.deletedAt)
            )
        );

    const conflict = rows.find(
        (row) =>
            !supersedes.has(row.id) &&
            isLiveSubscriptionStatus(row.status as string) &&
            subscriptionMatchesDomain(row, productDomain)
    );

    if (!conflict) {
        return;
    }

    apiLogger.warn(
        {
            source,
            customerId,
            productDomain,
            existingSubscriptionId: conflict.id,
            existingStatus: conflict.status,
            supersedesSubscriptionIds: [...supersedes]
        },
        'HOS-1322: refused a second live subscription for this customer in this product domain'
    );

    throw new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        `You already have a live '${productDomain}' subscription. ${
            REMEDY_BY_DOMAIN[productDomain] ?? DEFAULT_REMEDY
        }`,
        undefined,
        DUPLICATE_SUBSCRIPTION_ERROR_CODE
    );
}
