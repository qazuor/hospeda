/**
 * Price-on-request write rule for experiences (HOS-1943).
 *
 * Owner decision (01/11, option a): an experience "a consultar"
 * (`isPriceOnRequest = true`) stores `priceFrom = NULL`, never 0. A 0 read as
 * "$0" anywhere the flag was not checked first, and sorted as the cheapest
 * listing.
 *
 * The create schemas already ALLOW a null price for an on-request listing, but
 * nothing upstream forces one: the admin form can submit a number with the flag
 * on, and a partial update can send a price for a listing that is already on
 * request. This rule closes both at the single write chokepoint, so the row
 * never holds a price the flag hides.
 *
 * Pure function, no I/O: the caller supplies the row before the write (the base
 * listing service already loads it into `hookState.ownerActBefore`).
 */

/** Input to {@link resolveOnRequestPricePatch}. */
export interface ResolveOnRequestPricePatchInput {
    /** The write payload (create or partial update). */
    readonly data: Readonly<Record<string, unknown>>;
    /**
     * The stored row before the write, for updates. `null`/`undefined` on a
     * create, or when the row could not be loaded.
     */
    readonly current?: Readonly<Record<string, unknown>> | null;
}

/** Output of {@link resolveOnRequestPricePatch}. */
export interface ResolveOnRequestPricePatchOutput {
    /** Fields to merge over the payload; empty when nothing must change. */
    readonly patch: { readonly priceFrom?: null };
    /**
     * `true` when the write would leave the listing NOT on request with a NULL
     * price: nobody chose "Consultar precio", yet every display would show it.
     * The caller must reject the write (VALIDATION_ERROR).
     */
    readonly missingPrice: boolean;
}

/**
 * Decides whether a write must store `priceFrom = null`.
 *
 * The listing is on request after the write when the payload sets the flag, or
 * when the payload does not mention it and the stored row already has it on.
 * In that case the patch nulls `priceFrom`, whether the payload carried a price
 * or not:
 * - payload turns the flag ON → any stored price is cleared with it;
 * - payload sends a price for a listing that stays on request → dropped.
 *
 * The opposite case is a hole, not a patch: a write that leaves the listing
 * NOT on request with a NULL price (`priceFrom: null` with the flag off, or the
 * flag turned off on an on-request row without sending a price). That is
 * reported as `missingPrice` so the caller rejects it. The resulting price is
 * the payload's when it carries one, else the stored row's; when neither is
 * known (no row loaded, no price in the payload) nothing is claimed.
 *
 * A payload that does not touch pricing at all (`priceFrom` and
 * `isPriceOnRequest` both absent) yields no patch and no violation, so an
 * unrelated edit never rewrites or blocks on the column.
 *
 * @param input - The write payload and, for updates, the row before it.
 * @returns The patch to merge and whether the write leaves a priced listing without a price.
 */
export function resolveOnRequestPricePatch({
    data,
    current
}: ResolveOnRequestPricePatchInput): ResolveOnRequestPricePatchOutput {
    const touchesFlag = Object.hasOwn(data, 'isPriceOnRequest');
    const touchesPrice = Object.hasOwn(data, 'priceFrom');
    if (!touchesFlag && !touchesPrice) {
        return { patch: {}, missingPrice: false };
    }

    const onRequestAfterWrite = touchesFlag
        ? data.isPriceOnRequest === true
        : current?.isPriceOnRequest === true;

    if (onRequestAfterWrite) {
        return { patch: { priceFrom: null }, missingPrice: false };
    }

    const priceAfterWrite = touchesPrice ? data.priceFrom : current?.priceFrom;
    return { patch: {}, missingPrice: priceAfterWrite === null };
}
