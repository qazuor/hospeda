import { trans } from '@repo/i18n';

/** Identity of a catalog plan as stored in `plan` (the stored name is not user-facing). */
export interface PlanDisplayInput {
    /** Stable plan slug inside its vertical. */
    readonly slug: string;
    /** Stored catalog name; used only when no translation exists for the slug. */
    readonly name: string;
}

/**
 * User-facing plan name in Spanish (the default locale and the only one the
 * billing emails and the MercadoPago checkout speak today).
 *
 * Resolves the same `billing.plan.<slug>.name` key the web pricing UI reads, so
 * the catalog has a single display source. Falls back to the stored name so an
 * untranslated plan never produces an empty string.
 *
 * @param input.plan - The plan slug and stored name
 * @returns The Spanish display name
 */
export function resolvePlanDisplayName(input: { readonly plan: PlanDisplayInput }): string {
    const translated = trans.es[`billing.plan.${input.plan.slug}.name`];
    return translated && translated.trim() !== '' ? translated : input.plan.name;
}

/**
 * Label MercadoPago shows to the payer (checkout page and its own emails) as
 * the preapproval `reason`, e.g. `Hospeda · Alojamiento Básico`.
 *
 * Tourist plans already carry the vertical in their name (`Turista VIP`), so
 * the vertical is not repeated for them.
 *
 * @param input.vertical - The plan's vertical id
 * @param input.plan - The plan slug and stored name
 * @returns The provider-facing reason
 */
export function buildProviderReason(input: {
    readonly vertical: string;
    readonly plan: PlanDisplayInput;
}): string {
    const planName = resolvePlanDisplayName({ plan: input.plan });
    if (input.vertical === 'tourist') return `Hospeda · ${planName}`;
    const label = trans.es[`billing.checkout.signup.vertical.${input.vertical}`];
    if (!label) return `Hospeda · ${planName}`;
    return `Hospeda · ${label.charAt(0).toUpperCase()}${label.slice(1)} ${planName}`;
}
