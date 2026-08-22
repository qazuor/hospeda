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
 * border. Nothing downstream of {@link normalizeMercadoPagoMetadata} should
 * ever look up a snake_case key again — the alternative (each consumer reading
 * both spellings defensively) is how the two ends drifted apart in the first
 * place, and it scales with the number of readers instead of the number of
 * borders.
 *
 * ## The border is generic (HOS-743)
 *
 * HOS-721 translated only the four add-on checkout payload keys, which left the
 * three *dispatch discriminators* in `webhooks/mercadopago/utils.ts`
 * (`extractAddonMetadata`, `extractAnnualSubscriptionMetadata`,
 * `extractPlanChangeUpgradeMetadata`) reading camelCase off a payload
 * MercadoPago had already snake_cased. `extractAddonMetadata` is the grave one:
 * it decides whether an incoming payment IS an add-on purchase, so a key that
 * does not resolve means no dispatch at all — no error, no log, nothing. It
 * only worked because `createAddonCheckout` happens to write `addonSlug` and
 * `customerId` in BOTH spellings, a duplication that reads like redundancy and
 * would take the dispatch down with it the day somebody tidied it away.
 *
 * {@link normalizeMercadoPagoMetadata} is therefore the border for the whole
 * bag, not for a fixed list of keys, and every one of those extractors goes
 * through it. A new metadata key needs no registration and cannot regress to
 * camelCase-only reading.
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
 * Matches a well-formed lower snake_case key: alphanumeric groups joined by
 * single underscores, with at least one underscore.
 *
 * Deliberately strict. A key that is already canonical (`addonSlug`), a single
 * word (`type`), or malformed (`__weird`, `a__b`) is left alone rather than
 * given a speculative alias — the border only translates what MercadoPago's
 * own transformation could have produced.
 */
const WIRE_KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)+$/;

/**
 * Convert one MercadoPago wire key to its canonical camelCase spelling.
 *
 * The inverse of the transformation MercadoPago applies: `promo_code_id` →
 * `promoCodeId`.
 */
function toCanonicalKey(wireKey: string): string {
    return wireKey.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

/**
 * Translate a raw MercadoPago metadata bag into the canonical camelCase
 * convention. **This is the border.**
 *
 * ## Why this is one translation and not N defensive reads
 *
 * MercadoPago snake_cases preference metadata keys when it copies them onto the
 * payment object, so a real `payment.updated` payload spells every key
 * differently from the rest of the codebase. There are exactly two ways to
 * absorb that:
 *
 * 1. every consumer reads both spellings (`meta.addonSlug ?? meta.addon_slug`);
 * 2. the payload is translated once, on the way in, and every consumer reads
 *    the canonical spelling only.
 *
 * (1) scales with the number of READERS and drifts the moment one of them is
 * added without the fallback — which is precisely how HOS-675, HOS-721 and
 * HOS-743 each happened. (2) scales with the number of BORDERS, of which there
 * is one. This function is it.
 *
 * ## The rules
 *
 * - The translation is **mechanical**, not a registry of known keys. A hand-kept
 *   map reproduces the original bug for the next key somebody adds: it would be
 *   camelCase-only again, silently, until a payment failed to dispatch. Anything
 *   MercadoPago can snake_case, this can un-snake_case.
 * - It is **additive**. The original keys are preserved, so any reader still
 *   using a wire spelling keeps working; only the missing canonical aliases are
 *   filled in.
 * - **camelCase wins.** A canonical key that already carries a value is never
 *   overwritten by its wire twin. `null` and `undefined` do not count as values:
 *   `createAddonCheckout` writes `null` for a key that does not apply, and a
 *   null canonical key must not shadow a populated wire one.
 *
 * @param input - Receives the raw metadata bag from the payment payload.
 * @returns A new bag carrying both the original keys and their canonical
 *   aliases; an empty object when the input is not a plain object.
 *
 * @example
 * ```ts
 * normalizeMercadoPagoMetadata({
 *   metadata: { addon_slug: 'extra-photos-20', customer_id: 'cust_1' }
 * });
 * // → { addon_slug: '…', customer_id: '…', addonSlug: '…', customerId: '…' }
 * ```
 */
export function normalizeMercadoPagoMetadata({
    metadata
}: {
    readonly metadata: unknown;
}): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }

    const meta = metadata as Record<string, unknown>;
    const normalized: Record<string, unknown> = { ...meta };

    for (const [rawKey, value] of Object.entries(meta)) {
        if (!WIRE_KEY_PATTERN.test(rawKey)) {
            continue;
        }

        const canonicalKey = toCanonicalKey(rawKey);
        const existing = normalized[canonicalKey];

        if (existing === undefined || existing === null) {
            normalized[canonicalKey] = value;
        }
    }

    return normalized;
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
 * Matches a plain decimal number, optionally signed: `12345`, `-500`, `8999.99`.
 *
 * Deliberately narrower than `Number()`. A JSON round-trip of a JS number in the
 * range this codebase deals with (ARS prices, centavo counts) never produces
 * exponent notation, hex, `Infinity` or a trailing unit, so accepting those
 * shapes would only widen the surface for a malformed value to land as a
 * plausible amount. `parseFloat` is the trap this exists to avoid:
 * `parseFloat('12abc')` is `12`, which would read as a real amount.
 */
const PLAIN_DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * Coerce a MercadoPago metadata value to a finite number, or `undefined`.
 *
 * ## Why the value type needs a border too (HOS-743 follow-up)
 *
 * {@link normalizeMercadoPagoMetadata} translates the metadata *keys*
 * MercadoPago rewrites on the wire. It does not touch *values* — and the
 * provider stringifies numeric metadata on the round-trip, so an amount written
 * as `12345` can come back as `'12345'`. Every reader of a numeric metadata
 * field therefore has the same two-shape problem the keys had, and it is
 * absorbed the same way: once, here, rather than defensively in each reader.
 *
 * Fail-closed is the other half of the contract. A reader that used this to
 * accept anything coercible would forward `NaN` as a subscription's new
 * recurring amount, which is worse than dropping the payload. Only a finite
 * number or a plain-decimal string is an amount; `''`, `'  '`, `'abc'`,
 * `'12abc'`, `'1e5'`, `NaN`, `Infinity`, `null`, booleans and objects all read
 * as absent.
 *
 * @param input - Receives the raw metadata value, in either carrier shape.
 * @returns The finite number it denotes, or `undefined` when it denotes none.
 *
 * @example
 * ```ts
 * parseMetadataNumber({ value: 12345 });    // → 12345
 * parseMetadataNumber({ value: '12345' });  // → 12345 (the wire shape)
 * parseMetadataNumber({ value: '12abc' });  // → undefined
 * ```
 */
export function parseMetadataNumber({ value }: { readonly value: unknown }): number | undefined {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!PLAIN_DECIMAL_PATTERN.test(trimmed)) {
            return undefined;
        }
        // Still guarded: a digit string long enough to overflow a double parses
        // to Infinity, which the pattern alone cannot rule out.
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
    const meta = normalizeMercadoPagoMetadata({ metadata });

    const accommodationId = toOptionalString(meta.accommodationId);
    const promoCodeId = toOptionalString(meta.promoCodeId);
    const promoCode = toOptionalString(meta.promoCode);
    const discountAmount = parseMetadataNumber({ value: meta.discountAmount });

    return {
        ...(accommodationId === undefined ? {} : { accommodationId }),
        ...(promoCodeId === undefined ? {} : { promoCodeId }),
        ...(promoCode === undefined ? {} : { promoCode }),
        ...(discountAmount === undefined ? {} : { discountAmount })
    };
}
