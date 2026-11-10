/**
 * @file listing-policies-jsonld.ts
 * @description Derives the schema.org fields a listing's house rules can feed
 * (HOS-2060): `petsAllowed`, `checkinTime`, `checkoutTime`, `paymentAccepted`.
 *
 * Structured data fails quietly — a wrong value raises no error and renders
 * nowhere — so every rule here is unit-tested rather than computed inline in a
 * page. The rules follow the policies schema's "absent is not false" contract:
 * a key the owner never declared produces NO property, never a negative one.
 *
 * Which `@type` may carry which property is the caller's decision (schema.org:
 * `petsAllowed`/`checkinTime`/`checkoutTime` live on `LodgingBusiness`,
 * `paymentAccepted` on any `LocalBusiness`); this builder only computes values.
 */

import type { ListingPolicyValues } from '@/lib/listing/listing-policies';
import { paymentMethodLabel } from '@/lib/listing/listing-policies';

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/** The schema.org properties derived from a listing's policies. */
export interface ListingPolicyStructuredData {
    readonly petsAllowed?: boolean;
    readonly checkinTime?: string;
    readonly checkoutTime?: string;
    readonly paymentAccepted?: string;
}

/**
 * Builds the policy-derived schema.org properties.
 *
 * - `petsAllowed`: `yes`/`on_request` → `true`, `no` → `false`, absent → omitted.
 *   `on_request` counts as allowed, matching the public `allowsPets` filter.
 * - `checkinTime`: the earliest check-in (`checkIn.from`).
 * - `checkoutTime`: the latest check-out (`checkOut.to`).
 * - `paymentAccepted`: the localized method labels, comma-separated.
 *
 * @param params.policies - The listing's parsed policies.
 * @param params.t - Locale-bound translator for the payment labels.
 * @returns Only the properties that have a value.
 */
export function buildListingPolicyStructuredData({
    policies,
    t
}: {
    readonly policies: ListingPolicyValues;
    readonly t: Translate;
}): ListingPolicyStructuredData {
    const result: {
        petsAllowed?: boolean;
        checkinTime?: string;
        checkoutTime?: string;
        paymentAccepted?: string;
    } = {};

    if (policies.pets) {
        result.petsAllowed = policies.pets.admission !== 'no';
    }
    if (policies.checkIn?.from) {
        result.checkinTime = policies.checkIn.from;
    }
    if (policies.checkOut?.to) {
        result.checkoutTime = policies.checkOut.to;
    }
    if (policies.paymentMethods && policies.paymentMethods.length > 0) {
        result.paymentAccepted = policies.paymentMethods
            .map((method) => paymentMethodLabel({ t, method }))
            .join(', ');
    }

    return result;
}
