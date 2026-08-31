/**
 * Own-preapproval subscription creator (HOS-937 step 1).
 *
 * Wraps {@link createPaidSubscription} with the ONE extra write this flow
 * needs on top of it: normalizing the freshly-created row's `status` from
 * qzpay's native `incomplete` (HOS-171 vocabulary) back to Hospeda's own
 * `pending_provider` (spec §7.6) — the label several webhook branches
 * (`subscription-logic.ts:210,240,823,1115`) and `shouldSendCancelledEmail` /
 * `shouldSendAdminAlert` key off to recognize "never activated". Without this
 * normalization those branches would silently stop firing for a row born
 * `incomplete`, changing behavior with no error signal (design doc §4).
 *
 * This module does NOT touch `createPaidSubscription` or qzpay-core itself
 * (NG-1) — the extra write happens entirely after `createPaidSubscription`
 * already returned a linked MercadoPago preapproval.
 *
 * Also snapshots any deferred-redemption promo bookkeeping (`pendingDiscount`
 * / `pendingTrialExtension`) onto the row's own `metadata` when the caller
 * supplies it. The OLD Path C flow snapshots the same data on a
 * `billing_pending_checkouts` correlation row and redeems it in
 * `link-preapproval.service.ts` at LINK time; this flow has no correlation
 * row (the local row already carries `mp_subscription_id` from creation), so
 * there is no "link" event to hang the redemption on. Redemption is
 * deliberately NOT done here at creation time — the preapproval may never be
 * authorized, and redeeming a capped promo code (or seeding a multi-cycle
 * discount counter) for a checkout that never converts would make the code
 * effectively uncapped through this path. `subscription-logic.ts` redeems it
 * instead, on the webhook's `pending_provider -> active/trialing` transition,
 * reusing `applyPendingDiscountBestEffort` / `applyPendingTrialExtensionBestEffort`
 * from `link-preapproval.service.ts`.
 *
 * @module services/billing/own-preapproval-subscription-create
 */

import { billingSubscriptions, type DrizzleClient, eq, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { apiLogger } from '../../utils/logger.js';
import type {
    CreatePaidSubscriptionInput,
    CreatePaidSubscriptionResult
} from './paid-subscription-create.js';
import { createPaidSubscription } from './paid-subscription-create.js';
import type {
    PendingCheckoutDiscount,
    PendingTrialExtension
} from './pending-provider-subscription-create.js';

/**
 * Metadata key the row's own `metadata` carries a JSON-serialized
 * {@link PendingCheckoutDiscount} snapshot under (HOS-937 step 1). Mirrors
 * `subscription-downgrade.service.ts`'s `keepSelections` pattern: qzpay's
 * `QZPayMetadata` only allows scalar values, so a structured snapshot is
 * stored as a JSON string and parsed back by the reader.
 */
export const PENDING_DISCOUNT_METADATA_KEY = 'pendingDiscountJson';

/**
 * Metadata key the row's own `metadata` carries a JSON-serialized
 * {@link PendingTrialExtension} snapshot under (HOS-937 step 1). See
 * {@link PENDING_DISCOUNT_METADATA_KEY}.
 */
export const PENDING_TRIAL_EXTENSION_METADATA_KEY = 'pendingTrialExtensionJson';

/**
 * Input for {@link createOwnPreapprovalSubscription}. Mirrors
 * {@link CreatePaidSubscriptionInput} exactly, plus an optional Drizzle
 * client override for tests and the two deferred-redemption promo snapshots.
 */
export interface CreateOwnPreapprovalSubscriptionInput extends CreatePaidSubscriptionInput {
    /** Drizzle client override for tests. Defaults to {@link getDb}. */
    readonly db?: DrizzleClient;
    /**
     * A resolved-but-not-yet-redeemed `discount` promo code (SPEC-262 +
     * HOS-244), if one applied at checkout. Snapshotted onto the row's own
     * `metadata` (there is no `billing_pending_checkouts` correlation row in
     * this flow to snapshot it on instead) and redeemed later by the webhook
     * on the `pending_provider -> active/trialing` transition — see the
     * module docblock for why redemption is deferred rather than recorded
     * here at creation time.
     */
    readonly pendingDiscount?: PendingCheckoutDiscount;
    /**
     * A resolved-but-not-yet-redeemed `trial_extension` promo code (HOS-240),
     * if one applied at checkout. Same deferred-redemption treatment as
     * {@link pendingDiscount}.
     */
    readonly pendingTrialExtension?: PendingTrialExtension;
}

/**
 * Result of {@link createOwnPreapprovalSubscription}. Identical shape to
 * {@link CreatePaidSubscriptionResult} — the status normalization is a
 * side effect on the persisted row, not a change to what the caller reads.
 */
export type CreateOwnPreapprovalSubscriptionResult = CreatePaidSubscriptionResult;

/**
 * Create a per-user MercadoPago preapproval (HOS-937 step 1) and normalize
 * its local status label to `pending_provider`.
 *
 * Sequence:
 *  1. {@link createPaidSubscription} — INSERT local row, `POST /preapproval`
 *     with `external_reference` = the local id (qzpay-core internals, §2 of
 *     the design doc), UPDATE local row with `mp_subscription_id`. All three
 *     steps already succeeded by the time this function's own logic runs.
 *  2. An explicit Hospeda-side UPDATE setting `status = 'pending_provider'`
 *     (Hospeda's own status vocabulary superset — `'pending_provider'` is not
 *     a value in qzpay's `QZPaySubscriptionStatus`, so it cannot be written
 *     through `billing.subscriptions.update`, only through a direct write on
 *     `billing_subscriptions`).
 *
 * If step 2 fails (a local DB blip — distinct from anything that could fail
 * *inside* `createPaidSubscription`, which is already fail-closed on its own
 * failure modes), the MercadoPago preapproval this call just created is
 * cancelled best-effort before the error propagates. Without this, a local
 * write failure at this exact point would leave a brand-new orphaned MP
 * preapproval with a `mp_subscription_id` this function already knows but
 * never persists anywhere — the exact orphan class HOS-937 exists to close.
 * Mirrors the `MISSING_PROVIDER_SUBSCRIPTION_ID` compensating cancel in
 * {@link createPaidSubscription} itself.
 *
 * @param input - Same shape as {@link CreatePaidSubscriptionInput}, plus an
 *   optional `db` override for tests.
 * @returns The created subscription plus its non-empty checkout URL.
 * @throws SubscriptionCheckoutError Propagated unchanged from
 *   {@link createPaidSubscription} when the preapproval itself could not be
 *   created.
 * @throws Error When the local status-normalize UPDATE fails. Caller maps to
 *   500 (mirrors `createPendingProviderSubscription`'s contract).
 */
export async function createOwnPreapprovalSubscription(
    input: CreateOwnPreapprovalSubscriptionInput
): Promise<CreateOwnPreapprovalSubscriptionResult> {
    const { db, pendingDiscount, pendingTrialExtension, metadata, ...paidInput } = input;

    // Snapshot the deferred-redemption promo bookkeeping onto the row's own
    // metadata (JSON-stringified: qzpay's `QZPayMetadata` only allows scalar
    // values — same pattern `subscription-downgrade.service.ts` uses for
    // `keepSelections`). Merged with any metadata the caller already passed.
    const mergedMetadata = {
        ...metadata,
        ...(pendingDiscount
            ? { [PENDING_DISCOUNT_METADATA_KEY]: JSON.stringify(pendingDiscount) }
            : {}),
        ...(pendingTrialExtension
            ? { [PENDING_TRIAL_EXTENSION_METADATA_KEY]: JSON.stringify(pendingTrialExtension) }
            : {})
    };

    const result = await createPaidSubscription({
        ...paidInput,
        ...(Object.keys(mergedMetadata).length > 0 ? { metadata: mergedMetadata } : {})
    });

    const localSubscriptionId = result.subscription.id;
    const mpSubscriptionId = result.subscription.providerSubscriptionIds?.mercadopago;
    const client = db ?? getDb();

    try {
        await client
            .update(billingSubscriptions)
            .set({ status: SubscriptionStatusEnum.PENDING_PROVIDER })
            .where(eq(billingSubscriptions.id, localSubscriptionId));
    } catch (updateError) {
        // Compensating cancel (HOS-937 step 1, design doc §3 "Hueco A"): the
        // preapproval already exists at MercadoPago (createPaidSubscription
        // returned successfully), but the local row that is supposed to track
        // it just failed to persist its final status. Cancel it best-effort
        // so it does not survive as an untracked, unreconcilable orphan.
        try {
            await input.billing.subscriptions.cancel(localSubscriptionId);
            apiLogger.warn(
                { localSubscriptionId, mpSubscriptionId },
                'HOS-937: cancelled MP preapproval after the local pending_provider status-normalize UPDATE failed (fail-closed)'
            );
        } catch (cancelError) {
            apiLogger.error(
                {
                    localSubscriptionId,
                    mpSubscriptionId,
                    error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                },
                'HOS-937: FAILED to cancel MP preapproval after the local pending_provider status-normalize UPDATE failed — needs manual reconciliation, this is exactly the orphan class HOS-937 targets'
            );
        }
        throw updateError;
    }

    return result;
}
