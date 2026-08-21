/**
 * Branded money units — the currency unit travels in the TYPE, not in a comment.
 *
 * ## Why this module exists
 *
 * The money-unit convention flips at every boundary of the payment pipeline, and
 * both sides of each flip believe they are canonical:
 *
 * | Point                                | Unit         |
 * | ------------------------------------ | ------------ |
 * | MercadoPago REST (`transaction_amount`) | major (ARS pesos) |
 * | qzpay adapter (`QZPayProviderPayment.amount`) | **centavos** |
 * | synthetic MP-raw payload (`data.transaction_amount`) | major |
 * | `billing_payments.amount`            | **centavos** |
 *
 * Four hops, two conversions, and until HOS-720 nothing in the type system told
 * them apart — every one of them was a bare `number`. The only defence was a
 * comment, and comments demonstrably do not hold: HOS-713 shipped a 100×
 * inflated charge whose fix landed ONE LINE BELOW an existing comment stating
 * this exact convention and applying it to the neighbouring field. The rule was
 * written, adjacent, and correct — and the bug happened anyway, because nothing
 * FORCED it to be applied.
 *
 * {@link Centavos} and {@link Major} make the compiler force it. A value in one
 * unit no longer type-checks where the other is expected, at every boundary,
 * whether or not anyone remembered to leave a note.
 *
 * ## How to use it
 *
 * - A number arriving from outside the type system (an MP JSON payload, a qzpay
 *   adapter response, a DB column) is branded ONCE at its parse boundary with
 *   {@link asMajor} or {@link asCentavos}. Those two functions are the only
 *   sanctioned way to enter the branded world; each one is an assertion by the
 *   caller about a value it just read, so keep them at parse boundaries and
 *   never deeper.
 * - Crossing between units is {@link toCentavos} / {@link toMajor}. Never a bare
 *   `* 100` or `/ 100` — those produce a plain `number` that the compiler will
 *   then refuse to hand to a branded parameter, which is the point.
 * - Passing a branded value where a plain `number` is expected needs nothing:
 *   `Centavos` and `Major` are both subtypes of `number`, so third-party
 *   signatures (`billing.payments.record({ amount: number })`, logger fields,
 *   analytics properties) accept them untouched. The brands only ever restrict
 *   the direction that matters — plain-to-branded, and branded-to-wrong-brand.
 *
 * ## What the brands do NOT do
 *
 * Arithmetic between two branded values widens back to `number`
 * (`a + b` where both are `Centavos` is a `number`), so a computed total has to
 * be re-branded deliberately. That is intended: a sum of two amounts is a new
 * assertion, not an inherited one.
 *
 * @module types/money
 */

/**
 * An amount in MINOR currency units (centavos) — the unit
 * `billing_payments.amount`, every qzpay adapter money field, and
 * `@repo/billing`'s plan/addon price constants are expressed in.
 *
 * Structurally a `number`, so it can be passed anywhere a plain `number` is
 * accepted; the brand only prevents a plain `number` or a {@link Major} from
 * being accepted HERE.
 */
export type Centavos = number & { readonly __moneyUnit: 'centavos' };

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
 * Brand a raw `number` that is ALREADY known to be in centavos.
 *
 * This is an assertion, not a conversion — it performs no arithmetic. Use it
 * exactly once per value, at the boundary where the value enters the type
 * system (a qzpay adapter response, a `billing_payments` row, a price constant
 * from `@repo/billing`), and let the brand carry the unit from there on.
 *
 * @param value - A number the caller knows to be in minor units.
 * @returns The same number, branded as {@link Centavos}.
 *
 * @example
 * ```ts
 * // qzpay normalizes every money field to minor units.
 * const charged = asCentavos(providerPayment.amount);
 * ```
 */
export function asCentavos(value: number): Centavos {
    return value as Centavos;
}

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

/**
 * Convert major units (ARS pesos) to centavos, rounding to the nearest integer.
 *
 * Replaces every hand-written `Math.round(x * 100)` on the money path. The
 * rounding is deliberate and matches what the qzpay MercadoPago adapter does on
 * the way out, so a value round-tripped through {@link toMajor} and back lands
 * on the same integer centavo.
 *
 * @param value - The amount in major units.
 * @returns The equivalent amount in {@link Centavos}, rounded.
 *
 * @example
 * ```ts
 * toCentavos(asMajor(150.0)); // 15000
 * ```
 */
export function toCentavos(value: Major): Centavos {
    return Math.round(value * 100) as Centavos;
}

/**
 * Convert centavos to major units (ARS pesos).
 *
 * Replaces every hand-written `x / 100` on the money path — notably the two
 * producers that build an MP-raw-shaped payload out of a qzpay adapter response
 * (`payment-handler.ts` and `subscription-poll.job.ts`), which is precisely
 * where HOS-704 and HOS-713 both went wrong.
 *
 * No rounding: a fractional peso is a real value MercadoPago can report, and
 * the sibling {@link toCentavos} is what restores integrality on the way back.
 *
 * @param value - The amount in centavos.
 * @returns The equivalent amount in {@link Major}.
 *
 * @example
 * ```ts
 * toMajor(asCentavos(15000)); // 150
 * ```
 */
export function toMajor(value: Centavos): Major {
    return (value / 100) as Major;
}
