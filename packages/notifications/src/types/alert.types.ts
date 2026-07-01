/**
 * Types for the alerts & offers multichannel delivery abstraction (SPEC-286 T-008).
 *
 * These types are intentionally LOCAL to `@repo/notifications` — they are not
 * imported from `@repo/service-core` even though the evaluators that produce
 * this data live there (`PriceDropEvaluator`, `PromoOfferEvaluator`). Per the
 * SPEC-286 T-008 task text, re-declaring the shape here avoids a circular
 * dependency between `@repo/service-core` and `@repo/notifications`.
 *
 * @module types/alert.types
 */

/**
 * A single price-drop match produced by `PriceDropEvaluator.evaluatePriceDrops()`
 * in `@repo/service-core` (SPEC-286 T-006).
 *
 * NOTE: T-006 landed on this branch concurrently while T-008 was being
 * implemented (`packages/service-core/src/services/alert/price-drop-evaluator.service.ts`).
 * This shape is copied field-for-field (including exact types, e.g.
 * `currency: string | undefined`) from the real landed `PriceDropMatch`
 * export, not guessed from the task description. Re-declared locally instead
 * of imported to avoid a circular dependency between `@repo/service-core` and
 * `@repo/notifications` (per the T-008 task text). If `@repo/service-core`'s
 * `PriceDropMatch` changes again, re-diff and update this copy.
 */
export interface PriceDropMatch {
    /** ID of the `tourist_price_alerts` subscription that matched. */
    alertId: string;
    /** ID of the tourist who owns the alert subscription. */
    userId: string;
    /** ID of the accommodation whose price dropped. */
    accommodationId: string;
    /** Slug of the accommodation, used to build the CTA link. */
    accommodationSlug: string;
    /** Display name of the accommodation. */
    accommodationName: string;
    /** Price (in centavos) recorded at subscription time. */
    basePriceSnapshot: number;
    /** Current price (in centavos) at evaluation time. */
    currentPrice: number;
    /** Computed drop percentage (0-100), always positive when included. */
    dropPercent: number;
    /** Accommodation's price currency, when set. */
    currency: string | undefined;
}

/**
 * A single promo-offer match produced by `PromoOfferEvaluator.evaluatePromoOffers()`
 * in `@repo/service-core` (SPEC-286 T-012, not yet implemented at the time of
 * writing).
 */
export interface PromoOfferMatch {
    /** ID of the owner promotion that qualified. */
    promotionId: string;
    /** ID of the accommodation the promotion applies to. */
    accommodationId: string;
    /** Display name of the accommodation. */
    accommodationName: string;
    /** Slug of the accommodation, used to build the CTA link. */
    accommodationSlug: string;
    /** Title of the promotion, as configured by the owner. */
    promotionTitle: string;
    /** Kind of discount the promotion applies. */
    discountType: string;
    /** Discount value (percentage points or centavos, depending on `discountType`). */
    discountValue: number;
    /** Expiration date of the promotion, or `null` if it does not expire. */
    validUntil: Date | null;
}

/**
 * Combined digest payload for a single user's daily alerts email/notification.
 *
 * Delivered to every registered `NotificationChannel` (email today; WhatsApp
 * and push are future channels — see `alert-delivery.service.ts`).
 */
export interface AlertDigestPayload {
    /** ID of the tourist receiving the digest. */
    userId: string;
    /** Email address to deliver to (used by `EmailAlertChannel`). */
    userEmail: string;
    /** Locale used to render channel-specific content (e.g. "es", "en", "pt"). */
    locale: string;
    /** Price-drop matches for this user in the evaluation window. */
    priceDrop: PriceDropMatch[];
    /** Promo-offer matches for this user in the evaluation window. */
    promoOffers: PromoOfferMatch[];
}

/**
 * The set of trigger kinds that can produce an alert digest item.
 *
 * Exposed both as a readonly tuple (for runtime iteration/validation) and as
 * the derived literal union type `TriggerKind`.
 */
export const TRIGGER_KINDS = ['price_drop', 'promo_offer'] as const;

/**
 * Discriminates which evaluator produced a given digest item.
 */
export type TriggerKind = (typeof TRIGGER_KINDS)[number];
