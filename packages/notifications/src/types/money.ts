/** Marked type for amounts in major units used by notification templates. */

/**
 * An amount in MAJOR currency units (ARS pesos) — the unit MercadoPago's REST
 * payloads (`transaction_amount`, `transaction_amount_refunded`) and every
 * customer-facing notification/analytics amount are expressed in.
 *
 * Structurally a `number`, so it can be passed anywhere a plain `number` is
 * accepted; the brand only prevents a plain `number` or a {@link Centavos} from
 * being accepted HERE.
 */
export type Major = number & { readonly __moneyUnit: 'major' };

/**
 * Brand a raw `number` that is ALREADY known to be in major units (ARS pesos).
 *
 * This is an assertion, not a conversion — it performs no arithmetic. Use it
 * exactly once per value, at the boundary where the value enters the type
 * system (an MP REST payload field, a synthetic MP-raw-shaped payload), and let
 * the brand carry the unit from there on.
 *
 * @param value - A number the caller knows to be in major units.
 * @returns The same number, branded as {@link Major}.
 *
 * @example
 * ```ts
 * // MP sends `transaction_amount` in pesos.
 * const amount = asMajor(data.transaction_amount);
 * ```
 */
export function asMajor(value: number): Major {
    return value as Major;
}
