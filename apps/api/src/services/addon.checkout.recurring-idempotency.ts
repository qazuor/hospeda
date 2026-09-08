/**
 * Per-add-on checkout idempotency for the recurring path (HOS-847 PR 4).
 *
 * ## The failure this exists to prevent
 *
 * Nothing else stops a buyer from opening two recurring add-on checkouts:
 *
 *  - `createAddonCheckout` never asks whether the add-on is already bought.
 *    `ADDON_ALREADY_ACTIVE` is raised by `confirmAddonPurchase`, at the END of
 *    the flow, and nowhere else.
 *  - the unique index `idx_addon_purchases_active_unique` is PARTIAL
 *    (`WHERE status = 'active' AND deleted_at IS NULL`), so two `'pending'`
 *    rows collide with nothing.
 *  - `idempotencyKeyMiddleware` deduplicates on a header the client REGENERATES
 *    per user action (its own JSDoc says so), so two clicks are two keys.
 *  - qzpay's provider idempotency key is the new subscription's id, fresh on
 *    every call.
 *
 * On the one-time path that gap is bounded: a MercadoPago `Preference` expires
 * after 30 minutes and only one of them can ever be confirmed. A preapproval
 * does not expire. Two authorized preapprovals for the same add-on are two
 * monthly charges, forever, and the second one's purchase row cannot even
 * activate — the partial unique index rejects it — so it charges invisibly.
 *
 * ## The shape, borrowed rather than invented
 *
 * `decideOwnPreapprovalReuse` in `billing/checkout-idempotency.ts` already
 * solves this for commerce and partner: find the in-flight
 * `pending_provider` subscription row, verify it still describes THIS attempt
 * (same customer, same MercadoPago plan, still young), and hand back the SAME
 * `init_point` that `own-preapproval-subscription-create.ts` stamped onto its
 * `metadata`. This module is that decision with one substitution — a commerce
 * listing is found through `entity_subscriptions`, an add-on through its
 * `'pending'` `billing_addon_purchases` row.
 *
 * When the in-flight checkout is NOT reusable, it is CLOSED before a new one is
 * opened. Leaving it is the two-live-preapprovals state above; it is also a row
 * nothing would ever reap, because `pending` has no implemented exit at all
 * (see {@link supersedePendingPurchase}).
 *
 * @module services/addon.checkout.recurring-idempotency
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../utils/logger.js';
import {
    RECURRING_ADDON_CANCELED_STATUS,
    RECURRING_ADDON_PENDING_STATUS
} from './addon.checkout.recurring-resolve.js';

/**
 * How long an in-flight recurring add-on checkout may be handed back.
 *
 * Three hours, the same window `OWN_PREAPPROVAL_REUSE_WINDOW_MS` uses for the
 * commerce/partner own-preapproval checkout, and for the same measured reason:
 * a card-first authorization can involve 3DS, an OTP, a hand-off to a bank app,
 * and a buyer who walks away and comes back. Deliberately much wider than the
 * 30-minute window this checkout ADVERTISES — the advertised value describes
 * when the buyer should expect the link to feel stale, this one describes when
 * we stop believing the preapproval behind it is still theirs to finish.
 *
 * EXPORTED for `cron/jobs/addon-subscription-reconcile.job.ts` (HOS-847 PR 7c),
 * which reaps the `'pending'` rows this module can only close when the SAME
 * buyer comes back. The reaper MUST use this window and not the 30-minute one
 * the checkout advertises: reaping earlier would cancel a preapproval that
 * {@link decideRecurringAddonReuse} would still legitimately hand back, so the
 * buyer returning at minute 45 would find their authorization dead. One
 * constant, so the reaper and the reuse decision can never disagree about
 * whether a checkout is still the buyer's to finish.
 */
export const RECURRING_ADDON_REUSE_WINDOW_MS = 3 * 60 * 60 * 1000;

/** An in-flight checkout that may be handed back verbatim. */
export interface ReusableRecurringAddonCheckout {
    /** The ORIGINAL MercadoPago `init_point`, read back from the row's metadata. */
    readonly checkoutUrl: string;
    /** The `'pending'` purchase row that already exists for it. */
    readonly purchaseId: string;
    /** The add-on's own local `billing_subscriptions` row. */
    readonly subscriptionId: string;
    /** When this reuse window closes. */
    readonly expiresAt: string;
}

/**
 * What the caller must do next.
 *
 * `blocked` is not an error path bolted on — it is the fail-closed answer for
 * "we could not establish that no live preapproval exists". Creating a second
 * one on a database blip is the exact outcome this module exists to prevent, so
 * uncertainty refuses the checkout instead of proceeding through it.
 */
export type RecurringAddonCheckoutIdempotencyOutcome =
    | { readonly kind: 'reuse'; readonly checkout: ReusableRecurringAddonCheckout }
    | { readonly kind: 'proceed' }
    | { readonly kind: 'blocked'; readonly reason: string };

/** Input for {@link resolveRecurringAddonCheckoutIdempotency}. */
export interface ResolveRecurringAddonCheckoutIdempotencyInput {
    /** Resolved qzpay billing instance — used only to cancel a stale preapproval. */
    readonly billing: QZPayBilling;
    /** Hospeda billing customer id. */
    readonly customerId: string;
    /** Slug of the add-on being bought. */
    readonly addonSlug: string;
    /**
     * MercadoPago `preapproval_plan` the CURRENT attempt resolved. A stale hit
     * whose plan differs is refused rather than reused: the plan is what carries
     * the amount and the cadence, so a drift between the two attempts means the
     * live checkout would charge something other than what this attempt priced.
     */
    readonly mpPreapprovalPlanId: string;
}

/**
 * The `'pending'` purchase row and the subscription row behind it, as loaded.
 * Split out so {@link decideRecurringAddonReuse} can be judged without a
 * database.
 */
export interface RecurringAddonInFlightSnapshot {
    readonly purchaseId: string;
    readonly purchaseCustomerId: string;
    readonly mpSubscriptionId: string | null;
    readonly subscription: {
        readonly id: string;
        readonly customerId: string;
        readonly status: string;
        readonly metadata: unknown;
        readonly createdAt: Date;
    } | null;
}

/**
 * Read back the `checkoutUrl` / `mpPreapprovalPlanId` that
 * `own-preapproval-subscription-create.ts` stamps onto every row it creates.
 *
 * qzpay-core never persists `providerInitPoint`, so that metadata stamp is the
 * only place the original `init_point` survives between the create call and
 * this check.
 */
function readOwnPreapprovalMetadata(metadata: unknown): {
    readonly checkoutUrl: string | undefined;
    readonly mpPreapprovalPlanId: string | undefined;
} {
    const record = (metadata ?? {}) as Record<string, unknown>;
    return {
        checkoutUrl: typeof record.checkoutUrl === 'string' ? record.checkoutUrl : undefined,
        mpPreapprovalPlanId:
            typeof record.mpPreapprovalPlanId === 'string' ? record.mpPreapprovalPlanId : undefined
    };
}

/**
 * Judge whether an in-flight checkout may be handed back, with no I/O.
 *
 * Mirrors `decideOwnPreapprovalReuse` condition for condition. Every one of
 * them is a reason NOT to reuse, so each is individually killable by mutation.
 *
 * @param input.snapshot - The loaded rows, or `null` when nothing is in flight.
 * @param input.customerId - Customer of the CURRENT attempt.
 * @param input.mpPreapprovalPlanId - MercadoPago plan of the CURRENT attempt.
 * @param input.now - Injected clock, so the age condition is testable.
 * @returns The reusable checkout, or `null`.
 */
export function decideRecurringAddonReuse(input: {
    readonly snapshot: RecurringAddonInFlightSnapshot | null;
    readonly customerId: string;
    readonly mpPreapprovalPlanId: string;
    readonly now?: Date;
}): ReusableRecurringAddonCheckout | null {
    const { snapshot, customerId, mpPreapprovalPlanId } = input;
    if (!snapshot?.subscription) {
        return null;
    }

    const row = snapshot.subscription;
    const { checkoutUrl, mpPreapprovalPlanId: storedPlanId } = readOwnPreapprovalMetadata(
        row.metadata
    );
    const nowMs = (input.now ?? new Date()).getTime();
    const ageMs = nowMs - row.createdAt.getTime();

    if (
        snapshot.purchaseCustomerId !== customerId ||
        row.customerId !== customerId ||
        row.status !== SubscriptionStatusEnum.PENDING_PROVIDER ||
        !snapshot.mpSubscriptionId ||
        !checkoutUrl ||
        storedPlanId !== mpPreapprovalPlanId ||
        ageMs >= RECURRING_ADDON_REUSE_WINDOW_MS
    ) {
        return null;
    }

    return {
        checkoutUrl,
        purchaseId: snapshot.purchaseId,
        subscriptionId: row.id,
        expiresAt: new Date(row.createdAt.getTime() + RECURRING_ADDON_REUSE_WINDOW_MS).toISOString()
    };
}

/**
 * Load the newest `'pending'` purchase for this customer + add-on, together
 * with the `billing_subscriptions` row its `mp_subscription_id` points at.
 *
 * The join is through `mp_subscription_id` rather than
 * `billing_addon_purchases.subscription_id`, because that column holds the
 * customer's PLAN subscription (which is what the cancellation sweeps query it
 * for) — never the add-on's own preapproval row.
 */
async function loadInFlightSnapshot(input: {
    readonly customerId: string;
    readonly addonSlug: string;
}): Promise<RecurringAddonInFlightSnapshot | null> {
    const { and, billingSubscriptions, desc, eq, getDb, isNull } = await import('@repo/db');
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

    const db = getDb();

    const purchases = await db
        .select({
            id: billingAddonPurchases.id,
            customerId: billingAddonPurchases.customerId,
            mpSubscriptionId: billingAddonPurchases.mpSubscriptionId
        })
        .from(billingAddonPurchases)
        .where(
            and(
                eq(billingAddonPurchases.customerId, input.customerId),
                eq(billingAddonPurchases.addonSlug, input.addonSlug),
                eq(billingAddonPurchases.status, RECURRING_ADDON_PENDING_STATUS),
                isNull(billingAddonPurchases.deletedAt)
            )
        )
        .orderBy(desc(billingAddonPurchases.createdAt))
        .limit(1);

    const purchase = purchases[0];
    if (!purchase) {
        return null;
    }

    if (!purchase.mpSubscriptionId) {
        // A pending row with no preapproval id behind it. Nothing is live at
        // MercadoPago, so there is nothing to reuse and nothing to cancel — but
        // the row itself must still be closed, or it shadows every later attempt.
        return {
            purchaseId: purchase.id,
            purchaseCustomerId: purchase.customerId,
            mpSubscriptionId: null,
            subscription: null
        };
    }

    const subscriptions = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status,
            metadata: billingSubscriptions.metadata,
            createdAt: billingSubscriptions.createdAt
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.mpSubscriptionId, purchase.mpSubscriptionId),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(1);

    return {
        purchaseId: purchase.id,
        purchaseCustomerId: purchase.customerId,
        mpSubscriptionId: purchase.mpSubscriptionId,
        subscription: subscriptions[0] ?? null
    };
}

/**
 * Close a `'pending'` purchase that cannot be reused, and the preapproval
 * behind it, BEFORE a fresh checkout is opened.
 *
 * Order matters and is fail-closed at the provider: MercadoPago is cancelled
 * FIRST, and a refusal there aborts the whole thing. Closing the local row
 * first would hide a preapproval that is still chargeable — a local terminal
 * state over a live provider object is the HOS-751 failure mode this chain
 * exists to close, and here we would be creating it on purpose.
 *
 * The provider call is skipped when the local subscription row already says the
 * preapproval is gone (or the row is missing entirely). Without that skip a
 * partial failure — MercadoPago cancelled, local write failed — would leave the
 * buyer permanently blocked, retrying a cancel of something already cancelled.
 *
 * Note for PR 7: the background reaper for `'pending'` rows is that PR's scope
 * and the plan currently describes it only for `'active'` ones. This function
 * closes a stale pending row only when the SAME buyer comes back for the SAME
 * add-on. A buyer who abandons the authorization page and never returns leaves
 * a `'pending'` row that nothing sweeps — every add-on cron filters
 * `status = 'active'`, the four subscription sweeps exclude the add-on domain
 * outright (PR 2), and no user or admin route accepts `'pending'` as an input
 * state. PR 7's reconciler MUST cover `'pending'`, not just `'active'`.
 *
 * @returns `true` when the old checkout is definitively closed.
 */
async function supersedePendingPurchase(input: {
    readonly billing: QZPayBilling;
    readonly snapshot: RecurringAddonInFlightSnapshot;
    readonly customerId: string;
    readonly addonSlug: string;
}): Promise<boolean> {
    const { billing, snapshot, customerId, addonSlug } = input;
    const subscription = snapshot.subscription;

    const providerObjectMayBeLive =
        subscription !== null &&
        subscription.status !== SubscriptionStatusEnum.CANCELLED &&
        subscription.status !== SubscriptionStatusEnum.EXPIRED &&
        subscription.status !== SubscriptionStatusEnum.ABANDONED;

    if (providerObjectMayBeLive && subscription) {
        try {
            await billing.subscriptions.cancel(subscription.id);
        } catch (error) {
            apiLogger.error(
                {
                    customerId,
                    addonSlug,
                    purchaseId: snapshot.purchaseId,
                    subscriptionId: subscription.id,
                    mpSubscriptionId: snapshot.mpSubscriptionId,
                    error: error instanceof Error ? error.message : String(error)
                },
                'HOS-847: refusing a second recurring add-on checkout — the stale preapproval from the previous attempt could not be cancelled, and opening another would leave two chargeable preapprovals for one add-on'
            );
            return false;
        }
    }

    try {
        const { eq, getDb } = await import('@repo/db');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        await getDb()
            .update(billingAddonPurchases)
            .set({
                status: RECURRING_ADDON_CANCELED_STATUS,
                canceledAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(billingAddonPurchases.id, snapshot.purchaseId));
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                addonSlug,
                purchaseId: snapshot.purchaseId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: cancelled the stale add-on preapproval but could not close its pending purchase row — refusing the retry rather than opening a second checkout behind a row that still reads pending'
        );
        return false;
    }

    apiLogger.info(
        {
            customerId,
            addonSlug,
            purchaseId: snapshot.purchaseId,
            subscriptionId: subscription?.id ?? null
        },
        'HOS-847: superseded a stale pending recurring add-on checkout before opening a new one'
    );
    return true;
}

/**
 * Decide what a recurring add-on checkout should do about anything already in
 * flight for the same buyer and add-on.
 *
 * @param input - See {@link ResolveRecurringAddonCheckoutIdempotencyInput}.
 * @returns `reuse` with the original checkout, `proceed` when the field is
 *   clear, or `blocked` when it could not be cleared.
 */
export async function resolveRecurringAddonCheckoutIdempotency(
    input: ResolveRecurringAddonCheckoutIdempotencyInput
): Promise<RecurringAddonCheckoutIdempotencyOutcome> {
    const { billing, customerId, addonSlug, mpPreapprovalPlanId } = input;

    let snapshot: RecurringAddonInFlightSnapshot | null;
    try {
        snapshot = await loadInFlightSnapshot({ customerId, addonSlug });
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                addonSlug,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: could not read the in-flight recurring add-on checkout — refusing rather than risking a second chargeable preapproval'
        );
        return { kind: 'blocked', reason: 'in-flight lookup failed' };
    }

    if (!snapshot) {
        return { kind: 'proceed' };
    }

    const reusable = decideRecurringAddonReuse({ snapshot, customerId, mpPreapprovalPlanId });
    if (reusable) {
        apiLogger.info(
            {
                customerId,
                addonSlug,
                purchaseId: reusable.purchaseId,
                subscriptionId: reusable.subscriptionId
            },
            'HOS-847: returning the in-flight recurring add-on checkout instead of opening a second preapproval'
        );
        return { kind: 'reuse', checkout: reusable };
    }

    const superseded = await supersedePendingPurchase({
        billing,
        snapshot,
        customerId,
        addonSlug
    });

    return superseded
        ? { kind: 'proceed' }
        : { kind: 'blocked', reason: 'stale checkout could not be closed' };
}
