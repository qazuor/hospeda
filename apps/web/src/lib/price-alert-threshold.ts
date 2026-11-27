/**
 * @file price-alert-threshold.ts
 * @description Pure helpers for the price-alert dialog (HOS-2666, CARD-024).
 *
 * The API stores one integer, `targetPercentDrop` (1-100). The dialog lets the
 * user think either in percent or in a target price; these helpers convert
 * between the two in integer centavos so no floating-point drift decides what
 * the user is told.
 *
 * Rounding rule: when a target price is converted to a percentage, the
 * percentage is rounded DOWN. A smaller percentage triggers at a higher price,
 * so the user is never notified later than they asked.
 */

/** Smallest drop the API accepts (`CreatePriceAlertInputSchema`). */
export const MIN_PERCENT_DROP = 1;
/** Largest drop the API accepts (`CreatePriceAlertInputSchema`). */
export const MAX_PERCENT_DROP = 100;

/**
 * Convert a decimal currency amount (pesos) to integer centavos.
 *
 * @param params - `{ amount }`
 * @returns Integer centavos.
 */
export function toCentavos({ amount }: { readonly amount: number }): number {
    return Math.round(amount * 100);
}

/**
 * Price at or below which an alert with `percent` fires, in centavos, rounded
 * down to whole pesos so the shown price is never more generous than the rule.
 *
 * @param params - `{ currentCentavos, percent }`
 * @returns Threshold price in centavos (a multiple of 100).
 */
export function priceFromPercent({
    currentCentavos,
    percent
}: {
    readonly currentCentavos: number;
    readonly percent: number;
}): number {
    const exact = Math.floor((currentCentavos * (100 - percent)) / 100);
    return Math.floor(exact / 100) * 100;
}

/** Result of converting a target price into a percentage. */
export type PercentFromPriceResult =
    | { readonly ok: true; readonly percent: number; readonly thresholdCentavos: number }
    | {
          readonly ok: false;
          readonly reason: 'not_positive' | 'not_below_current' | 'too_close';
      };

/**
 * Convert a target price to the integer percentage to save, rounding DOWN.
 *
 * @param params - `{ currentCentavos, targetCentavos }`
 * @returns The percentage and the exact price it triggers at, or the reason
 *   the target is out of range.
 */
export function percentFromTargetPrice({
    currentCentavos,
    targetCentavos
}: {
    readonly currentCentavos: number;
    readonly targetCentavos: number;
}): PercentFromPriceResult {
    if (!Number.isFinite(targetCentavos) || targetCentavos <= 0) {
        return { ok: false, reason: 'not_positive' };
    }
    if (targetCentavos >= currentCentavos) return { ok: false, reason: 'not_below_current' };
    const percent = Math.floor(((currentCentavos - targetCentavos) * 100) / currentCentavos);
    if (percent < MIN_PERCENT_DROP) return { ok: false, reason: 'too_close' };
    return {
        ok: true,
        percent,
        thresholdCentavos: priceFromPercent({ currentCentavos, percent })
    };
}

/**
 * Parse the percentage input. Only integers inside the API bounds are valid.
 *
 * @param params - `{ raw }` text typed by the user.
 * @returns The percentage or `null` when invalid.
 */
export function parsePercentInput({ raw }: { readonly raw: string }): number | null {
    if (raw.trim() === '') return null;
    const value = Number(raw);
    if (!Number.isInteger(value)) return null;
    return value >= MIN_PERCENT_DROP && value <= MAX_PERCENT_DROP ? value : null;
}

/**
 * Parse the target-price input (pesos, up to two decimals) into centavos.
 *
 * @param params - `{ raw }` text typed by the user.
 * @returns Integer centavos or `null` when empty / not a number.
 */
export function parseTargetPriceInput({ raw }: { readonly raw: string }): number | null {
    const text = raw.trim().replace(',', '.');
    if (text === '' || !/^\d+(\.\d{1,2})?$/.test(text)) return null;
    return toCentavos({ amount: Number(text) });
}
