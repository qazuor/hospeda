/**
 * @file whatsapp.ts
 * @description Single source of truth for `wa.me` click-to-chat deep links in
 * the public web app (HOS-289).
 *
 * Before this module the app hand-rolled the link in three places with three
 * different rules; two of them preserved the leading `+` of an E.164 number,
 * producing `https://wa.me/+543442453797`. wa.me does NOT accept the `+` — it
 * lands on WhatsApp's "phone number shared via url is invalid" screen, so the
 * contact button silently went nowhere.
 *
 * Deliberate non-goals:
 *   - No country-code heuristics. The digits stored on the entity are sent
 *     as-is. (The admin panel's `WhatsAppLinkCell` DOES prepend the Argentinian
 *     `549`; that divergence is intentional and out of scope here.)
 *   - No validation of length or plausibility — an operator-entered number is
 *     the operator's to get right.
 *
 * @module lib/whatsapp
 */

/** Input for {@link buildWhatsAppLink}. */
export interface BuildWhatsAppLinkInput {
    /** Raw phone number as stored, in any human format (`+54 9 3442 45-3797`). */
    readonly phone: string;
    /** Optional prefilled chat message, sent unencoded. */
    readonly message?: string;
}

/** Result of {@link buildWhatsAppLink}. */
export interface BuildWhatsAppLinkResult {
    /** The deep link, or `null` when the phone carries no digits to dial. */
    readonly url: string | null;
}

/**
 * Builds a `wa.me` click-to-chat deep link from a stored phone number.
 *
 * Every non-digit is stripped, including the leading `+`: wa.me expects bare
 * E.164 digits. When the input carries no digits at all the result is `null`
 * rather than a `https://wa.me/` link with no recipient, so callers can decline
 * to render the button instead of shipping a dead one.
 *
 * @param input - The phone number and, optionally, a prefilled message.
 * @returns The deep link, or `null` when the number is unusable.
 *
 * @example
 * ```ts
 * buildWhatsAppLink({ phone: '+54 9 3442 45-3797', message: 'Hola' });
 * // → { url: 'https://wa.me/5493442453797?text=Hola' }
 * ```
 */
export function buildWhatsAppLink({
    phone,
    message
}: BuildWhatsAppLinkInput): BuildWhatsAppLinkResult {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 0) return { url: null };

    const trimmedMessage = message?.trim();
    const query = trimmedMessage ? `?text=${encodeURIComponent(trimmedMessage)}` : '';

    return { url: `https://wa.me/${digits}${query}` };
}
