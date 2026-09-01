/**
 * Payer-email resolution and persistence for MercadoPago preapprovals
 * (HOS-937 step 2).
 *
 * `payer_email` is BINDING on a MercadoPago preapproval: only whoever uses
 * or types that exact email can authorize the charge, and MercadoPago never
 * shows the user which email it expects — it just says "contact the
 * seller". Step 1 (`own-preapproval-subscription-create.ts`) creates the
 * per-user preapproval; this module resolves WHICH email to send, and
 * persists the one that actually worked.
 *
 * `billing_customers.mp_payer_email` (added by
 * `packages/db/src/migrations/extras/037-billing-customers-mp-payer-email.column.sql`)
 * is NOT a typed Drizzle column — `billing_customers` is owned by
 * `@qazuor/qzpay-drizzle` and this column went through the extras carril
 * (raw SQL), unlike `product_domain` (HOS-73), which qzpay-drizzle 1.11.0
 * typed directly. Both read and write here go through raw SQL for that
 * reason.
 *
 * @module services/billing/payer-email
 */

import { type DrizzleClient, getDb, sql } from '@repo/db';
import { apiLogger } from '../../utils/logger.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Input for {@link resolvePayerEmail}.
 */
export interface ResolvePayerEmailInput {
    /**
     * The email the user explicitly typed on the pre-redirect screen
     * (spec §8.1), or supplied on the `/start-paid` request body. Already
     * format-validated by Zod (`StartPaidSubscriptionRequestSchema`) before
     * it reaches here. Wins over both other sources when present (spec
     * §6.3: "whatever the user typed... wins over both").
     */
    readonly requestedPayerEmail?: string;
    /**
     * `billing_customers.mp_payer_email` — the last email MercadoPago
     * actually accepted for this customer, if any (spec §6.3 resolution
     * order, step 1).
     */
    readonly mpPayerEmail?: string | null;
    /**
     * `billing_customers.email` — the signup address (spec §6.3 resolution
     * order, step 2 / fallback).
     */
    readonly customerEmail: string;
}

/**
 * Result of {@link resolvePayerEmail}.
 */
export interface ResolvePayerEmailResult {
    /** The resolved email to send as `payerEmail` to qzpay-core. */
    readonly payerEmail: string;
}

/**
 * Resolve which email to bind the MercadoPago preapproval to (spec §6.3).
 *
 * Precedence: `requestedPayerEmail` (user-typed, wins over both) >
 * `mpPayerEmail` (last one that worked) > `customerEmail` (signup default).
 *
 * @throws SubscriptionCheckoutError With code
 *   `PAYER_EMAIL_UNSUPPORTED_CHARACTER` when the resolved email contains a
 *   `+`. MercadoPago rejects such emails outright (`User bad request`, with
 *   no field name and no code — isolated against a negative control: it is
 *   the CHARACTER, not the Gmail alias).
 *
 *   Spec §11 OQ-1 is **resolved** (HOS-1021, option 1): the user is asked
 *   for an alternative address on the pre-redirect screen
 *   (`apps/web/src/components/billing/PayerEmailConfirmDialog.client.tsx`),
 *   whose value arrives here as `requestedPayerEmail` and wins over both
 *   other sources. This throw is no longer a placeholder for a pending
 *   decision — it is **defense in depth** for any caller that does not come
 *   through that dialog, and it must stay: a `+` that reaches MercadoPago
 *   fails the whole checkout with an opaque error the user cannot act on.
 *
 *   `sanitizeEmailForMercadoPago` (`apps/api/src/utils/mp-email.ts:75-87`)
 *   is deliberately NOT used to rescue this case. Its own docblock documents
 *   that rewriting `+` to `.` very likely produces a DEAD MAILBOX (Gmail
 *   ignores dots, so `user.tag@gmail.com` collapses to `usertag@gmail.com`,
 *   which is not `user@gmail.com`) — and here that is worse than elsewhere,
 *   because this exact string is what the user must later type at
 *   MercadoPago to authorize the charge.
 */
export function resolvePayerEmail(input: ResolvePayerEmailInput): ResolvePayerEmailResult {
    const { requestedPayerEmail, mpPayerEmail, customerEmail } = input;

    const payerEmail = requestedPayerEmail || mpPayerEmail || customerEmail;

    // HOS-937 §11 OQ-1, resolved by HOS-1021 as option 1: the user is asked
    // for an alternative address on the pre-redirect screen, and it arrives
    // here as `requestedPayerEmail`. This branch is the backstop for every
    // caller that does not come through that screen — it fails closed rather
    // than rewriting the address into one the user never wrote. See JSDoc.
    if (payerEmail.includes('+')) {
        throw new SubscriptionCheckoutError(
            'PAYER_EMAIL_UNSUPPORTED_CHARACTER',
            `The email '${payerEmail}' contains a '+', which MercadoPago does not accept as a payer email. Please use a different email.`
        );
    }

    return { payerEmail };
}

/**
 * Read `billing_customers.mp_payer_email` for a customer (raw SQL — see
 * module JSDoc for why this column cannot be read through the typed
 * Drizzle table).
 *
 * @param customerId - The qzpay/Hospeda billing customer id.
 * @param db - Drizzle client override for tests. Defaults to {@link getDb}.
 * @returns The stored `mp_payer_email`, or `null` when unset or the
 *   customer row does not exist.
 */
export async function getMpPayerEmail(
    customerId: string,
    db: DrizzleClient = getDb()
): Promise<string | null> {
    const result = await db.execute(
        sql`SELECT mp_payer_email FROM billing_customers WHERE id = ${customerId} LIMIT 1`
    );
    const row = result.rows[0] as { mp_payer_email: string | null } | undefined;
    return row?.mp_payer_email ?? null;
}

/**
 * Input for {@link persistMpPayerEmailBestEffort}.
 */
export interface PersistMpPayerEmailInput {
    /** The qzpay/Hospeda billing customer id whose row to update. */
    readonly customerId: string;
    /** The email MercadoPago just confirmed by authorizing the preapproval. */
    readonly payerEmail: string;
    /** Drizzle client override for tests. Defaults to {@link getDb}. */
    readonly db?: DrizzleClient;
}

/**
 * Persist the email that MercadoPago just accepted onto
 * `billing_customers.mp_payer_email` — called ONLY on the
 * `pending_provider -> active/trialing` webhook transition (i.e. once the
 * preapproval reaches `authorized`), never at checkout creation time (spec
 * §6.3: "An email that did not work is not stored").
 *
 * Writes EXCLUSIVELY the `mp_payer_email` column. `billing_customers.email`
 * (the real address Hospeda writes to — eight of our own sends read it) is
 * NEVER touched by this function, by construction: the UPDATE statement
 * names no other column (AC-9, HOS-581).
 *
 * Best-effort: failures are logged (with Sentry capture) and swallowed,
 * mirroring the sibling `applyPendingDiscountBestEffort` /
 * `applyPendingTrialExtensionBestEffort` pattern this webhook transition
 * already uses — a failure here must never break webhook processing or
 * the subscription activation it is reporting.
 *
 * @param input - See {@link PersistMpPayerEmailInput}.
 */
export async function persistMpPayerEmailBestEffort(
    input: PersistMpPayerEmailInput
): Promise<void> {
    const { customerId, payerEmail, db = getDb() } = input;

    try {
        await db.execute(
            sql`UPDATE billing_customers SET mp_payer_email = ${payerEmail} WHERE id = ${customerId}`
        );
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-937: failed to persist billing_customers.mp_payer_email (best-effort, non-blocking)',
            { capture: true }
        );
    }
}
