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
 * ## Source of truth (HOS-971)
 *
 * The **Hospeda account email is the source of truth**; `mp_payer_email` is a
 * non-authoritative CACHE of the last address MercadoPago happened to accept.
 * The two are not peers, and the precedence in {@link resolvePayerEmail} is
 * not a contradiction of that: the cache is preferred only for as long as it
 * is still known to describe this account.
 *
 * What makes it stop describing the account is one event — the person changing
 * their email in Hospeda — and {@link clearMpPayerEmailBestEffort} is what
 * invalidates it there (called from
 * `apps/api/src/services/billing-customer-sync.ts`, on the Better Auth
 * `user.update.after` hook, which is the single choke point: `email` is not a
 * field `ProfileEditSchema` or the admin user-update schema can write).
 *
 * Invalidation is deliberately event-driven rather than derived from comparing
 * `mp_payer_email` against `billing_customers.email`. The two values also
 * diverge legitimately — whoever pays with a MercadoPago account registered
 * under a different address (HOS-208), or who had to supply an alternative
 * because theirs carries a `+` (HOS-1021) — and a comparison cannot tell that
 * apart from staleness. The event can.
 *
 * Nothing here ever tries to REPOINT an existing preapproval: HOS-937 measured
 * that MercadoPago ignores a `PUT` on `payer_email`. A live subscription keeps
 * charging under the binding it was born with, which is exactly what must not
 * break; only the NEXT preapproval picks up the new address.
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
     *
     * A CACHE, not an identity (HOS-971): it is dropped by
     * {@link clearMpPayerEmailBestEffort} as soon as the account email
     * changes, so a value present here is one still known to belong to this
     * account. See the module docblock.
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
 * Best-effort, exactly like its sibling {@link persistMpPayerEmailBestEffort}:
 * a query failure is logged (with Sentry capture) and degraded to `null`,
 * never rethrown. The value this returns is step 1 of a three-step
 * precedence (see {@link resolvePayerEmail}) with two perfectly good
 * fallbacks behind it — `requestedPayerEmail` and `customerEmail` — so a
 * read failure must cost the caller the OPTIMIZATION, not the checkout.
 *
 * This is not hypothetical (HOS-1028): the column ships through the extras
 * carril, and it was absent from both staging and production while the
 * code that reads it sat merged and undeployed. Because all five checkout
 * call sites in `subscription-checkout.service.ts` invoke this BEFORE their
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` check, a throw here answered
 * 500 on every checkout path — accommodation monthly, annual, commerce and
 * partner alike — with the feature flag OFF. The migration removed that
 * specific trigger; degrading here removes the class of failure, which a
 * timeout, an exhausted pool, or a revoked grant can still reach.
 *
 * @param customerId - The qzpay/Hospeda billing customer id.
 * @param db - Drizzle client override for tests. Defaults to {@link getDb}.
 * @returns The stored `mp_payer_email`, or `null` when unset, when the
 *   customer row does not exist, or when the read itself failed.
 */
export async function getMpPayerEmail(
    customerId: string,
    db: DrizzleClient = getDb()
): Promise<string | null> {
    try {
        const result = await db.execute(
            sql`SELECT mp_payer_email FROM billing_customers WHERE id = ${customerId} LIMIT 1`
        );
        const row = result.rows[0] as { mp_payer_email: string | null } | undefined;
        return row?.mp_payer_email ?? null;
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-1028: failed to read billing_customers.mp_payer_email (best-effort, degrading to the remaining payer-email precedence)',
            { capture: true }
        );
        return null;
    }
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

/**
 * Input for {@link clearMpPayerEmailBestEffort}.
 */
export interface ClearMpPayerEmailInput {
    /** The qzpay/Hospeda billing customer id whose cached MP email to drop. */
    readonly customerId: string;
    /** Drizzle client override for tests. Defaults to {@link getDb}. */
    readonly db?: DrizzleClient;
}

/**
 * Invalidate `billing_customers.mp_payer_email` because the account email it
 * was cached against has changed (HOS-971).
 *
 * This is a LOCAL write and nothing else. It does not call MercadoPago, does
 * not cancel anything, and does not touch a live preapproval — HOS-937
 * measured that `payer_email` is immutable there (a `PUT` returns 200 and
 * changes nothing), so an existing subscription necessarily keeps charging
 * under the address it was authorized with. That is the outcome to protect,
 * not to repair.
 *
 * What it does buy is the NEXT preapproval. Without it, the stale cache
 * outranks `billing_customers.email` in {@link resolvePayerEmail}, so a
 * checkout with no user-supplied address would bind a brand-new preapproval
 * to an email the person no longer owns — and MercadoPago will not say which
 * email it expected, it just tells them to contact the seller.
 *
 * Writes EXCLUSIVELY the `mp_payer_email` column, by construction: the UPDATE
 * statement names no other column, so `billing_customers.email` — the address
 * eight of our own sends read — cannot be collateral damage (same guarantee
 * as {@link persistMpPayerEmailBestEffort}, AC-9/HOS-581).
 *
 * Best-effort, like both its siblings: a failure is logged with Sentry capture
 * and swallowed. It runs inside a Better Auth `user.update.after` hook, where
 * throwing would turn a failed cache invalidation into a failed profile save.
 * The cost of a swallowed failure is bounded and self-healing — the user is
 * asked to confirm the payer email on the pre-redirect screen anyway, and
 * whatever they confirm is re-persisted here on the next activation.
 *
 * The `WHERE mp_payer_email IS NOT NULL` clause keeps this a no-op row-wise
 * for the overwhelming majority of customers, who never completed a checkout
 * under the own-preapproval flow at all.
 *
 * @param input - See {@link ClearMpPayerEmailInput}.
 */
export async function clearMpPayerEmailBestEffort(input: ClearMpPayerEmailInput): Promise<void> {
    const { customerId, db = getDb() } = input;

    try {
        await db.execute(
            sql`UPDATE billing_customers SET mp_payer_email = NULL WHERE id = ${customerId} AND mp_payer_email IS NOT NULL`
        );
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-971: failed to invalidate billing_customers.mp_payer_email after an account email change (best-effort, non-blocking)',
            { capture: true }
        );
    }
}
