/**
 * venue.night-info.ts
 *
 * Server-side rules for the venue `nightInfo` section (HOS-1846 / DEC-FAC-058).
 *
 * The section's writable fields are validated for SHAPE by the Zod input
 * schemas; the rules that depend on the STORED row are resolved here, in one
 * pure place, and called from `VenueService._beforeCreate` / `_beforeUpdate`:
 *
 * 1. **Price freshness.** `entryPriceUpdatedAt` moves only when the resulting
 *    `entryPriceFrom` differs from the stored one. Re-sending the same price
 *    must not claim a fresher date.
 * 2. **Leaving `paid`.** When the resulting `entryKind` is not `paid`, both
 *    `entryPriceFrom` and `entryPriceUpdatedAt` are erased even if the body
 *    omitted them — an entry with no cover charge keeps no price.
 * 3. **Deleting the price while still `paid`.** Setting `entryPriceFrom` to
 *    `null` also erases the date: the date describes the price, and without a
 *    price there is nothing to date (orchestration decision, HOS-1846 note 1).
 * 4. **Price without `paid`.** A non-null `entryPriceFrom` whose resulting
 *    `entryKind` is not `paid` is a 400 `VALIDATION_ERROR`. This is the rule
 *    that keeps the database CHECK (`venues_entry_price_requires_paid`) from
 *    surfacing as a 500.
 *
 * The helper never reads `businessLines`: whether the section is present is a
 * step-4b authorization decision (G-FAC-03), not a data rule.
 *
 * Read-only over its inputs: no I/O, no mutation, no clock of its own — the
 * caller passes `now`, so tests can pin the timestamp.
 */

import { ServiceErrorCode, type Venue } from '@repo/schemas';
import { ServiceError } from '../../types';

/**
 * The three `nightInfo` columns a request body may write (catalog `fields`).
 * Age and dress code also belong to the section, but they live in `policies`
 * since HOS-2060 (the catalog's `policyKeys`) and need no stored-row rule.
 */
export const VENUE_NIGHT_INFO_WRITABLE_FIELDS = [
    'entryKind',
    'entryNoteI18n',
    'entryPriceFrom'
] as const;

/** Fields the helper may return for persistence. */
export type VenueNightInfoPatch = Partial<
    Pick<Venue, 'entryKind' | 'entryNoteI18n' | 'entryPriceFrom' | 'entryPriceUpdatedAt'>
>;

/** Subset of the stored row the rules need (kept narrow so tests stay cheap). */
export type VenueNightInfoCurrent = Partial<
    Pick<Venue, 'entryKind' | 'entryPriceFrom' | 'entryPriceUpdatedAt'>
>;

/**
 * Resolves the `nightInfo` patch to persist for one create or update.
 *
 * Returns `{}` when the body does not mention any writable `nightInfo` field —
 * an unrelated edit must not rewrite this section's columns.
 *
 * @param args.body - Validated request body (create or update input).
 * @param args.current - Stored row for updates; `null`/omitted on create.
 * @param args.now - Clock instant to stamp when the price changes.
 * @returns Only the keys whose stored value must change.
 * @throws {ServiceError} `VALIDATION_ERROR` when a non-null price is sent while
 *   the resulting `entryKind` is not `paid`.
 */
export function resolveVenueNightInfoPatch(args: {
    readonly body: Record<string, unknown>;
    readonly current?: VenueNightInfoCurrent | null;
    readonly now: Date;
}): VenueNightInfoPatch {
    const { body, current = null, now } = args;
    const has = (field: string): boolean => Object.hasOwn(body, field);

    if (!VENUE_NIGHT_INFO_WRITABLE_FIELDS.some(has)) return {};

    // An explicit `entryKind: null` clears the kind: it must not fall back to
    // the stored value, or an orphaned `paid` price would survive the write.
    const bodyKind = has('entryKind')
        ? (body.entryKind as Venue['entryKind'] | null | undefined)
        : undefined;
    const entryKind = bodyKind === undefined ? (current?.entryKind ?? null) : bodyKind;
    const bodyPrice = has('entryPriceFrom')
        ? (body.entryPriceFrom as number | null | undefined)
        : undefined;
    const resultingPrice = bodyPrice === undefined ? (current?.entryPriceFrom ?? null) : bodyPrice;

    // Rule 4: an explicit price cannot coexist with a non-paid entry kind.
    if (bodyPrice != null && entryKind !== 'paid') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'entryPriceFrom is only valid when entryKind is paid'
        );
    }

    const patch: VenueNightInfoPatch = {};

    // Rules 2 and 3: no price survives unless the entry is `paid` with a value.
    if (entryKind !== 'paid' || resultingPrice === null) {
        if (resultingPrice !== null) patch.entryPriceFrom = null;
        else if (current?.entryPriceFrom != null) patch.entryPriceFrom = null;
        if (current?.entryPriceUpdatedAt != null) patch.entryPriceUpdatedAt = null;
        return patch;
    }

    // Paid with a price: persist an explicitly sent value, and move the date
    // only when the resulting value actually differs from the stored one.
    if (bodyPrice !== undefined && bodyPrice !== current?.entryPriceFrom) {
        patch.entryPriceFrom = bodyPrice;
    }
    const changed = current?.entryPriceFrom !== resultingPrice;
    if (changed) patch.entryPriceUpdatedAt = now;

    return patch;
}
