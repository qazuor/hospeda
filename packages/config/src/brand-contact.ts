/**
 * Hospeda's public brand contact data and social profiles (HOS-2565 D12, spec §9.4).
 *
 * Single source of truth for the facts that do not depend on the environment: the
 * social profile URLs, the public contact email and the production brand phone.
 * `apps/web` builds its `SOCIAL_PROFILES` from {@link BRAND_SOCIAL_PROFILES}, and the
 * user email footer (`@repo/email`) renders from this module too, so a profile URL is
 * written once.
 *
 * The phone shown on the web is still configurable per deployment through
 * `HOSPEDA_BRAND_PHONE` (HOS-364). Emails always point at production, so they use
 * {@link BRAND_PHONE_DISPLAY}, which a test pins to that env var's registry default.
 *
 * @module brand-contact
 */

/**
 * Hospeda's own social profiles that do not depend on env, in render order.
 * WhatsApp is not here: its URL derives from the configured brand phone.
 */
export const BRAND_SOCIAL_PROFILES = [
    { platform: 'facebook', url: 'https://www.facebook.com/hospeda.com.ar' },
    { platform: 'instagram', url: 'https://www.instagram.com/hospeda.com.ar' },
    { platform: 'x', url: 'https://x.com/HospedaLitoral' },
    { platform: 'youtube', url: 'https://www.youtube.com/@hospeda.com.ar' }
] as const;

/** A platform of {@link BRAND_SOCIAL_PROFILES}. */
export type BrandSocialPlatform = (typeof BRAND_SOCIAL_PROFILES)[number]['platform'];

/** Public contact email of the brand. */
export const BRAND_CONTACT_EMAIL = 'info@hospeda.com.ar';

/**
 * Production brand phone in call/display form, WITHOUT the AR mobile `9`.
 * Equal to the registry default of `HOSPEDA_BRAND_PHONE` (pinned by a test).
 */
export const BRAND_PHONE_DISPLAY = '+54 3442 470650';

/** Argentina's country calling code: the only prefix a mobile `9` is inserted after. */
const AR_COUNTRY_CODE = '54';

/**
 * Digits of a brand phone in the form WhatsApp needs: no `+`, no spaces, and the AR
 * mobile `9` inserted after `54` when missing. The ONE implementation of that rule:
 * `apps/web/src/lib/brand-phone.ts` and {@link buildBrandWhatsAppUrl} both call it.
 *
 * @param input - The phone in call/display form, e.g. `'+54 3442 470650'`.
 * @returns The digits, e.g. `'5493442470650'`.
 */
export function toBrandWhatsAppDigits(input: { readonly phone: string }): string {
    const digits = input.phone.replace(/\D/g, '');
    return digits.startsWith(AR_COUNTRY_CODE) && !digits.startsWith(`${AR_COUNTRY_CODE}9`)
        ? `${AR_COUNTRY_CODE}9${digits.slice(AR_COUNTRY_CODE.length)}`
        : digits;
}

/**
 * Builds the `wa.me` link of a brand phone in call/display form (see
 * {@link toBrandWhatsAppDigits} for the mobile `9` rule).
 *
 * @param input - The phone, e.g. `'+54 3442 470650'`.
 * @returns The `wa.me` URL, e.g. `'https://wa.me/5493442470650'`.
 *
 * @example
 * ```ts
 * buildBrandWhatsAppUrl({ phone: BRAND_PHONE_DISPLAY }); // 'https://wa.me/5493442470650'
 * ```
 */
export function buildBrandWhatsAppUrl(input: { readonly phone: string }): string {
    return `https://wa.me/${toBrandWhatsAppDigits(input)}`;
}

/** `wa.me` link of the production brand phone. */
export const BRAND_WHATSAPP_URL = buildBrandWhatsAppUrl({ phone: BRAND_PHONE_DISPLAY });
