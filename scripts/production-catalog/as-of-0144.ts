import type { PlanCatalogDefinition } from './catalog.js';

/**
 * Plan names as migration 0144 wrote them. HOS-2614 renamed them in the code
 * catalog; the rename reaches live databases through seed data-migration 0191,
 * never by editing 0144. Keyed by `vertical:slug`.
 */
const NAMES_AS_OF_0144: Readonly<Record<string, string>> = {
    'accommodation:owner-basico': 'Basic',
    'accommodation:owner-pro': 'Professional',
    'accommodation:owner-premium': 'Premium',
    'tourist:tourist-vip': 'VIP',
    'partner:partner-silver': 'Partner Silver',
    'partner:partner-gold': 'Partner Gold',
    'accommodation:trial': 'Accommodation Trial',
    'accommodation:pre-trial': 'Accommodation Pre Trial',
    'accommodation:floor': 'Accommodation Floor',
    'venue:trial': 'Comer y salir Trial',
    'venue:pre-trial': 'Comer y salir Pre Trial',
    'venue:floor': 'Comer y salir Floor',
    'experience:trial': 'Experience Trial',
    'experience:pre-trial': 'Experience Pre Trial',
    'experience:floor': 'Experience Floor',
    'tourist:trial': 'Tourist Trial',
    'tourist:pre-trial': 'Tourist Pre Trial',
    'tourist:floor': 'Turista Free',
    'partner:trial': 'Partner Trial',
    'partner:pre-trial': 'Partner Pre Trial',
    'partner:floor': 'Partner Floor'
};

/** Catalog projection that matches the rows written by immutable migration 0144. */
export function projectCatalogAsOf0144(
    catalog: readonly PlanCatalogDefinition[]
): PlanCatalogDefinition[] {
    return catalog.map((plan) => ({
        ...plan,
        name: NAMES_AS_OF_0144[`${plan.vertical}:${plan.slug}`] ?? plan.name,
        version: {
            ...plan.version,
            entitlements: plan.version.entitlements.filter((entry) => entry.key !== 'ai_faq_draft'),
            limits: plan.version.limits.filter(
                (entry) => entry.key !== 'max_ai_faq_draft_per_month'
            )
        }
    }));
}
