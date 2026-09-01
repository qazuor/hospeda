/**
 * MercadoPago preapproval checkout recovery (HOS-937 step 3).
 *
 * Closes the loop left open once Hospeda knows its own `mp_subscription_id`
 * before the redirect (HOS-937 step 1): when a checkout does not come back
 * `authorized`, we now know EXACTLY which object to re-read, so the "pay
 * with another method" infinite loop (spec §8.3 / §10 R-1) can be replaced
 * with a deterministic recovery instead of a heuristic guess.
 *
 * Three read outcomes (spec §6.4), and the two failure ones are NOT
 * interchangeable:
 * - `authorized` — happy path, nothing to do.
 * - `pending` — the SAME preapproval object; send the user back to its own
 *   `init_point` (recovered from `metadata.checkoutUrl`, stamped by
 *   `own-preapproval-subscription-create.ts` for every HOS-937 flow).
 * - `cancelled` — MercadoPago cancelled the object over a card rejection.
 *   `payer_email` is not mutable on a MP preapproval (the `PUT` is silently
 *   ignored), so there is no way to retry on the SAME object — a fresh one
 *   must be minted.
 *
 * R-3 (spec §10): every `cancelled` read is confirmed with a DEFERRED
 * second `GET`, never acted on immediately. Six preapprovals were observed
 * reporting `cancelled` on both the `PUT` and an immediate `GET`, then
 * reading `authorized`/`pending` hours later. This module's deferral
 * ({@link confirmCancellationDeferred}) is bounded to what a synchronous
 * webhook/HTTP handler can afford (a few hundred milliseconds, gated by
 * {@link MP_CALL_SPACING_MS}) — it closes the "acted on the SAME instant"
 * failure mode the six-preapproval measurement demonstrated, but it does
 * NOT reproduce an hours-long wait. A longer-horizon backstop (a cron that
 * re-confirms a `cancelled` row after, say, 30+ minutes before minting) is
 * out of scope for this change and is flagged as a known residual gap.
 *
 * R-5 (spec §10): MercadoPago's unpublished rate limit returned `429` on an
 * unspaced sweep of ~60 consecutive `GET`s; 0.35s between calls produced
 * zero failures. {@link MP_CALL_SPACING_MS} is that measured spacing,
 * reused as the minimum delay before the deferred confirmation `GET`.
 *
 * @module services/billing/preapproval-recovery
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { billingSubscriptions, type DrizzleClient, eq, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { QZPAY_TO_HOSPEDA_STATUS } from '@repo/service-core';
import { and, sql } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import {
    createOwnPreapprovalSubscription,
    PENDING_DISCOUNT_METADATA_KEY,
    PENDING_TRIAL_EXTENSION_METADATA_KEY
} from './own-preapproval-subscription-create.js';
import type {
    PendingCheckoutDiscount,
    PendingTrialExtension
} from './pending-provider-subscription-create.js';

/**
 * Minimum spacing (ms) between two calls to MercadoPago's preapproval `GET`
 * from any loop or deferred-confirmation flow in this module (spec §10 R-5).
 * Also used as the default deferral delay for {@link confirmCancellationDeferred}.
 */
export const MP_CALL_SPACING_MS = 350;

/**
 * The three-way classification of a live preapproval read (spec §6.4), plus
 * `other` for a provider status this recovery flow does not act on (e.g.
 * `paused`, `past_due`, `finished`, or an unrecognized value).
 */
export type PreapprovalRecoveryClassification = 'authorized' | 'pending' | 'cancelled' | 'other';

/**
 * Classifies a qzpay-normalized preapproval status (the `status` field on
 * `paymentAdapter.subscriptions.retrieve()`'s response — NOT the raw
 * MercadoPago value) into the three-way recovery outcome of spec §6.4.
 *
 * Reuses {@link QZPAY_TO_HOSPEDA_STATUS} — the SAME map the webhook
 * (`subscription-logic.ts`) uses — so this module can never disagree with
 * the webhook about what `active`/`pending`/`canceled` mean.
 *
 * @param qzpayStatus - `mpSubscription.status` from a `retrieve()` call.
 * @returns `'authorized'` for a live/active preapproval (qzpay's `active`,
 *   which is how it reports MP's raw `authorized` — including a card-first
 *   trial), `'pending'` for `pending`, `'cancelled'` for `canceled`, and
 *   `'other'` for anything else (paused/past_due/finished/unknown).
 */
export function classifyPreapprovalStatus(qzpayStatus: string): PreapprovalRecoveryClassification {
    const mapped = QZPAY_TO_HOSPEDA_STATUS[qzpayStatus];

    if (mapped === undefined) {
        return 'other';
    }
    if (mapped === null) {
        return 'pending';
    }
    if (mapped === SubscriptionStatusEnum.ACTIVE) {
        return 'authorized';
    }
    if (mapped === SubscriptionStatusEnum.CANCELLED) {
        return 'cancelled';
    }
    return 'other';
}

/** Injectable sleep function, overridden in tests to avoid real delays. */
export type SleepFn = (ms: number) => Promise<void>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Input for {@link confirmCancellationDeferred}. */
export interface ConfirmCancellationDeferredInput {
    /** MercadoPago-typed adapter (`subscriptions.retrieve`). */
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    /** The preapproval id an earlier read reported as `cancelled`. */
    readonly mpPreapprovalId: string;
    /** Delay before the confirmation `GET`. Defaults to {@link MP_CALL_SPACING_MS}. */
    readonly delayMs?: number;
    /** Injectable sleep, for tests. Defaults to a real `setTimeout`-based wait. */
    readonly sleep?: SleepFn;
}

/** Result of {@link confirmCancellationDeferred}. */
export interface ConfirmCancellationDeferredResult {
    /** `true` only when the DEFERRED re-read still classifies as `cancelled`. */
    readonly confirmed: boolean;
    /** The re-read's classification (may differ from the original read). */
    readonly classification: PreapprovalRecoveryClassification;
}

/**
 * R-3 mitigation: waits {@link MP_CALL_SPACING_MS} (or a caller-supplied
 * `delayMs`), then re-reads the preapproval and re-classifies it. Callers
 * MUST treat a `cancelled` classification as provisional until this
 * function confirms it — see the module docblock for the scope of what
 * "deferred" means here (bounded to a synchronous handler's time budget,
 * not the multi-hour window the underlying measurement observed).
 *
 * @param input - The adapter, the preapproval id, and optional delay/sleep
 *   overrides for tests.
 * @returns `confirmed: true` only when the re-read is STILL `cancelled`;
 *   otherwise the caller must NOT mint a fresh attempt or notify the user —
 *   the original `cancelled` signal was a false read.
 */
export async function confirmCancellationDeferred({
    paymentAdapter,
    mpPreapprovalId,
    delayMs = MP_CALL_SPACING_MS,
    sleep = defaultSleep
}: ConfirmCancellationDeferredInput): Promise<ConfirmCancellationDeferredResult> {
    // R-3: the wait below is what makes this a DEFERRED read rather than an
    // immediate one. Removing it turns this into the exact "immediate GET"
    // pattern the six-preapproval measurement showed is unreliable.
    await sleep(delayMs);

    const live = await paymentAdapter.subscriptions.retrieve(mpPreapprovalId);
    const classification = classifyPreapprovalStatus(live.status);

    return { confirmed: classification === 'cancelled', classification };
}

/**
 * Minimal price shape this module needs off `plan.prices[]` — mirrors the
 * local `findMonthlyPrice`/`findAnnualPrice` shape in
 * `reactivation-plan-guard.ts`, which documents why this lookup is
 * duplicated per module instead of shared (avoiding a circular import back
 * through `subscription-checkout.service.ts`).
 */
interface RecoveryPriceShape {
    readonly id: string;
    readonly active: boolean;
    readonly billingInterval: string;
    readonly intervalCount: number;
}

/**
 * Resolves the active, single-cycle price on `plan.prices[]` matching the
 * Hospeda-vocabulary interval (`'monthly' | 'annual'`) stored on the
 * cancelled row's own metadata.
 */
function findPriceForInterval<T extends RecoveryPriceShape>(
    prices: ReadonlyArray<T>,
    billingInterval: 'monthly' | 'annual'
): T | null {
    const qzpayInterval = billingInterval === 'annual' ? 'year' : 'month';
    return (
        prices.find(
            (price) =>
                price.active && price.billingInterval === qzpayInterval && price.intervalCount === 1
        ) ?? null
    );
}

/**
 * Result of {@link extractPendingPromoFromRowMetadata}.
 */
interface ExtractedPendingPromo {
    readonly pendingDiscount?: PendingCheckoutDiscount;
    readonly pendingTrialExtension?: PendingTrialExtension;
}

/**
 * Reads back the deferred-redemption promo snapshot a HOS-937 own-preapproval
 * row carries on its own `metadata` — the SAME shape
 * `subscription-logic.ts`'s local `extractPendingPromoFromRowMetadata`
 * reads, duplicated here rather than imported (that function is not
 * exported, and importing across the webhook/service boundary for a ~30-line
 * parser is not worth the coupling). Any change to the metadata key/shape
 * must be mirrored in both copies — see that module's identical docblock.
 *
 * @param metadata - `billing_subscriptions.metadata` as read off the
 *   cancelled row.
 */
function extractPendingPromoFromRowMetadata(metadata: unknown): ExtractedPendingPromo {
    if (typeof metadata !== 'object' || metadata === null) {
        return {};
    }
    const record = metadata as Record<string, unknown>;
    const result: ExtractedPendingPromo = {};

    const discountJson = record[PENDING_DISCOUNT_METADATA_KEY];
    if (typeof discountJson === 'string') {
        try {
            const parsed = JSON.parse(discountJson) as Partial<PendingCheckoutDiscount>;
            if (
                typeof parsed.promoCodeId === 'string' &&
                typeof parsed.finalAmountCentavos === 'number'
            ) {
                (result as { pendingDiscount?: PendingCheckoutDiscount }).pendingDiscount = {
                    promoCodeId: parsed.promoCodeId,
                    finalAmountCentavos: parsed.finalAmountCentavos,
                    ...(parsed.durationCycles === undefined
                        ? {}
                        : { durationCycles: parsed.durationCycles })
                };
            }
        } catch {
            // Malformed — treat as absent.
        }
    }

    const trialExtensionJson = record[PENDING_TRIAL_EXTENSION_METADATA_KEY];
    if (typeof trialExtensionJson === 'string') {
        try {
            const parsed = JSON.parse(trialExtensionJson) as Partial<PendingTrialExtension>;
            if (typeof parsed.promoCodeId === 'string' && typeof parsed.code === 'string') {
                (
                    result as { pendingTrialExtension?: PendingTrialExtension }
                ).pendingTrialExtension = {
                    promoCodeId: parsed.promoCodeId,
                    code: parsed.code
                };
            }
        } catch {
            // Malformed — treat as absent.
        }
    }

    return result;
}

/**
 * The subset of a `billing_subscriptions` row this module needs to mint a
 * fresh, like-for-like preapproval attempt.
 */
export interface RecoverableSubscriptionRow {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
    readonly productDomain?: string | null;
    readonly metadata: unknown;
}

/**
 * Product domains {@link mintRetryPreapprovalAttempt} currently supports.
 * `undefined`/`null` covers accommodation monthly/annual (the column's own
 * DB default). Commerce/partner retries need their bridge-row write
 * (`writeDomainLinkRow` — see `own-preapproval-subscription-create.ts`),
 * which requires re-resolving the commerce/partner entity pointer this
 * module does not have; deliberately out of scope for this change (reported
 * as a known limitation, not silently unsupported).
 */
const RETRY_SUPPORTED_PRODUCT_DOMAINS: ReadonlySet<string> = new Set(['accommodation']);

/** Input for {@link mintRetryPreapprovalAttempt}. */
export interface MintRetryPreapprovalAttemptInput {
    readonly billing: QZPayBilling;
    readonly localSubscription: RecoverableSubscriptionRow;
    readonly paymentMethodReturnUrl: string;
    readonly notificationUrl: string;
    readonly db?: DrizzleClient;
}

/** Result of {@link mintRetryPreapprovalAttempt}. */
export interface MintRetryPreapprovalAttemptResult {
    readonly localSubscriptionId: string;
    readonly checkoutUrl: string;
}

/**
 * Mints a brand-new MercadoPago preapproval for the SAME commercial terms as
 * a `cancelled` row (spec §6.4: `cancelled` recovery is a NEW object,
 * `payer_email` on the old one is not mutable).
 *
 * Reuses the exact MP `preapproval_plan` (`metadata.mpPreapprovalPlanId`,
 * stamped by `own-preapproval-subscription-create.ts` for every HOS-937
 * flow) so the fresh attempt carries the SAME amount/cadence/trial terms —
 * including any signup discount already baked into that MP plan. Any
 * deferred-redemption promo snapshot (`pendingDiscount` /
 * `pendingTrialExtension`) the original checkout resolved is carried
 * forward unredeemed (the original preapproval never activated, so nothing
 * was redeemed yet) — if THIS attempt converts, the webhook redeems it same
 * as any first attempt.
 *
 * @throws Error When `productDomain` is not (yet) supported, or the row is
 *   missing data this recovery needs (`mpPreapprovalPlanId`, the plan, or a
 *   matching price) — see {@link RETRY_SUPPORTED_PRODUCT_DOMAINS}.
 */
export async function mintRetryPreapprovalAttempt({
    billing,
    localSubscription,
    paymentMethodReturnUrl,
    notificationUrl,
    db
}: MintRetryPreapprovalAttemptInput): Promise<MintRetryPreapprovalAttemptResult> {
    const domain = localSubscription.productDomain ?? 'accommodation';
    if (!RETRY_SUPPORTED_PRODUCT_DOMAINS.has(domain)) {
        throw new Error(
            `HOS-937 retry: minting a fresh preapproval is not yet supported for productDomain='${domain}'`
        );
    }

    const metadata = (localSubscription.metadata ?? {}) as Record<string, unknown>;
    const mpPreapprovalPlanId =
        typeof metadata.mpPreapprovalPlanId === 'string' ? metadata.mpPreapprovalPlanId : null;
    if (!mpPreapprovalPlanId) {
        throw new Error(
            `HOS-937 retry: subscription ${localSubscription.id} carries no metadata.mpPreapprovalPlanId — cannot mint a like-for-like retry`
        );
    }
    const billingInterval: 'monthly' | 'annual' =
        metadata.billingInterval === 'annual' ? 'annual' : 'monthly';

    const plan = await billing.plans.get(localSubscription.planId);
    if (!plan) {
        throw new Error(`HOS-937 retry: plan ${localSubscription.planId} not found`);
    }
    const price = findPriceForInterval(plan.prices, billingInterval);
    if (!price) {
        throw new Error(
            `HOS-937 retry: plan ${localSubscription.planId} has no active ${billingInterval} price`
        );
    }

    const { pendingDiscount, pendingTrialExtension } = extractPendingPromoFromRowMetadata(metadata);

    const result = await createOwnPreapprovalSubscription({
        billing,
        customerId: localSubscription.customerId,
        planId: localSubscription.planId,
        priceId: price.id,
        billingInterval,
        paymentMethodReturnUrl,
        notificationUrl,
        providerPriceId: mpPreapprovalPlanId,
        ...(pendingDiscount ? { pendingDiscount } : {}),
        ...(pendingTrialExtension ? { pendingTrialExtension } : {}),
        ...(db ? { db } : {})
    });

    return { localSubscriptionId: result.subscription.id, checkoutUrl: result.checkoutUrl };
}

/** Input for {@link claimRetryMintSlot}. */
export interface ClaimRetryMintSlotInput {
    readonly db?: DrizzleClient;
    readonly cancelledLocalSubscriptionId: string;
}

/** Result of {@link claimRetryMintSlot}. */
export interface ClaimRetryMintSlotResult {
    /** `true` when THIS call won the right to mint. */
    readonly claimed: boolean;
    /** Set only when a PRIOR winner already finished minting. */
    readonly existingLocalSubscriptionId: string | null;
    /** Set only when a PRIOR winner already finished minting. */
    readonly existingCheckoutUrl: string | null;
}

/**
 * Atomic compare-and-set claim on the cancelled row's own `metadata`,
 * preventing the webhook (§6.5) and a user-triggered retry call (§7.5) from
 * BOTH minting a fresh preapproval for the same cancelled row — the exact
 * orphan class HOS-937 exists to close. Mirrors the spirit of the
 * `billing_subscriptions_mp_id_uniq` compare-and-set pattern (spec §6.6-C):
 * here there is no natural unique DB constraint to race against, so the
 * claim is a conditional `UPDATE ... WHERE metadata->>'retryClaimedAt' IS
 * NULL`.
 *
 * @returns `claimed: true` when this call may proceed to mint. `claimed:
 *   false` with `existingLocalSubscriptionId`/`existingCheckoutUrl` set when
 *   an earlier winner already finished; both `null` when a concurrent
 *   winner claimed the slot but has not finished minting yet (rare —
 *   callers should treat this as "try again shortly", never as a green
 *   light to mint their own second attempt).
 */
export async function claimRetryMintSlot({
    db,
    cancelledLocalSubscriptionId
}: ClaimRetryMintSlotInput): Promise<ClaimRetryMintSlotResult> {
    const client = db ?? getDb();

    const claimedRows = await client
        .update(billingSubscriptions)
        .set({
            metadata: sql`jsonb_set(coalesce(${billingSubscriptions.metadata}, '{}'::jsonb), '{retryClaimedAt}', to_jsonb(now()::text))`
        })
        .where(
            and(
                eq(billingSubscriptions.id, cancelledLocalSubscriptionId),
                sql`(${billingSubscriptions.metadata} ->> 'retryClaimedAt') IS NULL`
            )
        )
        .returning({ id: billingSubscriptions.id });

    if (claimedRows.length > 0) {
        return { claimed: true, existingLocalSubscriptionId: null, existingCheckoutUrl: null };
    }

    const [row] = await client
        .select({ metadata: billingSubscriptions.metadata })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, cancelledLocalSubscriptionId))
        .limit(1);
    const rowMetadata = (row?.metadata ?? {}) as Record<string, unknown>;
    const existingLocalSubscriptionId =
        typeof rowMetadata.retryMintedLocalSubscriptionId === 'string'
            ? rowMetadata.retryMintedLocalSubscriptionId
            : null;
    const existingCheckoutUrl =
        typeof rowMetadata.retryMintedCheckoutUrl === 'string'
            ? rowMetadata.retryMintedCheckoutUrl
            : null;

    return { claimed: false, existingLocalSubscriptionId, existingCheckoutUrl };
}

/** Input for {@link recoverCancelledPreapproval}. */
export interface RecoverCancelledPreapprovalInput {
    readonly billing: QZPayBilling;
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    readonly localSubscription: RecoverableSubscriptionRow & { readonly mpSubscriptionId: string };
    readonly paymentMethodReturnUrl: string;
    readonly notificationUrl: string;
    readonly db?: DrizzleClient;
    readonly delayMs?: number;
    readonly sleep?: SleepFn;
}

/** Outcome of {@link recoverCancelledPreapproval}. */
export type RecoverCancelledPreapprovalOutcome =
    | {
          readonly kind: 'minted';
          readonly localSubscriptionId: string;
          readonly checkoutUrl: string;
      }
    | {
          readonly kind: 'already_minted';
          readonly localSubscriptionId: string;
          readonly checkoutUrl: string;
      }
    | { readonly kind: 'not_confirmed'; readonly classification: PreapprovalRecoveryClassification }
    | { readonly kind: 'claim_lost' }
    | { readonly kind: 'unsupported'; readonly reason: string };

/**
 * Full recovery orchestration for a row reported `cancelled` (spec §6.5):
 * confirm the read is not a false immediate signal (R-3), claim the
 * exclusive right to mint (idempotency guard), mint a fresh preapproval on
 * the same terms, and stamp the claim row so a later call reuses the SAME
 * fresh attempt instead of minting a second one.
 *
 * Shared by BOTH the cancellation webhook (§6.5) and the retry endpoint
 * (§7.5) so the two callers can never disagree on what "recovered" means.
 */
export async function recoverCancelledPreapproval(
    input: RecoverCancelledPreapprovalInput
): Promise<RecoverCancelledPreapprovalOutcome> {
    // `getDb()` is resolved lazily, only once actually needed — the two
    // early-return branches below (already minted, not confirmed) are pure
    // metadata/classification checks that must work with no DB connection
    // at all (e.g. a unit test that never mocks `getDb`).
    const metadata = (input.localSubscription.metadata ?? {}) as Record<string, unknown>;

    if (
        typeof metadata.retryMintedLocalSubscriptionId === 'string' &&
        typeof metadata.retryMintedCheckoutUrl === 'string'
    ) {
        return {
            kind: 'already_minted',
            localSubscriptionId: metadata.retryMintedLocalSubscriptionId,
            checkoutUrl: metadata.retryMintedCheckoutUrl
        };
    }

    const confirmation = await confirmCancellationDeferred({
        paymentAdapter: input.paymentAdapter,
        mpPreapprovalId: input.localSubscription.mpSubscriptionId,
        ...(input.delayMs === undefined ? {} : { delayMs: input.delayMs }),
        ...(input.sleep ? { sleep: input.sleep } : {})
    });
    if (!confirmation.confirmed) {
        return { kind: 'not_confirmed', classification: confirmation.classification };
    }

    const client = input.db ?? getDb();
    const claim = await claimRetryMintSlot({
        db: client,
        cancelledLocalSubscriptionId: input.localSubscription.id
    });
    if (!claim.claimed) {
        if (claim.existingLocalSubscriptionId && claim.existingCheckoutUrl) {
            return {
                kind: 'already_minted',
                localSubscriptionId: claim.existingLocalSubscriptionId,
                checkoutUrl: claim.existingCheckoutUrl
            };
        }
        return { kind: 'claim_lost' };
    }

    try {
        const minted = await mintRetryPreapprovalAttempt({
            billing: input.billing,
            localSubscription: input.localSubscription,
            paymentMethodReturnUrl: input.paymentMethodReturnUrl,
            notificationUrl: input.notificationUrl,
            db: client
        });

        await client
            .update(billingSubscriptions)
            .set({
                metadata: sql`jsonb_set(jsonb_set(coalesce(${billingSubscriptions.metadata}, '{}'::jsonb), '{retryMintedLocalSubscriptionId}', to_jsonb(${minted.localSubscriptionId}::text)), '{retryMintedCheckoutUrl}', to_jsonb(${minted.checkoutUrl}::text))`
            })
            .where(eq(billingSubscriptions.id, input.localSubscription.id));

        apiLogger.info(
            {
                cancelledLocalSubscriptionId: input.localSubscription.id,
                mintedLocalSubscriptionId: minted.localSubscriptionId
            },
            'HOS-937 step 3: minted a fresh preapproval attempt after a confirmed cancellation'
        );

        return {
            kind: 'minted',
            localSubscriptionId: minted.localSubscriptionId,
            checkoutUrl: minted.checkoutUrl
        };
    } catch (error) {
        apiLogger.warn(
            {
                cancelledLocalSubscriptionId: input.localSubscription.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-937 step 3: could not mint a fresh preapproval attempt for a confirmed cancellation'
        );
        return {
            kind: 'unsupported',
            reason: error instanceof Error ? error.message : String(error)
        };
    }
}
