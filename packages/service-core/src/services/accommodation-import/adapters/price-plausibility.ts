/**
 * Per-night price plausibility guard shared by the OTA price-probe adapters
 * (Airbnb, Booking) — SPEC-258 price probe / BETA-169.
 *
 * The price probe asks the Apify actor for pricing in a REQUESTED currency
 * ({@link PRICE_PROBE_CURRENCY} = `'USD'`) and then stores that same currency
 * on the candidate field, ignoring whatever display symbol the actor echoes
 * back (the symbol is unreliable — `$` alone is ambiguous between USD, ARS,
 * and others). That is correct ONLY while the actor honours the requested
 * currency.
 *
 * **BETA-169**: some actors silently ignore the `currency` request and return
 * the host's LOCAL currency instead (e.g. an Argentine `airbnb.com.ar`
 * listing came back priced in ARS). The value is then stored labelled `USD`
 * while actually being ARS — an ~1000x overstatement (a real ~15.964 ARS/night
 * was surfaced as `15964.5 USD`, i.e. ~16 million ARS/night). Since the currency
 * cannot be verified from the actor response, the only safe signal we have is
 * MAGNITUDE: a per-night figure far above any realistic USD nightly rate almost
 * certainly means the actor returned local currency, not the requested USD.
 *
 * This guard therefore accepts a per-night value only inside a plausible USD
 * band and drops anything outside it. Dropping leaves the price field empty for
 * the host to fill in — strictly safer than pre-filling a value that is wrong by
 * a factor of ~1000 with a wrong currency label. This mirrors the pre-existing
 * sub-$1 floor guard's stated philosophy: under-resolve is safer than
 * mis-resolve.
 *
 * @module services/accommodation-import/adapters/price-plausibility
 */

/**
 * Minimum plausible per-night price (in the requested USD currency).
 * A sub-$1 per-night figure indicates a mis-parse or placeholder, never a real
 * listing rate, so it is dropped.
 */
export const PER_NIGHT_MIN_USD = 1;

/**
 * Maximum plausible per-night price (in the requested USD currency).
 *
 * Realistic Airbnb/Booking nightly USD rates for this market sit well under
 * this ceiling (cabañas, casas quinta, and hotels in the Litoral region are
 * tens to a few hundred USD/night; even luxury stays rarely approach it). A
 * per-night figure ABOVE this ceiling — given we explicitly REQUESTED USD —
 * almost certainly means the actor ignored the request and returned the host's
 * local currency (e.g. ARS, ~1000x USD), so the value is dropped rather than
 * pre-filled with a wrong currency label (BETA-169).
 *
 * The failure mode of a slightly-too-low ceiling (dropping a genuine
 * ultra-premium USD listing) is benign — the host simply enters the price
 * manually. The failure mode of NOT guarding (publishing an ~1000x-inflated
 * price in the wrong currency) is severe. The ceiling is deliberately biased
 * toward the safe side.
 */
export const PER_NIGHT_MAX_USD = 3000;

/**
 * Returns `true` when `perNight` is a finite value inside the plausible
 * `[PER_NIGHT_MIN_USD, PER_NIGHT_MAX_USD]` band for a per-night figure expressed
 * in the requested USD currency.
 *
 * @param perNight - Candidate per-night price (assumed to be in USD).
 * @returns `true` when the value is plausible USD/night; `false` to drop it.
 */
export function isPlausiblePerNightUsd(perNight: number): boolean {
    return (
        Number.isFinite(perNight) && perNight >= PER_NIGHT_MIN_USD && perNight <= PER_NIGHT_MAX_USD
    );
}
