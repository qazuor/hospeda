/**
 * Courtesy field accessor (HOS-180; moved to typed columns by HOS-993)
 *
 * The three fields a courtesy window needs — when it starts, when it ends, and
 * how many cycles were gifted — are read and written **only** through this
 * module. Nothing else in the codebase names their columns.
 *
 * ## Where they live
 *
 * `billing_subscriptions` is not defined by Hospeda: it comes from
 * `@qazuor/qzpay-drizzle`. The three fields are typed columns there as of
 * 2.1.0 — `courtesy_starts_at`, `courtesy_ends_at`, `courtesy_cycles_granted` —
 * the same promotion `product_domain` (HOS-73) and
 * `promo_effect_remaining_cycles` went through. Until that release they were
 * kept inside the `metadata` jsonb, which is the reason this module was written
 * in the first place.
 *
 * ## Why the indirection stays after the move
 *
 * The storage changed; the reason for one accessor did not. Billing has twice
 * grown a canonical helper and left call sites behind
 * (`normalizeStoredSubscriptionStatus`, `isEntitlementGrantingStatus`), which is
 * how two endpoints ended up disagreeing about the same subscription. One
 * function reads the window, one writes it, one clears it.
 *
 * ## The invariant this module protects
 *
 * A window that cannot be read in full is **absent**, never live. That is not
 * tidiness: `deriveCourtesyStatus` compares with `>`, and a comparison against
 * an `Invalid Date` is silently false — which reads as "the gift lapsed" and
 * cuts a subscriber off mid-gift with no error anywhere. Reading garbage as a
 * live gift is the opposite failure and hands out free entitlements. Treating
 * anything unreadable as "never gifted" avoids both.
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

/**
 * The shape {@link readCourtesyFields} looks for. Exported as documentation of
 * what a caller should be handing over; the reader itself takes `unknown` — see
 * why there.
 */
export interface CourtesyFieldsSource {
    readonly courtesyStartsAt?: unknown;
    readonly courtesyEndsAt?: unknown;
    readonly courtesyCyclesGranted?: unknown;
}

/** A courtesy window with nothing in it. */
const EMPTY: CourtesyFields = {
    courtesyStartsAt: null,
    courtesyEndsAt: null,
    courtesyCyclesGranted: null
};

/**
 * Parses a stored value into a `Date`, returning `null` for anything that is
 * not a usable timestamp.
 *
 * A `timestamptz` column arrives as a `Date`, so the first branch is the common
 * path. The string and number branches stay because the same window is also
 * read off objects that never went through Drizzle — a decoded JSON payload, a
 * test fixture — and because an unparseable value must yield `null` rather than
 * an `Invalid Date`: see the module note on why a silently false comparison is
 * the dangerous outcome.
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
 * Reads the courtesy window off a subscription row.
 *
 * Total and fail-safe: any shape that is not a readable window — absent,
 * malformed, half-written — yields an empty window, which every consumer reads
 * as "this subscription was never gifted anything". That is the correct
 * fallback: a subscription with no gift is the overwhelmingly common case, and
 * mistaking garbage for a live gift would grant free entitlements.
 *
 * ## Why the parameter is `unknown` and not {@link CourtesyFieldsSource}
 *
 * Some callers hold a `billing_subscriptions` row typed by Drizzle, which
 * declares all three columns. Others hold a `QZPaySubscriptionWithHelpers` from
 * the qzpay-core facade, whose type declares NEITHER — core is storage-agnostic
 * and knows nothing about columns qzpay-drizzle adds. The columns are on the
 * object at runtime either way; only the static type differs.
 *
 * Against an all-optional parameter type TypeScript rejects the second caller
 * outright (TS2559, "no properties in common"), so a typed parameter would push
 * every such call site into a cast. `subscriptionMatchesDomain` reads
 * `productDomain` off the same facade objects and resolved this the same way,
 * for the same reason. The runtime checks below are what make it safe: this
 * function is total, and anything unreadable yields an empty window.
 *
 * @param row - The subscription row, or anything carrying the three columns.
 * @returns The parsed window; all-`null` when there is none.
 *
 * @example
 * ```ts
 * const { courtesyEndsAt } = readCourtesyFields(subscription);
 * const status = deriveCourtesyStatus({ mappedStatus, courtesyEndsAt, now });
 * ```
 */
export function readCourtesyFields(row: unknown): CourtesyFields {
    if (!row || typeof row !== 'object') {
        return EMPTY;
    }
    const source = row as CourtesyFieldsSource;
    return {
        courtesyStartsAt: toDate(source.courtesyStartsAt),
        courtesyEndsAt: toDate(source.courtesyEndsAt),
        courtesyCyclesGranted: toCycles(source.courtesyCyclesGranted)
    };
}

/**
 * Returns the column patch that writes the given window, for spreading into a
 * Drizzle `.set()`.
 *
 * All three columns are named on every write, never only the ones that changed:
 * a `.set()` that moves the end date and leaves a stale start behind produces
 * exactly the half-written record {@link readCourtesyFields} then has to throw
 * away.
 *
 * @param fields - The window to write.
 * @returns A patch naming all three columns.
 *
 * @example
 * ```ts
 * await db.update(billingSubscriptions)
 *     .set({ status: SubscriptionStatusEnum.COURTESY, ...writeCourtesyFields(window) })
 *     .where(eq(billingSubscriptions.id, id));
 * ```
 */
export function writeCourtesyFields(fields: CourtesyFields): CourtesyFields {
    return {
        courtesyStartsAt: fields.courtesyStartsAt,
        courtesyEndsAt: fields.courtesyEndsAt,
        courtesyCyclesGranted: fields.courtesyCyclesGranted
    };
}

/**
 * Returns the column patch that removes the courtesy window, for spreading into
 * a Drizzle `.set()`.
 *
 * All three columns go to `NULL`. On the jsonb-backed implementation this had
 * to DELETE the keys rather than null them, because a lapsed window left
 * lingering is what would make a later, unrelated pause derive as a courtesy
 * and hand out free entitlements. A nullable column has no such distinction:
 * `NULL` **is** absence, and {@link readCourtesyFields} reads it as an empty
 * window. The hazard is closed by the storage now, not by this function.
 *
 * @returns A patch nulling all three columns.
 */
export function clearCourtesyFields(): CourtesyFields {
    return EMPTY;
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
