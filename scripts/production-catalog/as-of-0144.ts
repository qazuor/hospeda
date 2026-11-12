import type { PlanCatalogDefinition } from './catalog.js';

/** Catalog projection that matches the rows written by immutable migration 0144. */
export function projectCatalogAsOf0144(
    catalog: readonly PlanCatalogDefinition[]
): PlanCatalogDefinition[] {
    return catalog.map((plan) => ({
        ...plan,
        version: {
            ...plan.version,
            entitlements: plan.version.entitlements.filter((entry) => entry.key !== 'ai_faq_draft'),
            limits: plan.version.limits.filter(
                (entry) => entry.key !== 'max_ai_faq_draft_per_month'
            )
        }
    }));
}
