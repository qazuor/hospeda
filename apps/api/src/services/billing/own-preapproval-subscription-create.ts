/**
 * Own-preapproval subscription creator (HOS-937 step 1, extended step 4).
 *
 * Wraps {@link createPaidSubscription} with the extra writes this flow needs
 * on top of it: normalizing the freshly-created row's `status` from qzpay's
 * native `incomplete` (HOS-171 vocabulary) back to Hospeda's own
 * `pending_provider` (spec §7.6) — the label several webhook branches
 * (`subscription-logic.ts:210,240,823,1115`) and `shouldSendCancelledEmail` /
 * `shouldSendAdminAlert` key off to recognize "never activated". Without this
 * normalization those branches would silently stop firing for a row born
 * `incomplete`, changing behavior with no error signal (design doc §4).
 *
 * This module does NOT touch `createPaidSubscription` or qzpay-core itself
 * (NG-1) — the extra writes happen entirely after `createPaidSubscription`
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
 * HOS-937 step 4 (commerce/partner): optionally stamps `productDomain`
 * (omitted for accommodation monthly/annual, which rely on the column's own
 * DB default — `'accommodation'`) and, when the caller supplies
 * `writeDomainLinkRow`, writes the commerce/partner bridge row in the SAME
 * local transaction as the status/domain UPDATE — mirroring
 * `createPendingProviderSubscription`'s identical guarantee for the OLD Path C
 * flow (a `pending_provider` row must never exist without its bridge row, or
 * the activation webhook can never find the listing/partner to publish). When
 * `writeDomainLinkRow` is supplied, `domainMetadata` (the commerce/partner
 * entity pointer) plus the resolved `checkoutUrl` are also merged onto the
 * row's `metadata`. The `checkoutUrl` stamp is what lets the reusable-checkout
 * replacement in `checkout-idempotency.ts` (§6.6-B) hand back the SAME
 * `init_point` on a double-click without a live MercadoPago call — qzpay-core
 * never persists `providerInitPoint` to storage, it only exists on the
 * in-memory response of the `create()` call.
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
    /**
     * Product domain to stamp on the row (HOS-937 step 4). Omitted for
     * accommodation monthly/annual — the column's own DB default already
     * resolves to `'accommodation'` (see `@qazuor/qzpay-drizzle`'s
     * `subscriptions.schema.ts`), so this stays `undefined` and no extra
     * write is issued for those two flows, matching the paso-1 behavior byte
     * for byte. Commerce passes `'gastronomy'`/`'experience'`
     * (`ProductDomainEnum`), partner passes `'partner'`.
     */
    readonly productDomain?: string;
    /**
     * Domain coordinates merged onto the row's `metadata` — mirrors
     * {@link CreatePendingProviderSubscriptionInput.domainMetadata}
     * (`{ commerceEntityType, commerceEntityId }` for commerce, `{ partnerId }`
     * for partner). Only meaningful together with {@link writeDomainLinkRow};
     * when either is supplied, the resolved `checkoutUrl` is ALSO merged onto
     * `metadata` under the `checkoutUrl` key — see the module docblock for why.
     */
    readonly domainMetadata?: Readonly<Record<string, string>>;
    /**
     * Optional domain-specific write (commerce_listing_subscriptions /
     * partner_subscriptions upsert), executed in the SAME local transaction as
     * the status/`productDomain`/`metadata` UPDATE this function issues.
     *
     * Mirrors `CreatePendingProviderSubscriptionInput.writeDomainLinkRow`'s
     * atomicity guarantee for the OLD Path C flow: writing the bridge row
     * after this function already returned would leave a window in which a
     * `pending_provider` commerce/partner subscription exists with no bridge
     * row for its reconciler to find once the webhook activates it.
     *
     * Receives the transaction client plus the id of the subscription row
     * `createPaidSubscription` already created. Must not commit or roll back
     * itself; anything it throws aborts the whole local transaction and
     * triggers the same compensating MP-preapproval cancel as a failed status
     * UPDATE (Hueco A).
     */
    readonly writeDomainLinkRow?: (params: {
        readonly tx: DrizzleClient;
        readonly localSubscriptionId: string;
    }) => Promise<void>;
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
    const {
        db,
        pendingDiscount,
        pendingTrialExtension,
        metadata,
        productDomain,
        domainMetadata,
        writeDomainLinkRow,
        ...paidInput
    } = input;

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
        if (writeDomainLinkRow) {
            // HOS-937 step 4 (commerce/partner): the status/domain UPDATE and
            // the bridge-row write must succeed or fail TOGETHER — a
            // `pending_provider` row with no bridge row can never be found by
            // the activation webhook's reconciler. `client.transaction` is
            // Drizzle's own nested-transaction primitive (not
            // `withServiceTransaction`, which always opens a NEW top-level
            // boundary and would silently ignore a test-supplied `db` mock
            // that has no `.transaction()` of its own — accommodation
            // monthly/annual never hit this branch, so their existing tests
            // are unaffected).
            await client.transaction(async (tx) => {
                await tx
                    .update(billingSubscriptions)
                    .set({
                        status: SubscriptionStatusEnum.PENDING_PROVIDER,
                        ...(productDomain === undefined ? {} : { productDomain }),
                        // Spread `domainMetadata` LAST so the entity pointer is
                        // unmistakably part of the same immutable checkout
                        // snapshot, mirroring `createPendingProviderSubscription`.
                        // `checkoutUrl` closes the §6.6-B reuse gap: qzpay-core
                        // never persists `providerInitPoint` to storage.
                        metadata: {
                            ...mergedMetadata,
                            checkoutUrl: result.checkoutUrl,
                            // Persisted so the §6.6-B reuse check can refuse a
                            // stale hit when the resolved MP plan drifted
                            // between two checkout attempts (price change,
                            // trial-day variant change) — same price-drift
                            // guard the OLD flow's `mpPreapprovalPlanId`
                            // reuse condition enforced.
                            ...(paidInput.providerPriceId
                                ? { mpPreapprovalPlanId: paidInput.providerPriceId }
                                : {}),
                            ...domainMetadata
                        }
                    })
                    .where(eq(billingSubscriptions.id, localSubscriptionId));

                await writeDomainLinkRow({ tx, localSubscriptionId });
            });
        } else {
            await client
                .update(billingSubscriptions)
                .set({
                    status: SubscriptionStatusEnum.PENDING_PROVIDER,
                    ...(productDomain === undefined ? {} : { productDomain })
                })
                .where(eq(billingSubscriptions.id, localSubscriptionId));
        }
    } catch (updateError) {
        // Compensating cancel (HOS-937 step 1, design doc §3 "Hueco A"): the
        // preapproval already exists at MercadoPago (createPaidSubscription
        // returned successfully), but the local write(s) that are supposed to
        // track it just failed. Cancel it best-effort so it does not survive
        // as an untracked, unreconcilable orphan.
        try {
            await input.billing.subscriptions.cancel(localSubscriptionId);
            apiLogger.warn(
                { localSubscriptionId, mpSubscriptionId },
                'HOS-937: cancelled MP preapproval after the local pending_provider status-normalize write failed (fail-closed)'
            );
        } catch (cancelError) {
            apiLogger.error(
                {
                    localSubscriptionId,
                    mpSubscriptionId,
                    error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                },
                'HOS-937: FAILED to cancel MP preapproval after the local pending_provider status-normalize write failed — needs manual reconciliation, this is exactly the orphan class HOS-937 targets'
            );
        }
        throw updateError;
    }

    return result;
}
