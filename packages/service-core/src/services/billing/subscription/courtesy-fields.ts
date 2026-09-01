/**
 * Courtesy field storage accessor (HOS-180)
 *
 * The three fields a courtesy window needs — when it starts, when it ends, and
 * how many cycles were gifted — are read and written **only** through this
 * module. Nothing else in the codebase touches their storage.
 *
 * ## Why the indirection exists
 *
 * `billing_subscriptions` is not defined by Hospeda: it comes from
 * `@qazuor/qzpay-drizzle`, consumed from npm with no local override. Adding
 * typed columns there — the route `product_domain` (HOS-73) and
 * `promo_effect_remaining_cycles` took — requires publishing a new qzpay
 * release, and the five qzpay siblings ship in coordinated waves
 * (`pnpm-workspace.yaml`). That is an owner decision (spec §11, OQ-1), not an
 * implementation detail, so the feature must not block on it.
 *
 * The provisional backing is therefore the existing `metadata` jsonb column,
 * which needs no migration and no package release. Every other layer —
 * derivation, transitions, endpoint, cron, notifications, UI — is written
 * against the typed interface below and never sees a jsonb path, so moving to
 * real columns later changes **this file only**.
 *
 * The one cost worth stating: a jsonb path cannot be indexed the way a column
 * can, so the expiry cron's sweep is a scan. Irrelevant at the current
 * subscription volume, and precisely why this is provisional.
 *
 * @module services/billing/subscription/courtesy-fields
 */

/** The three fields describing a courtesy window. */
export interface CourtesyFields {
    /**
     * When the gift begins — the end of the period the subscriber already paid
     * for, NOT the instant it was granted (spec OQ-4). `null` when there is no
     * gift.
     */
    readonly courtesyStartsAt: Date | null;
    /** When the gift expires. `null` when there is no gift. */
    readonly courtesyEndsAt: Date | null;
    /** How many cycles were gifted, for display and audit. `null` when none. */
    readonly courtesyCyclesGranted: number | null;
}

/** A courtesy window with nothing in it. */
const EMPTY: CourtesyFields = {
    courtesyStartsAt: null,
    courtesyEndsAt: null,
    courtesyCyclesGranted: null
};

const STARTS_KEY = 'courtesyStartsAt';
const ENDS_KEY = 'courtesyEndsAt';
const CYCLES_KEY = 'courtesyCyclesGranted';

/**
 * Parses a stored value into a `Date`, returning `null` for anything that is
 * not a usable timestamp.
 *
 * jsonb round-trips a `Date` as an ISO string, so the stored shape is a string
 * even though the caller wrote a `Date`. An unparseable value yields `null`
 * rather than an `Invalid Date`: `deriveCourtesyStatus` compares with `>`,
 * and a NaN comparison is silently false — which would read as "the gift
 * lapsed" and cut a subscriber off mid-gift with no error anywhere.
 */
function toDate(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parses a stored value into a positive integer cycle count, or `null`.
 *
 * A zero or negative count is not a gift, so it reads as absent.
 */
function toCycles(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(n) || n <= 0) {
        return null;
    }
    return n;
}

/**
 * Reads the courtesy window out of a subscription's `metadata`.
 *
 * Total and fail-safe: any shape that is not a readable window — absent,
 * malformed, half-written — yields an empty window, which every consumer reads
 * as "this subscription was never gifted anything". That is the correct
 * fallback: a subscription with no gift is the overwhelmingly common case, and
 * mistaking garbage for a live gift would grant free entitlements.
 *
 * @param metadata - The raw `billing_subscriptions.metadata` value.
 * @returns The parsed window; all-`null` when there is none.
 *
 * @example
 * ```ts
 * const { courtesyEndsAt } = readCourtesyFields(subscription.metadata);
 * const status = deriveCourtesyStatus({ mappedStatus, courtesyEndsAt, now });
 * ```
 */
export function readCourtesyFields(metadata: unknown): CourtesyFields {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return EMPTY;
    }
    const record = metadata as Record<string, unknown>;
    return {
        courtesyStartsAt: toDate(record[STARTS_KEY]),
        courtesyEndsAt: toDate(record[ENDS_KEY]),
        courtesyCyclesGranted: toCycles(record[CYCLES_KEY])
    };
}

/**
 * Returns a new metadata object carrying the given courtesy window, preserving
 * every other key.
 *
 * Never mutates its input: `metadata` is read from a live row and may be shared.
 * Dates are stored as ISO strings, which is what jsonb round-trips anyway.
 *
 * @param args.metadata - The existing metadata value (any shape).
 * @param args.fields - The window to write.
 * @returns A new metadata object.
 */
export function writeCourtesyFields(args: {
    readonly metadata: unknown;
    readonly fields: CourtesyFields;
}): Record<string, unknown> {
    const { metadata, fields } = args;
    const base =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? { ...(metadata as Record<string, unknown>) }
            : {};

    return {
        ...base,
        [STARTS_KEY]: fields.courtesyStartsAt?.toISOString() ?? null,
        [ENDS_KEY]: fields.courtesyEndsAt?.toISOString() ?? null,
        [CYCLES_KEY]: fields.courtesyCyclesGranted
    };
}

/**
 * Returns a new metadata object with the courtesy window removed entirely.
 *
 * The keys are **deleted**, not set to `null`: a lapsed window that lingers is
 * exactly what would make a later, unrelated pause derive as a courtesy and
 * hand out free entitlements. Absence is unambiguous; a stale value is not.
 *
 * @param metadata - The existing metadata value (any shape).
 * @returns A new metadata object with no courtesy keys.
 */
export function clearCourtesyFields(metadata: unknown): Record<string, unknown> {
    const base =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? { ...(metadata as Record<string, unknown>) }
            : {};
    delete base[STARTS_KEY];
    delete base[ENDS_KEY];
    delete base[CYCLES_KEY];
    return base;
}

/**
 * Whether a parsed window represents a gift that is currently running.
 *
 * A window with no end date is not a gift — see {@link readCourtesyFields} on
 * why a half-written window must never read as live.
 *
 * @param args.fields - The parsed window.
 * @param args.now - Injected clock.
 */
export function isCourtesyWindowLive(args: {
    readonly fields: CourtesyFields;
    readonly now: Date;
}): boolean {
    const { fields, now } = args;
    return fields.courtesyEndsAt !== null && fields.courtesyEndsAt.getTime() > now.getTime();
}
