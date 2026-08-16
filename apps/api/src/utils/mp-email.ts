/**
 * MercadoPago Email Sanitizer
 *
 * MercadoPago's customer/preapproval APIs reject '+' (plus-addressing) in
 * emails with error 612 "Field=email - Syntax invalid", even though '+' is
 * RFC 5321/5322-valid. This util sanitizes an email once, at the point it
 * is persisted to `billing_customers.email`, so every downstream MP call
 * (checkout, preapproval, upgrade) reuses the already-safe value.
 *
 * @module utils/mp-email
 */

/**
 * Sanitizes an email for MercadoPago's customer/preapproval APIs.
 *
 * Replaces every '+' in the LOCAL part of the email (the part before the
 * last '@') with '.'. The domain is left untouched. This preserves the
 * uniqueness of plus-addressed accounts (e.g. `user+tag@gmail.com`) while
 * avoiding MP's syntax rejection.
 *
 * H-95 — what this costs, stated plainly, because the original docblock had it
 * backwards. It claimed that "for providers like Gmail that ignore '.' in the
 * local part, mail still lands in the same inbox". The opposite is true, and
 * for exactly the reason cited: Gmail ignoring dots means `user.tag@gmail.com`
 * collapses to `usertag@gmail.com` — a DIFFERENT address from `user@gmail.com`,
 * which is where the discarded `+tag` form would have landed. So the sanitized
 * address is, for the plus-addressing case, very likely a mailbox nobody reads.
 *
 * The blast radius is NOT confined to MercadoPago's own provider notices. The
 * sanitized value is what `billing_customers.email` stores, and that column is
 * read back as `recipientEmail` for Hospeda's OWN billing mail — dunning
 * (`cron/jobs/dunning.job.ts`), cancellation finalisation
 * (`cron/jobs/finalize-cancelled-subs.ts`), scheduled plan changes, plan price
 * propagation, abandoned pending subscriptions, and the MercadoPago webhook
 * notifications (`routes/webhooks/mercadopago/notifications.ts`). For a
 * plus-addressed signup, every one of those lands in the dead mailbox too.
 *
 * What bounds it today: only addresses CONTAINING '+' are altered at all, and
 * only Gmail-family providers collapse dots. Measured against production on
 * 2026-08-15, all five mangled rows belong to test accounts and no real user
 * signed up with a plus alias — the mechanism is live, but it has yet to hit
 * anyone.
 *
 * The fix is tracked as HOS-581: keep this value as the MercadoPago payer
 * identity (MP needs it) and resolve `users.email` for Hospeda's OWN sends.
 * That is a behaviour change across seven send sites, not a docblock edit, so
 * it is deliberately NOT bundled into the change that corrected this comment.
 *
 * It also must not be shown to the user. Surfacing this value in the checkout UI
 * displays an address they never wrote and do not recognise; the notice that did
 * so was removed under HOS-452/H-82 (see `PlanPurchaseButton.client.tsx`).
 *
 * Defensive: if the input has no '@', or the '@' is the first character
 * (no local part to sanitize), the email is returned unchanged. Idempotent
 * for emails that contain no '+'.
 *
 * @param email - The email address to sanitize
 * @returns The sanitized email, safe to send to MercadoPago
 *
 * @example
 * ```ts
 * sanitizeEmailForMercadoPago('qazuor+turista@gmail.com') // 'qazuor.turista@gmail.com'
 * sanitizeEmailForMercadoPago('a+b+c@example.com')         // 'a.b.c@example.com'
 * sanitizeEmailForMercadoPago('plain@example.com')          // 'plain@example.com'
 * sanitizeEmailForMercadoPago('local@ex+ample.com')          // 'local@ex+ample.com' (domain untouched)
 * sanitizeEmailForMercadoPago('not-an-email')                 // 'not-an-email' (no '@', unchanged)
 * ```
 */
export function sanitizeEmailForMercadoPago(email: string): string {
    const atIndex = email.lastIndexOf('@');

    // No '@', or nothing before it (no local part) — return unchanged.
    if (atIndex <= 0) {
        return email;
    }

    const localPart = email.slice(0, atIndex);
    const domainPart = email.slice(atIndex);

    return `${localPart.replaceAll('+', '.')}${domainPart}`;
}
