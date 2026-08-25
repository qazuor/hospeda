/**
 * @file price-units.ts
 * @description The single place where the experience `priceFrom` field crosses
 * between the unit the OWNER types and the unit the database stores (HOS-809).
 *
 * `experiences.price_from` is an integer amount of CENTAVOS — the repo-wide
 * money convention (see the dependency policy table: "Money → integer
 * (centavos)"), and what `ExperiencePriceTag.astro` divides by 100 to render
 * "Desde $ 3.500". That unit is correct and stays; nothing here changes it.
 *
 * What was wrong is that the two owner-facing forms handed the raw field value
 * to the API untouched, so a label reading "Precio desde (centavos)" was the
 * only thing standing between an owner and publishing a price a hundred times
 * lower than intended — `15000` typed as pesos became `$ 150` on the public
 * card. Both forms now speak PESOS and convert here, at one boundary, in both
 * directions.
 *
 * Kept as its own module rather than inlined in each form so the round trip
 * (peso → centavo → peso) is a property of ONE pair of functions that can be
 * tested directly. Two hand-rolled copies is exactly how one side of a
 * conversion ends up missing: a form that multiplies on save but forgets to
 * divide on load multiplies the stored price by 100 on every save.
 *
 * ## Whole pesos, deliberately
 *
 * `parsePesosInputToCents` floors to whole pesos before converting, matching
 * what these number inputs already accepted (`step={1}` + `Math.floor`) and
 * what the public price tag renders (`maximumFractionDigits: 0`). Partial
 * centavos were not enterable before this change and are not enterable after
 * it, so no owner sees a field narrow in a way it was not already.
 *
 * A legacy row whose stored value is NOT a multiple of 100 still displays
 * exactly — `centsToPesosInputValue` never rounds, because showing an owner a
 * price they did not store is worse than showing a decimal in a whole-number
 * field. Both forms set `noValidate`, so a fractional value in a `step={1}`
 * input cannot block a save.
 *
 * @module lib/commerce/price-units
 */

/** How many centavos make one peso. */
const CENTS_PER_PESO = 100;

/**
 * Converts a stored centavo amount into the value a pesos input should show.
 *
 * @param params - The stored amount in integer centavos, or `null` when unset.
 * @returns The amount in pesos, or `''` when there is no price to show — the
 *          empty string is what keeps a controlled `<input type="number">` from
 *          rendering `0` for an absent price.
 */
export function centsToPesosInputValue({ cents }: { readonly cents: number | null }): number | '' {
    if (cents === null || !Number.isFinite(cents)) return '';
    return cents / CENTS_PER_PESO;
}

/**
 * Converts what an owner typed in a pesos field into integer centavos.
 *
 * @param params - The raw `input.value` string, exactly as the DOM reports it.
 * @returns The amount in integer centavos, or `null` when the field is empty or
 *          holds something that is not a number. `null` — never `0` — because
 *          `Number('')` is `0` and a cleared field must not read as a free
 *          experience.
 */
export function parsePesosInputToCents({ raw }: { readonly raw: string }): number | null {
    if (raw.trim() === '') return null;
    const pesos = Number(raw);
    if (!Number.isFinite(pesos)) return null;
    // `Math.round` after the multiplication, not before: `Math.floor(15.7) * 100`
    // and `Math.round(15.7 * 100)` differ, and floating-point multiplication of
    // an already-whole peso amount can land a hair under the integer (0.29 * 100
    // is 28.999999999999996).
    return Math.round(Math.floor(pesos) * CENTS_PER_PESO);
}
