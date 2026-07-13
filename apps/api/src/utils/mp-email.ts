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
 * avoiding MP's syntax rejection, and for providers like Gmail that ignore
 * '.' in the local part, mail still lands in the same inbox.
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
