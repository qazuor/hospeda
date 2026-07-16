/**
 * Subscription Charge Reconciliation (accounting defense — HOS-171 §7.5)
 *
 * Detects when a recurring subscription charge lands for an amount we did not
 * ask for.
 *
 * ## The risk
 *
 * MercadoPago has a merchant discount-campaign engine in its seller panel
 * (Configuración → Negocio → Ofrecer Descuentos): percentage or fixed, date
 * range, optionally code-gated. It is configured at **account level** — not per
 * product, not per checkout — and the merchant absorbs the cost. A campaign
 * created for an unrelated marketing push on the same MercadoPago account can
 * therefore apply to a subscription charge, and the money simply arrives lower
 * than the plan says.
 *
 * Nothing defends against that today: reconciliation, dunning and the promo
 * engine all assume `charged == plan price` (or plan price with *our* promo
 * applied). The engine lives entirely outside the Subscriptions API — panel
 * only, no endpoints — so we cannot enumerate campaigns and rule it out. The
 * only thing we can do is notice.
 *
 * ## Why `coupon_amount` / `campaign_id` are the signal, and the amount is not
 *
 * The obvious check — "compare the charge against the plan price and alert on
 * any mismatch" — is a false-positive generator. A charge can legitimately
 * differ from the plan's headline price because:
 *
 * - **our own promo engine** deliberately lowered the preapproval amount for N
 *   cycles (SPEC-262), so a discounted charge is correct and expected;
 * - the subscription is **annual**, so the charge is ~12× a monthly price row;
 * - a **plan change** applied mid-cycle.
 *
 * An alert that fires on all of those trains the team to ignore it, which is
 * worse than no alert. `coupon_amount` and `campaign_id`, by contrast, are
 * fields **we never set on any call path**. MercadoPago populates them only when
 * *its* campaign engine touched the charge. Their presence is therefore proof of
 * external interference with zero false positives, which is exactly the risk
 * this defense exists for.
 *
 * The expected amount, when the caller can resolve one, travels in the report as
 * context — how much was lost — rather than as the trigger.
 *
 * ## Never fail-closed
 *
 * A detection must alert, never reject the charge. Refusing money because our
 * expectation is stale is a worse failure than a logged discrepancy: the
 * customer's card was already debited and MercadoPago considers the matter
 * settled. Contrast the signup-discount path, which *is* fail-closed — there we
 * are the ones mutating the amount, so a mismatch means our own bug.
 *
 * @module services/subscription-charge-reconcile
 */

/**
 * Input for {@link detectExternalChargeInterference}.
 */
export interface DetectExternalChargeInterferenceInput {
    /**
     * `coupon_amount` from the MercadoPago payment, in MAJOR units. Non-null and
     * greater than zero means MP's campaign engine discounted the charge. We
     * never set this field.
     */
    readonly couponAmount: number | null;
    /**
     * `campaign_id` from the MercadoPago payment. Non-null means the charge was
     * matched by one of the account's discount campaigns. We never set this
     * field either.
     */
    readonly campaignId: string | null;
    /** What MercadoPago actually charged, in centavos. */
    readonly chargedAmountCentavos: number;
    /**
     * What we believed the charge should be, in centavos, when the caller could
     * resolve it. Carried as context only — see the module docs on why this is
     * not the trigger. `null` when unresolvable.
     */
    readonly expectedAmountCentavos: number | null;
}

/**
 * A charge that MercadoPago's campaign engine altered behind our back.
 */
export interface ExternalChargeInterference {
    /** What MercadoPago actually charged, in centavos. */
    readonly chargedAmountCentavos: number;
    /** What we expected, in centavos, or `null` when it could not be resolved. */
    readonly expectedAmountCentavos: number | null;
    /**
     * `expected - charged`, in centavos, when both are known. Positive means we
     * were paid less than expected. `null` when there is no expectation to
     * compare against.
     */
    readonly shortfallCentavos: number | null;
    /** The discount MercadoPago applied, in centavos, when it reported one. */
    readonly couponAmountCentavos: number | null;
    /** The MercadoPago campaign that matched, when it reported one. */
    readonly campaignId: string | null;
}

/**
 * Detects whether MercadoPago applied one of its own discount campaigns to a
 * subscription charge.
 *
 * Pure and I/O-free. Returns `null` when the charge is clean — which is the
 * overwhelmingly common case, since this only fires if the account actually has
 * a campaign configured.
 *
 * @param input - The MercadoPago coupon/campaign fields plus the charged and
 *   (optionally) expected amounts.
 * @returns The interference details to alert on, or `null` when the charge shows
 *   no sign of external interference.
 *
 * @example
 * ```ts
 * // A clean charge — the overwhelmingly common case
 * detectExternalChargeInterference({
 *   couponAmount: null,
 *   campaignId: null,
 *   chargedAmountCentavos: 1_500_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => null
 *
 * // An account-level campaign silently took ARS 500 off
 * detectExternalChargeInterference({
 *   couponAmount: 500,
 *   campaignId: 'campaign-abc',
 *   chargedAmountCentavos: 1_450_000,
 *   expectedAmountCentavos: 1_500_000,
 * }); // => { shortfallCentavos: 50_000, campaignId: 'campaign-abc', ... }
 * ```
 */
export function detectExternalChargeInterference(
    input: DetectExternalChargeInterferenceInput
): ExternalChargeInterference | null {
    const { couponAmount, campaignId, chargedAmountCentavos, expectedAmountCentavos } = input;

    const hasCoupon = couponAmount !== null && couponAmount > 0;
    const hasCampaign = campaignId !== null && campaignId.length > 0;

    if (!hasCoupon && !hasCampaign) {
        return null;
    }

    return {
        chargedAmountCentavos,
        expectedAmountCentavos,
        shortfallCentavos:
            expectedAmountCentavos === null ? null : expectedAmountCentavos - chargedAmountCentavos,
        couponAmountCentavos: hasCoupon ? Math.round((couponAmount as number) * 100) : null,
        campaignId: hasCampaign ? campaignId : null
    };
}
