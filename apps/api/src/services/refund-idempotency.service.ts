/**
 * Refund Idempotency Ledger (HOS-597)
 *
 * A refund reaches Hospeda through more than one door and nothing used to
 * coordinate them:
 *
 * - the admin panel refund hook (`onAfterPaymentRefund`),
 * - the MercadoPago `payment.updated` webhook, which the provider delivers
 *   more than once for the same state change (two deliveries seconds apart
 *   is the provider's normal retry, not an anomaly),
 * - the dead-letter retry / polling fallback replaying the same event.
 *
 * The webhook-event table dedups by `provider_event_id`, but MP issues a NEW
 * notification id per delivery, so event-level dedup never saw those as the
 * same refund. The effect was therefore applied once per delivery.
 *
 * This module is the missing coordination point: a durable, race-safe claim on
 * a refund IDENTITY, so the lifecycle effect runs once per confirmed refund no
 * matter how many paths confirm it.
 *
 * ## Storage
 *
 * Reuses the existing `billing_idempotency_keys` table (UNIQUE on `key`), the
 * same table `middlewares/idempotency-key.ts` already borrows for request-level
 * idempotency. Entries are namespaced with {@link REFUND_KEY_NAMESPACE} so they
 * can never collide with that middleware's per-user keys or with qzpay-core's
 * own entries.
 *
 * The claim is a single `INSERT ... ON CONFLICT DO NOTHING RETURNING`, so it is
 * atomic: two concurrent deliveries race on the UNIQUE constraint and exactly
 * one of them gets a row back. There is no check-then-act window.
 *
 * @module services/refund-idempotency
 */

import { billingIdempotencyKeys, getDb } from '@repo/db';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Namespace prefix for every key this module writes. Keeps refund claims
 * disjoint from the `hospeda-billing:` request-idempotency keys and from
 * qzpay-core's own entries in the same table.
 */
export const REFUND_KEY_NAMESPACE = 'hospeda-refund-lifecycle:';

/**
 * Value written to `billing_idempotency_keys.operation`, so a claim row is
 * identifiable in forensics without parsing the key.
 */
export const REFUND_LEDGER_OPERATION = 'hospeda.refund_lifecycle';

/**
 * Claim lifetime. Deliberately long: the duplicates this guards against arrive
 * within seconds (provider retry) to days (late chargeback confirmation), and
 * a claim row costs nothing — refunds are rare. Expiry only matters if a
 * cleanup job ever prunes the table; the UNIQUE constraint blocks a re-claim
 * regardless of `expires_at` while the row exists.
 */
const CLAIM_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Input for {@link buildRefundIdempotencyKey}. All amounts in centavos.
 */
export interface BuildRefundIdempotencyKeyInput {
    /** The local `billing_payments.id` the refund applies to. */
    readonly paymentId: string;
    /** The original payment amount, in centavos. */
    readonly paymentAmount: number;
    /**
     * The refund amount in centavos, or `undefined` when the caller did not
     * specify one (which the lifecycle service reads as a full refund).
     */
    readonly refundAmount: number | undefined;
    /**
     * The provider-side refund identifier, when the caller could resolve one.
     * The admin hook reads it off `payment.metadata.refundId`; the webhook path
     * reads the same field from the local `billing_payments` row so both doors
     * derive the SAME key for the same refund.
     */
    readonly providerRefundId: string | undefined;
}

/**
 * Derive the idempotency key that identifies one refund, independently of the
 * path that reports it.
 *
 * Two shapes, chosen so the key is the strongest identity actually available:
 *
 * - **Full refund** → `{ns}{paymentId}:full`. A payment can only be refunded in
 *   full once, so the payment's terminal refund STATE is a path-independent
 *   identity. This is what closes the admin↔webhook race: the admin hook and
 *   every webhook delivery derive the same key without needing to agree on a
 *   provider refund id.
 * - **Partial refund with a provider refund id** → `{ns}{paymentId}:refund:{id}`.
 *   The provider mints a fresh refund id per refund, so two genuine partials of
 *   the same amount stay distinct while re-deliveries of one collapse.
 *
 * Returns `null` for a **partial refund with no provider refund id**: there is
 * no way to tell a re-delivery from a genuine second partial of the same
 * amount, and silently dropping a real refund (under-recording money that left
 * the account, the HOS-235 failure mode) is worse than the duplicate this
 * module exists to prevent. The caller applies the refund and logs instead.
 *
 * @param input - Payment identity, amounts in centavos, optional provider refund id.
 * @returns The namespaced key, or `null` when no stable identity exists.
 */
export function buildRefundIdempotencyKey({
    paymentId,
    paymentAmount,
    refundAmount,
    providerRefundId
}: BuildRefundIdempotencyKeyInput): string | null {
    const isFull = refundAmount === undefined || refundAmount >= paymentAmount;

    if (isFull) {
        return `${REFUND_KEY_NAMESPACE}${paymentId}:full`;
    }

    if (providerRefundId) {
        return `${REFUND_KEY_NAMESPACE}${paymentId}:refund:${providerRefundId}`;
    }

    return null;
}

// ─── Claim ────────────────────────────────────────────────────────────────────

/**
 * Input for {@link claimRefundApplication}.
 */
export interface ClaimRefundApplicationInput {
    /** The key from {@link buildRefundIdempotencyKey}. */
    readonly key: string;
    /**
     * Forensic context persisted alongside the claim (`request_params`). Never
     * read back by the code — it exists so an operator can answer "which path
     * won this refund" from the table alone.
     */
    readonly context: Readonly<Record<string, unknown>>;
}

/**
 * Result of {@link claimRefundApplication}.
 */
export interface ClaimRefundApplicationResult {
    /** `true` when this caller owns the refund and must apply the effect. */
    readonly claimed: boolean;
    /**
     * `true` when the ledger write itself failed and the claim was granted
     * anyway. See the fail-open rationale on {@link claimRefundApplication}.
     */
    readonly failOpen: boolean;
}

/**
 * Atomically claim the right to apply one refund's lifecycle effect.
 *
 * Exactly one caller gets `claimed: true` per key; every later caller — a
 * provider retry, the other door, a dead-letter replay — gets `claimed: false`
 * and must do nothing.
 *
 * **Fail-open on a ledger error (deliberate).** If the INSERT throws, the claim
 * is granted with `failOpen: true`. A transient DB error is not evidence of a
 * duplicate, and refusing to apply would leave real money unrecorded on the
 * payment — the exact regression HOS-235 fixed. A DB outage does not manufacture
 * the double-delivery this guard exists for, so failing open costs nothing in
 * the case that matters and preserves the stronger invariant.
 *
 * @param input - The key and forensic context.
 * @returns Whether the caller owns this refund, and whether it failed open.
 */
export async function claimRefundApplication({
    key,
    context
}: ClaimRefundApplicationInput): Promise<ClaimRefundApplicationResult> {
    try {
        const rows = await getDb()
            .insert(billingIdempotencyKeys)
            .values({
                key,
                operation: REFUND_LEDGER_OPERATION,
                requestParams: context as Record<string, unknown>,
                expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
                // Same single source of truth as middlewares/billing.ts,
                // middlewares/idempotency-key.ts, and the mercadopago webhook
                // event-handler: sandbox mode means every persisted row is
                // non-live. Omitting this silently falls back to the
                // column's `DEFAULT true`
                // (packages/db/src/migrations/0000_baseline.sql), which
                // mislabels every sandbox-generated refund claim as
                // production (HOS-719, same shape as HOS-708).
                livemode: !env.HOSPEDA_MERCADO_PAGO_SANDBOX
            } as typeof billingIdempotencyKeys.$inferInsert)
            .onConflictDoNothing({ target: billingIdempotencyKeys.key })
            .returning({ key: billingIdempotencyKeys.key });

        return { claimed: rows.length > 0, failOpen: false };
    } catch (err) {
        apiLogger.error(
            { key, err, ...context },
            'Refund idempotency: ledger claim failed — applying fail-open (a DB error is not evidence of a duplicate)'
        );
        return { claimed: true, failOpen: true };
    }
}
