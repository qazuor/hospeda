/**
 * Canonical contract for the metadata an add-on checkout carries across the
 * asynchronous payment confirmation.
 *
 * ## Why this module exists (HOS-721)
 *
 * `createAddonCheckout` stamps the target accommodation, the promo code and the
 * discount into the MercadoPago checkout metadata. `confirmAddonPurchase` reads
 * them back, minutes later, from whichever payload actually confirms the
 * purchase. Those two ends disagreed on how the keys are spelled:
 *
 * - the checkout writes the promo keys in **snake_case**
 *   (`promo_code_id`, `promo_code`, `discount_amount`), because MercadoPago
 *   normalizes preference metadata keys to snake_case when it copies them onto
 *   the payment object — so snake_case is the only spelling that survives the
 *   provider round-trip;
 * - the confirmation reads them in **camelCase**
 *   (`promoCodeId`, `promoCode`, `discountAmount`), because that is the
 *   convention of every other object in the codebase.
 *
 * The result was silent: the add-on confirmed, the customer was charged the
 * discounted price, and the promo code's redemption was never recorded — its
 * `used_count` stayed where it was and its usage cap never moved.
 *
 * ## The convention
 *
 * **camelCase is canonical.** snake_case is a wire format, not a second
 * convention: it exists only between `createAddonCheckout` and whatever
 * MercadoPago hands back, and it is translated away exactly once, here, at the
 * border. Nothing downstream of {@link normalizeAddonCheckoutMetadata} should
 * ever look up a snake_case key again — the alternative (each consumer reading
 * both spellings defensively) is how the two ends drifted apart in the first
 * place, and it scales with the number of readers instead of the number of
 * borders.
 *
 * @module services/addon-checkout-metadata
 */

/**
 * The add-on checkout payload, in the canonical camelCase convention.
 *
 * Every field is optional because each one describes an optional aspect of the
 * purchase: only a `requiresAccommodationTarget` add-on carries an
 * accommodation, and only a discounted purchase carries a promo code.
 *
 * This deliberately does NOT include `addonSlug`/`customerId`: those two are
 * the *dispatch discriminator* that decides a payment is an add-on purchase at
 * all, and they are resolved by `extractAddonMetadata` before this payload is
 * ever read.
 */
export type AddonCheckoutMetadata = {
    /**
     * Target accommodation for a `requiresAccommodationTarget` add-on
     * (SPEC-309 / HOS-675). Drives the `featured_listing_addon_grants` write.
     */
    readonly accommodationId?: string;
    /** UUID of the redeemed `billing_promo_codes` row. */
    readonly promoCodeId?: string;
    /** Human-facing promo code as typed by the customer (logging only). */
    readonly promoCode?: string;
    /** Discount applied at checkout, in centavos. */
    readonly discountAmount?: number;
};

/**
 * The snake_case spelling MercadoPago delivers for each canonical key.
 *
 * Declared as a map rather than inline reads so the two spellings of a key can
 * never be added, renamed or removed independently of one another.
 */
const WIRE_KEY_BY_CANONICAL_KEY = {
    accommodationId: 'accommodation_id',
    promoCodeId: 'promo_code_id',
    promoCode: 'promo_code',
    discountAmount: 'discount_amount'
} as const satisfies Record<keyof AddonCheckoutMetadata, string>;

/**
 * Read one canonical key from a raw metadata bag, trying the camelCase spelling
 * first and falling back to the MercadoPago snake_case one.
 */
function readRawValue({
    meta,
    key
}: {
    readonly meta: Record<string, unknown>;
    readonly key: keyof AddonCheckoutMetadata;
}): unknown {
    const camelValue = meta[key];
    if (camelValue !== undefined && camelValue !== null) {
        return camelValue;
    }
    return meta[WIRE_KEY_BY_CANONICAL_KEY[key]];
}

/**
 * Coerce a metadata value to a non-empty string, or `undefined`.
 *
 * `createAddonCheckout` writes `null` (not `undefined`) when a key does not
 * apply, and MercadoPago echoes empty strings back for some fields, so both
 * have to read as absent.
 */
function toOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Coerce a metadata value to a finite number, or `undefined`.
 *
 * MercadoPago stringifies some metadata values on the round-trip, so a discount
 * written as `1500` can come back as `'1500'`. Both are accepted; anything else
 * (including `NaN`, `Infinity` and non-numeric strings) reads as absent.
 */
function toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return undefined;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/**
 * Translate a raw payment/polling metadata bag into the canonical camelCase
 * add-on checkout payload.
 *
 * This is the single place where the MercadoPago snake_case wire spelling is
 * read. It accepts either spelling for every key so that all three confirmation
 * carriers work unchanged:
 *
 * 1. a real `payment.updated` webhook, where MercadoPago has snake_cased the
 *    preference metadata;
 * 2. the polling fallback's synthetic payload, which is built from the polling
 *    job row and keeps the canonical camelCase spelling;
 * 3. a dead-letter / retry replay of either of the above.
 *
 * Absent, `null`, empty and malformed values are omitted from the result rather
 * than returned as `undefined` properties, so the returned object can be spread
 * straight into `confirmPurchase` under `exactOptionalPropertyTypes`.
 *
 * @param input - Receives the raw metadata bag from the payment payload.
 * @returns The canonical payload; an empty object when nothing usable is present.
 *
 * @example
 * ```ts
 * // A real MercadoPago payment object
 * normalizeAddonCheckoutMetadata({
 *   metadata: { promo_code_id: 'uuid-1', promo_code: 'SAVE10', discount_amount: 1500 }
 * });
 * // → { promoCodeId: 'uuid-1', promoCode: 'SAVE10', discountAmount: 1500 }
 * ```
 */
export function normalizeAddonCheckoutMetadata({
    metadata
}: {
    readonly metadata: unknown;
}): AddonCheckoutMetadata {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }

    const meta = metadata as Record<string, unknown>;

    const accommodationId = toOptionalString(readRawValue({ meta, key: 'accommodationId' }));
    const promoCodeId = toOptionalString(readRawValue({ meta, key: 'promoCodeId' }));
    const promoCode = toOptionalString(readRawValue({ meta, key: 'promoCode' }));
    const discountAmount = toOptionalNumber(readRawValue({ meta, key: 'discountAmount' }));

    return {
        ...(accommodationId === undefined ? {} : { accommodationId }),
        ...(promoCodeId === undefined ? {} : { promoCodeId }),
        ...(promoCode === undefined ? {} : { promoCode }),
        ...(discountAmount === undefined ? {} : { discountAmount })
    };
}
