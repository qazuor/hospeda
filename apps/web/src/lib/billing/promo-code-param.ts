/**
 * @file promo-code-param.ts
 * @description Normalizes the promo code carried by a redeem link (HOS-1171).
 *
 * The code arrives from a URL the sender typed by hand — a path segment on
 * `/mi-cuenta/canjear/<CODE>/` or a `?codigo=` on the sibling route — so it is
 * attacker-controlled text that ends up as the `value` of a React input.
 * Rejecting anything that is not code-shaped means the field is either empty or
 * pre-filled with something the customer could plausibly have typed themselves,
 * never with a sentence pushed in through a link.
 *
 * Rejection is silent and yields `undefined`: the page still renders with an
 * empty field, which is a better landing for a mistyped link than an error.
 */

/**
 * The shape a promo code can have. Codes are stored uppercase
 * (`getPromoCodeByCode` normalizes with `toUpperCase()`), and every code in the
 * catalogue is letters, digits, `-` or `_`.
 */
const PROMO_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Longest value accepted. Comfortably above any code in the catalogue and low
 * enough that a long string cannot be smuggled into the field through a link.
 * A genuinely longer code would be refused by `/validate` anyway — this only
 * decides whether the field is pre-filled.
 */
const MAX_PROMO_CODE_LENGTH = 50;

/**
 * Turns a raw URL-supplied value into a code safe to pre-fill a field with.
 *
 * @param raw - The path segment or query value, possibly `null`.
 * @returns The uppercased code, or `undefined` when the value is absent, empty,
 *   over-long, or contains anything outside `[A-Za-z0-9_-]`.
 *
 * @example
 * ```ts
 * normalizePromoCodeParam('lanzamiento60'); // 'LANZAMIENTO60'
 * normalizePromoCodeParam('hola mundo');    // undefined
 * normalizePromoCodeParam(null);            // undefined
 * ```
 */
export function normalizePromoCodeParam(raw: string | null | undefined): string | undefined {
    if (raw === null || raw === undefined) return undefined;

    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_PROMO_CODE_LENGTH) return undefined;
    if (!PROMO_CODE_PATTERN.test(trimmed)) return undefined;

    return trimmed.toUpperCase();
}
