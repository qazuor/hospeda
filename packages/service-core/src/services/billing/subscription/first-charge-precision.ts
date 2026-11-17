/**
 * Floors a first-charge instant to Mercado Pago's measured whole-second precision.
 * HOS-2218 / RP17 (EX-60): MP stores `start_date` without milliseconds.
 */
export function floorToWholeSecond(input: { readonly at: Date }): { readonly at: Date } {
    return { at: new Date(Math.floor(input.at.getTime() / 1000) * 1000) };
}
