import { createLogger } from '@repo/logger';

const logger = createLogger('plan-display-name');

/** Identity of a catalog plan as stored in `plan` (the stored name is not user-facing). */
export interface PlanDisplayInput {
    /** Stable plan slug inside its vertical. */
    readonly slug: string;
    /** Stored catalog name; used only when no translation exists for the slug. */
    readonly name: string;
}

/** Tourist has one plan and its vertical label ("Turista VIP") already names it. */
const TOURIST_VERTICAL = 'tourist';

interface BillingCopy {
    readonly plan?: Readonly<Record<string, { readonly name?: string }>>;
    readonly checkout?: {
        readonly signup?: { readonly vertical?: Readonly<Record<string, string>> };
    };
}

let cachedCopy: Promise<BillingCopy> | undefined;

/**
 * Loads the Spanish billing copy lazily and by subpath. A static import would make every
 * consumer of this file load the JSON at module-evaluation time, and the Playwright e2e
 * runner (which strips import attributes) then crashes in native Node ESM; the `@repo/i18n`
 * index fails the same way because it imports every locale file without attributes.
 */
function loadCopy(): Promise<BillingCopy> {
    // A failed load must never poison the cache nor break the caller: display names are cosmetic,
    // and callers sit inside payment/activation transactions. Fall back to the stored plan name.
    cachedCopy ??= import('@repo/i18n/locales/es/billing.json', { with: { type: 'json' } })
        .then((module) => module.default as BillingCopy)
        .catch((error: unknown) => {
            cachedCopy = undefined;
            logger.warn(
                { error: error instanceof Error ? error.message : String(error) },
                'Billing copy could not be loaded; falling back to stored plan names'
            );
            return {} as BillingCopy;
        });
    return cachedCopy;
}

async function verticalLabel(vertical: string): Promise<string | undefined> {
    const copy = await loadCopy();
    const label = copy.checkout?.signup?.vertical?.[vertical];
    return label && label.trim() !== '' ? label : undefined;
}

/**
 * User-facing plan name in Spanish (the default locale and the only one the
 * billing emails and the MercadoPago checkout speak today).
 *
 * Resolves the same `billing.plan.<slug>.name` key the web pricing UI reads, so
 * the catalog has a single display source, and falls back to the stored name so
 * an untranslated plan never produces an empty string. The tourist plan reads
 * as its vertical label ("Turista VIP"), because "VIP" alone means nothing in an
 * email.
 *
 * @param input.vertical - The plan's vertical id, when known
 * @param input.plan - The plan slug and stored name
 * @returns The Spanish display name
 */
export async function resolvePlanDisplayName(input: {
    readonly vertical?: string | null;
    readonly plan: PlanDisplayInput;
}): Promise<string> {
    if (input.vertical === TOURIST_VERTICAL) {
        const label = await verticalLabel(TOURIST_VERTICAL);
        if (label) return label;
    }
    const copy = await loadCopy();
    const translated = copy.plan?.[input.plan.slug]?.name;
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
export async function buildProviderReason(input: {
    readonly vertical: string;
    readonly plan: PlanDisplayInput;
}): Promise<string> {
    const planName = await resolvePlanDisplayName({
        vertical: input.vertical,
        plan: input.plan
    });
    const label =
        input.vertical === TOURIST_VERTICAL ? undefined : await verticalLabel(input.vertical);
    if (!label) return `Hospeda · ${planName}`;
    return `Hospeda · ${label.charAt(0).toUpperCase()}${label.slice(1)} ${planName}`;
}
