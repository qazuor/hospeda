/**
 * @file brand-phone.ts
 * @description Single source of truth for the Hospeda BRAND contact phone
 * number and its three rendered forms (HOS-364).
 *
 * Before this module the number was hand-typed in eighteen places, spelled
 * four different ways, and none of them agreed with each other: five carried
 * the AR mobile `9` (required for a `wa.me` link to resolve a mobile
 * recipient), thirteen did not (correct for a plain phone call or display
 * text). Neither form was wrong on its own — nothing derived one from the
 * other, so a literal could drift into the wrong slot with no way to notice.
 * The FAQ page's WhatsApp CTA was exactly that: the WhatsApp form, missing
 * its `9`, so the button opened no chat at all.
 *
 * The configured value ({@link getBrandPhoneRaw} in `./env`) is the
 * call/display form, WITHOUT the mobile `9` — a phone call and a screen
 * reader both want that form, and it is what the schema.org `telephone`
 * field publishes. {@link getBrandPhoneWhatsAppUrl} is the ONE place that
 * inserts the `9` before building a `wa.me` link.
 *
 * Configurable via `HOSPEDA_BRAND_PHONE` (see `env-schema.ts`), so changing
 * the real number is one env var, not eighteen call sites.
 *
 * Scope note: this module owns the Hospeda BRAND number only. It does not
 * replace `@/lib/whatsapp`, which builds `wa.me` links from a STORED ENTITY
 * phone (an accommodation's, a partner's) — a different, per-entity input
 * with no single configured value. {@link getBrandPhoneWhatsAppUrl} calls
 * into `buildWhatsAppLink` for the shape/length gate rather than duplicating
 * it.
 *
 * @module lib/brand-phone
 */

import { getBrandPhoneRaw } from './env';
import { buildWhatsAppLink } from './whatsapp';

/**
 * Argentina's country calling code. The only prefix this module ever inserts
 * a mobile `9` after — {@link getBrandPhoneRaw} is always an AR number.
 */
const AR_COUNTRY_CODE = '54';

/**
 * Strips everything but digits and a leading `+` from a phone string.
 *
 * @param raw - A phone number in any human format.
 * @returns The number with only digits and an optional leading `+`.
 */
function toE164Digits(raw: string): string {
    return raw.replace(/[^+\d]/g, '');
}

/**
 * Returns the brand phone number formatted for display, exactly as
 * configured (`HOSPEDA_BRAND_PHONE` — see its default in `env-schema.ts`).
 *
 * @returns The human-readable brand phone number
 */
export function getBrandPhoneDisplay(): string {
    return getBrandPhoneRaw();
}

/**
 * Returns the brand phone number without its leading country-code group, for
 * prose that already establishes the country (e.g. "Llamanos al 3442
 * 453797"). Strips a leading `+54` (and any following whitespace) only; any
 * other configured value passes through unchanged rather than guessing.
 *
 * @returns The local-format brand phone number
 */
export function getBrandPhoneLocalDisplay(): string {
    return getBrandPhoneRaw().replace(/^\+54\s*/, '');
}

/**
 * Returns the brand phone number in E.164 form — digits only, `+` prefix, no
 * spaces. The form a `tel:` href and the schema.org `telephone` field both
 * want. Carries NO AR mobile `9`: that prefix is WhatsApp-specific (see
 * {@link getBrandPhoneWhatsAppUrl}) and wrong on a plain call.
 *
 * @returns The E.164 brand phone number
 */
export function getBrandPhoneE164(): string {
    return toE164Digits(getBrandPhoneRaw());
}

/**
 * Returns a `tel:` href for the brand phone number.
 *
 * @returns The `tel:` URI
 */
export function getBrandPhoneTelHref(): string {
    return `tel:${getBrandPhoneE164()}`;
}

/**
 * Returns the `wa.me` deep link for the brand phone number, or `null` when
 * the configured value is not dialable (delegates the shape/length gate to
 * {@link buildWhatsAppLink} instead of re-implementing it).
 *
 * Inserts the AR mobile `9` after the `54` country code before building the
 * link — the one step {@link getBrandPhoneE164} deliberately does not take.
 * Without it, WhatsApp resolves the link to no recipient (or the wrong one)
 * instead of the brand's mobile line — the exact bug the FAQ page shipped.
 *
 * @param message - Optional prefilled chat message, passed through raw (see
 *   {@link buildWhatsAppLink} for the encoding contract).
 * @returns The `wa.me` URL, or `null` when the configured number is unusable
 */
export function getBrandPhoneWhatsAppUrl(message?: string): string | null {
    const digits = toE164Digits(getBrandPhoneRaw()).replace(/^\+/, '');
    const withMobilePrefix = digits.startsWith(`${AR_COUNTRY_CODE}9`)
        ? digits
        : digits.startsWith(AR_COUNTRY_CODE)
          ? `${AR_COUNTRY_CODE}9${digits.slice(AR_COUNTRY_CODE.length)}`
          : digits;

    return buildWhatsAppLink({ phone: withMobilePrefix, message }).url;
}
