/**
 * @file whatsapp.ts
 * @description Single source of truth for every `wa.me` click-to-chat deep link
 * built from a STORED PHONE NUMBER in the public web app (HOS-289).
 *
 * Scope note: this module does NOT own every `wa.me` string in `apps/web`.
 * Links that are not built from a stored phone stay outside it and are
 * legitimately hand-written — the recipient-less share intent
 * (`ShareButtons.client.tsx`), the brand profile literal (`lib/constants.ts`),
 * the FAQ page's hardcoded support number (`preguntas-frecuentes/index.astro`),
 * and the two operator-entered pass-through paths
 * (`host-trades/TradeCard.tsx`'s `resolveContactHref`,
 * `gastronomy/GastronomyContactBlock.astro`'s `socialNetworks.whatsapp` href).
 *
 * Before this module the app hand-rolled the link from a stored phone in three
 * places running TWO distinct rules: `WhatsAppContact.client.tsx` and
 * `ExperienceContactCTA.astro` shared byte-identical logic (differing only in
 * concat syntax) that preserved the leading `+` of an E.164 number, producing
 * `https://wa.me/+543442453797`; `contacto/index.astro` was the one genuinely
 * different rule and already sanitized correctly.
 *
 * What the `+` actually does, measured against wa.me on 2026-07-29 (it is NOT a
 * 404, contrary to the original bug report): both forms redirect to
 * `api.whatsapp.com/send`, but only the digits-only one resolves the
 * RECIPIENT. With the `+`, the landing page reads "Chat on WhatsApp with
 * +54 9 3442 45-3797"; without it, the same number renders the contact's
 * actual name. So the `+` degrades the deep link rather than breaking it —
 * and the behaviour of the native Android/iOS handler, where most of the
 * traffic lands, was not verified either way.
 *
 * Deliberate non-goals:
 *   - No country-code heuristics. The digits stored on the entity are sent
 *     as-is. (The admin panel's `WhatsAppLinkCell` DOES prepend the Argentinian
 *     `549`; that divergence is intentional and out of scope here.)
 *   - No plausibility check beyond the SHAPE rejection ({@link NON_PHONE_SHAPE})
 *     and the digit-count bounds enforced by
 *     {@link E164_MIN_DIGITS}/{@link E164_MAX_DIGITS} — an operator-entered
 *     number is otherwise the operator's to get right.
 *
 * @module lib/whatsapp
 */

/**
 * Minimum digit count accepted.
 *
 * ITU-T E.164 fixes only the 15-digit MAXIMUM; it defines no minimum. The 7
 * here is not the standard's — it is the floor of `InternationalPhoneRegex`
 * (`packages/schemas/src/utils/utils.ts`, `/^\+[1-9](?:\s?\d){6,14}$/`, i.e.
 * exactly 7..15 digits), the regex every WRITE to `contactInfo.whatsapp` must
 * pass. Mirroring the write bound is the point: anything the write path accepts
 * must render, and anything it rejects has no business minting a live link.
 *
 * Kept as a local literal (not imported from `@repo/schemas`, a browser-bundle
 * hazard in web client code) and pinned to the write regex by a test in
 * `apps/web/test/lib/whatsapp.test.ts`, which derives the regex's bounds and
 * asserts they equal these constants.
 */
export const E164_MIN_DIGITS = 7;

/**
 * Maximum digit count accepted: the ceiling of the same
 * `InternationalPhoneRegex` write bound, which coincides with the 15-digit cap
 * ITU-T E.164 places on the whole number, country code included.
 */
export const E164_MAX_DIGITS = 15;

/**
 * Characters that prove the input is not a phone number: any letter, `/` or
 * `:`. Their presence means a URL, a short link or free prose was pasted into
 * the field — see {@link buildWhatsAppLink} for why the digit-count bound alone
 * does not catch those.
 */
const NON_PHONE_SHAPE = /[\p{L}/:]/u;

/** Input for {@link buildWhatsAppLink}. */
export interface BuildWhatsAppLinkInput {
    /** Raw phone number as stored, in any human format (`+54 9 3442 45-3797`). */
    readonly phone: string;
    /**
     * Optional prefilled chat message, passed RAW.
     *
     * This builder percent-encodes it before appending it as the `text` query
     * parameter, so callers MUST NOT pre-encode: a pre-encoded message is
     * double-encoded and ships `%2520` for every space.
     */
    readonly message?: string;
}

/** Result of {@link buildWhatsAppLink}. */
export interface BuildWhatsAppLinkResult {
    /** The deep link, or `null` when the phone is not a dialable number. */
    readonly url: string | null;
}

/**
 * Builds a `wa.me` click-to-chat deep link from a stored phone number.
 *
 * Two independent gates run before the link is built, and either returns
 * `null` so callers can decline to render the button instead of shipping a
 * dead — or worse, a plausible-but-wrong — one:
 *
 *   1. SHAPE: an input containing a letter, `/` or `:` is not a phone number
 *     ({@link NON_PHONE_SHAPE}).
 *   2. DIGIT COUNT: what remains must land within
 *     `{@link E164_MIN_DIGITS}`-`{@link E164_MAX_DIGITS}` inclusive.
 *
 * Neither is a country-code heuristic: no digit is ever added, removed or
 * reordered, so the "strip the `+` and nothing else" decision is untouched.
 *
 * The SHAPE gate is the load-bearing one, and the digit-count gate cannot
 * replace it: stripping non-digits from a URL-shaped value silently mints a
 * live link to an UNRELATED recipient. `https://wa.me/message/CWFRH6N5FURTC1`
 * happens to reduce to `wa.me/651` (3 digits, caught by length), but
 * `https://wa.me/message/AB12345678` reduces to 8 digits — squarely inside
 * 7..15, and a live chat with whoever owns that number. Length alone is
 * probabilistic; the shape gate is structural.
 *
 * Why an unusable value can reach here at all: the WRITE path is guarded by
 * `InternationalPhoneRegex`, but `ContactInfoReadSchema` is deliberately
 * lenient (HOS-190) so legacy and imported rows can still hold formats the
 * write regex rejects, and this builder runs at RENDER time on read data.
 * (The `wa.me/message/...` literal above is the SHAPE operators actually type,
 * observed in this repo's seed data at
 * `packages/seed/src/data/accommodation/uruguay/103-*.json` — but under
 * `socialNetworks.whatsapp`, a field no call site ever feeds to this builder:
 * both call paths read `contactInfo.whatsapp`. It is an illustration of the
 * input shape, not a reachable input.)
 *
 * @param input - The phone number and, optionally, a RAW prefilled message.
 * @returns The deep link, or `null` when the number is unusable.
 *
 * @example
 * ```ts
 * buildWhatsAppLink({
 *   phone: '+54 9 3442 45-3797',
 *   message: 'Hola, me interesa'
 * });
 * // → { url: 'https://wa.me/5493442453797?text=Hola%2C%20me%20interesa' }
 * ```
 */
export function buildWhatsAppLink({
    phone,
    message
}: BuildWhatsAppLinkInput): BuildWhatsAppLinkResult {
    if (NON_PHONE_SHAPE.test(phone)) {
        return { url: null };
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) {
        return { url: null };
    }

    const trimmedMessage = message?.trim();
    const query = trimmedMessage ? `?text=${encodeURIComponent(trimmedMessage)}` : '';

    return { url: `https://wa.me/${digits}${query}` };
}
