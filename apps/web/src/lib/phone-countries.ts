/**
 * @file phone-countries.ts
 * @description Curated country list for the phone country-code selector in
 * the accommodation contact editor (BETA-139). Product decision: no phone
 * library dependency — a small, hand-picked dataset covering the
 * Argentina / Litoral market plus common international codes is enough for
 * a host onboarding form; it is not meant to be an exhaustive ITU country
 * list.
 */

/** A single selectable country entry for the phone country-code control. */
export interface PhoneCountry {
    /** ISO 3166-1 alpha-2 country code. */
    readonly iso: string;
    /** E.164 dial code, including the leading `+` (e.g. `'+54'`). */
    readonly dialCode: string;
    /**
     * Display name in Spanish.
     *
     * Stored inline rather than as an i18n key: this is a short (~25 entries),
     * rarely-changing reference dataset — not paragraph-level UI copy — and
     * `es` is already the app's default/primary locale, with `en`/`pt`
     * falling back to `es` strings project-wide until translated. Adding 25
     * country-name keys x 3 locales for a value a host picks once during
     * onboarding isn't worth the i18n upkeep. If localized country names
     * become a real requirement, promote `name` to an i18n key at that point.
     */
    readonly name: string;
}

/**
 * Curated list of ~25 countries, ordered by relevance to the Argentina /
 * Litoral region market: Argentina first (default), then bordering
 * countries, then common international dial codes.
 */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
    { iso: 'AR', dialCode: '+54', name: 'Argentina' },
    { iso: 'UY', dialCode: '+598', name: 'Uruguay' },
    { iso: 'BR', dialCode: '+55', name: 'Brasil' },
    { iso: 'CL', dialCode: '+56', name: 'Chile' },
    { iso: 'PY', dialCode: '+595', name: 'Paraguay' },
    { iso: 'BO', dialCode: '+591', name: 'Bolivia' },
    { iso: 'PE', dialCode: '+51', name: 'Perú' },
    { iso: 'CO', dialCode: '+57', name: 'Colombia' },
    { iso: 'EC', dialCode: '+593', name: 'Ecuador' },
    { iso: 'VE', dialCode: '+58', name: 'Venezuela' },
    { iso: 'MX', dialCode: '+52', name: 'México' },
    { iso: 'US', dialCode: '+1', name: 'Estados Unidos' },
    { iso: 'CA', dialCode: '+1', name: 'Canadá' },
    { iso: 'ES', dialCode: '+34', name: 'España' },
    { iso: 'IT', dialCode: '+39', name: 'Italia' },
    { iso: 'FR', dialCode: '+33', name: 'Francia' },
    { iso: 'DE', dialCode: '+49', name: 'Alemania' },
    { iso: 'GB', dialCode: '+44', name: 'Reino Unido' },
    { iso: 'PT', dialCode: '+351', name: 'Portugal' },
    { iso: 'NL', dialCode: '+31', name: 'Países Bajos' },
    { iso: 'CH', dialCode: '+41', name: 'Suiza' },
    { iso: 'CN', dialCode: '+86', name: 'China' },
    { iso: 'JP', dialCode: '+81', name: 'Japón' },
    { iso: 'IL', dialCode: '+972', name: 'Israel' },
    { iso: 'AU', dialCode: '+61', name: 'Australia' }
] as const;

/** Default country used when no dial code can be resolved from stored data. */
export const DEFAULT_PHONE_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0] as PhoneCountry;

/**
 * Formats a country's datalist option label as `"<name> (<dialCode>)"`
 * (e.g. `"Argentina (+54)"`). Used both to render `<option>` values and to
 * resolve a typed/selected label back to a {@link PhoneCountry}.
 * @param country - The country to format.
 * @returns The formatted label string.
 */
export function formatPhoneCountryLabel(country: PhoneCountry): string {
    return `${country.name} (${country.dialCode})`;
}

/**
 * Converts an ISO 3166-1 alpha-2 country code into its flag emoji by mapping
 * each letter to a Unicode regional-indicator symbol (e.g. `'AR'` -> 🇦🇷).
 *
 * Rendering caveat: regional-indicator flag emoji render as an actual flag on
 * Linux, macOS, iOS, and Android. Windows desktop (as of Windows 11) has no
 * built-in flag glyphs for this range and falls back to showing the two
 * plain letters side by side — an acceptable degradation since the ISO code
 * is still meaningful, not garbled or invisible. Revisit with SVG flag
 * assets later if that fallback proves unacceptable.
 * @param iso - ISO 3166-1 alpha-2 country code (case-insensitive).
 * @returns The two-codepoint flag emoji string for `iso`.
 */
export function flagEmoji(iso: string): string {
    return iso
        .toUpperCase()
        .replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

/**
 * Finds a country by its exact datalist option label
 * (see {@link formatPhoneCountryLabel}).
 * @param label - The full label the user typed or selected.
 * @returns The matching {@link PhoneCountry}, or `undefined` if no exact match.
 */
export function findPhoneCountryByLabel(label: string): PhoneCountry | undefined {
    return PHONE_COUNTRIES.find((country) => formatPhoneCountryLabel(country) === label);
}

/** Result of splitting a stored `phone` string into country + local number. */
export interface ParsedPhoneValue {
    readonly country: PhoneCountry;
    readonly number: string;
}

/**
 * Parses a stored `phone` string (e.g. `"+54 9 343 1234567"`) into its
 * country + local-number parts.
 *
 * Robust by design: an empty/undefined/null value returns the default
 * country with an empty number, and a value whose prefix doesn't match any
 * known dial code falls back to the default country with the FULL raw value
 * kept as the number — so an unrecognized existing value is never dropped,
 * only left unsplit.
 * @param phone - The raw stored phone value, possibly empty/undefined/null.
 * @returns The resolved {@link ParsedPhoneValue}.
 */
export function parsePhoneValue(phone: string | undefined | null): ParsedPhoneValue {
    const raw = (phone ?? '').trim();
    if (!raw) {
        return { country: DEFAULT_PHONE_COUNTRY, number: '' };
    }

    // Longest dial code first so no shorter code can shadow a longer one
    // that starts with the same digits (defensive; no such collision exists
    // in the current curated list, but this keeps the function correct if
    // the list grows).
    const byDialCodeLengthDesc = [...PHONE_COUNTRIES].sort(
        (a, b) => b.dialCode.length - a.dialCode.length
    );
    const match = byDialCodeLengthDesc.find((country) => raw.startsWith(country.dialCode));

    if (!match) {
        return { country: DEFAULT_PHONE_COUNTRY, number: raw };
    }

    return { country: match, number: raw.slice(match.dialCode.length).trim() };
}

/**
 * Composes a stored `phone` string from a country + local number.
 * @param params - The country and local number to combine.
 * @returns `"<dialCode> <number>"`, or an empty string if `number` is blank
 * (no bare dial code is ever saved).
 */
export function composePhoneValue(params: {
    readonly country: PhoneCountry;
    readonly number: string;
}): string {
    const trimmedNumber = params.number.trim();
    if (!trimmedNumber) {
        return '';
    }
    return `${params.country.dialCode} ${trimmedNumber}`;
}
