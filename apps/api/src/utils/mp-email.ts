/**
 * MercadoPago Email Sanitizer
 *
 * MercadoPago rejects '+' (plus-addressing) in emails with error 612
 * "Field=email - Syntax invalid", even though '+' is RFC 5321/5322-valid.
 *
 * CALL THIS AT THE BOUNDARY, never before persisting (HOS-581). The mangled
 * address is for MercadoPago's eyes only; it must not become the address
 * Hospeda stores or mails to.
 *
 * It used to run at persistence, in `billing-customer-sync`, on the premise
 * that "checkout/preapproval reuse it directly from the DB on every subsequent
 * call". HOS-191 ended that premise: the monthly and annual checkouts redirect
 * to MercadoPago's hosted `preapproval_plan` share link, which collects the
 * payer on its own page, and the `payerEmail` those paths carry is a LOCAL
 * reconciliation snapshot (`billing_pending_checkouts`) that is never sent. The
 * one remaining sender is the prorated-upgrade Checkout Pro preference in
 * `initiatePaidPlanUpgrade` — the single call site of this function.
 *
 * @module utils/mp-email
 */

/**
 * Sanitizes an email immediately before handing it to MercadoPago.
 *
 * Replaces every '+' in the LOCAL part of the email (the part before the
 * last '@') with '.'. The domain is left untouched. This preserves the
 * uniqueness of plus-addressed accounts (e.g. `user+tag@gmail.com`) while
 * avoiding MP's syntax rejection.
 *
 * H-95 — why the result is very likely a DEAD mailbox, stated plainly because
 * the original docblock claimed the opposite. It justified the choice with
 * "for providers like Gmail that ignore '.' in the local part, mail still
 * lands in the same inbox". That is backwards, and for exactly the reason it
 * cites: Gmail ignoring dots means `user.tag@gmail.com` collapses to
 * `usertag@gmail.com` — a DIFFERENT address from `user@gmail.com`, which is
 * where the discarded `+tag` form would have landed.
 *
 * That is why the value must not escape this boundary. While the call sat at
 * persistence, `billing_customers.email` held the mangled address, and that
 * column is read back as `recipientEmail` by eight of Hospeda's OWN sends —
 * dunning, cancellation finalisation, scheduled plan changes, price
 * propagation, abandoned pending subscriptions, addon purchase, and the
 * payment success/failure webhook notifications. For a plus-addressed signup
 * every one of those went nowhere. HOS-581 moved the call here; the column now
 * holds the real address and those eight sends needed no change.
 *
 * STILL UNVERIFIED: whether Checkout Pro — the only caller left — rejects '+'
 * at all. Error 612 is documented against the customer/preapproval APIs, which
 * this flow no longer uses that way, and production offers no evidence either
 * way (the two plus-bearing customer rows predate the sanitizer and never
 * reached MercadoPago). If an MP sandbox smoke shows Checkout Pro accepts '+',
 * this function can be deleted outright rather than merely relocated.
 *
 * It also must not be shown to the user. Surfacing this value in the checkout
 * UI displays an address they never wrote and do not recognise; the notice
 * that did so was removed under HOS-452/H-82 (see `PlanPurchaseButton.client.tsx`).
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
