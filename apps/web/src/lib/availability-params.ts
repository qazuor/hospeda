/**
 * Availability (`checkIn` / `checkOut`) query-parameter handling for the
 * accommodation listing surfaces.
 *
 * ## Why this exists (H-120)
 *
 * The listing page read `checkIn`/`checkOut` from the URL, echoed them into the
 * sidebar, and forwarded them to the detail link — but never passed them to
 * `accommodationsApi.list`. The backend filter was fully built and verified
 * (`buildOccupancyAvailabilityClause`, a correlated `NOT EXISTS` over
 * `accommodation_occupancy`); the only missing piece was the wire between the
 * two.
 *
 * That made the page worse than not offering the feature: a visitor picked
 * dates, saw the interface accept them, and got unfiltered results with no
 * indication the filter had not applied. On the other side, a host who blocked
 * dates was promised their listing would stop appearing for those days, and it
 * kept appearing.
 *
 * ## The both-or-neither rule
 *
 * The model ignores a lone `checkIn` or `checkOut` — deliberately, for
 * back-compat with pre-HOS-43 callers — and does so **silently**. Sending only
 * one is therefore indistinguishable from sending none, which is exactly the
 * kind of quiet discard this fix exists to remove. Three separate pages consume
 * these params, so the rule lives here once instead of being re-derived (and
 * eventually mis-derived) in each.
 *
 * @module lib/availability-params
 */

/** A validated, complete availability range ready to send to the API. */
export interface AvailabilityParams {
    /** First night of the stay, `YYYY-MM-DD`. */
    readonly checkIn: string;
    /** Checkout day, `YYYY-MM-DD`. Excluded from the blocked range. */
    readonly checkOut: string;
}

/** `YYYY-MM-DD`, the shape both the URL and the API use. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds the availability params to spread into an `accommodationsApi.list`
 * call, or an empty object when the pair is unusable.
 *
 * Returns nothing unless BOTH dates are present, well-formed, and describe a
 * stay of at least one night. A half-filled or inverted range yields `{}` so
 * the request carries no availability filter at all, rather than one the server
 * would drop on the floor.
 *
 * @param input.checkIn - Raw `checkIn` from the URL, if any.
 * @param input.checkOut - Raw `checkOut` from the URL, if any.
 * @returns `{ checkIn, checkOut }` when the pair is usable, otherwise `{}`.
 *
 * @example
 * ```ts
 * const params = { types, minGuests, ...buildAvailabilityParams({ checkIn, checkOut }) };
 * ```
 */
export function buildAvailabilityParams(input: {
    checkIn?: string | null;
    checkOut?: string | null;
}): AvailabilityParams | Record<string, never> {
    const checkIn = input.checkIn?.trim();
    const checkOut = input.checkOut?.trim();

    if (!checkIn || !checkOut) {
        return {};
    }
    if (!ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) {
        return {};
    }
    // A zero- or negative-length stay filters nothing on the server (the range
    // is half-open) and signals a bad URL — drop it rather than send it.
    if (checkOut <= checkIn) {
        return {};
    }

    return { checkIn, checkOut };
}
