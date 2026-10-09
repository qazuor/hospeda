import { getCatalogKey, VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    catalogId,
    PRODUCTION_PLAN_CATALOG
} from '../../../../../scripts/production-catalog/catalog.js';
import type {
    CatalogPlan,
    PlanVersionRow,
    PublicationContext
} from '../../../src/services/plan-catalog/plan-publication.types.js';
import { validatePublication } from '../../../src/services/plan-catalog/plan-publication.validation.js';

const keyClasses = new Map<string, string>();
for (const plan of PRODUCTION_PLAN_CATALOG) {
    for (const effect of [...plan.version.entitlements, ...plan.version.limits]) {
        const definition = getCatalogKey({ key: effect.key });
        if (!definition) throw new Error(`Unknown key ${effect.key}`);
        keyClasses.set(effect.key, definition.keyClass);
    }
}

function contextFor(plan: (typeof PRODUCTION_PLAN_CATALOG)[number]): PublicationContext {
    const sameVertical = PRODUCTION_PLAN_CATALOG.filter((item) => item.vertical === plan.vertical);
    const catalog: CatalogPlan[] = sameVertical.map((item) => ({
        id: catalogId(`plan:${item.vertical}:${item.slug}`),
        role: item.role,
        currentVersion: {
            rank: item.version.rank,
            sellable: item.version.sellable,
            current: item.version.current,
            trialDays: item.version.trialDays
        } as PlanVersionRow
    }));
    return {
        planId: catalogId(`plan:${plan.vertical}:${plan.slug}`),
        vertical: plan.vertical,
        activationEvent: VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[plan.vertical],
        role: plan.role,
        previous: null,
        catalog,
        content: {
            rank: plan.version.rank,
            sellable: plan.version.sellable,
            trialDays: plan.version.trialDays,
            graceDays: plan.version.graceDays,
            allowsPause: plan.version.allowsPause,
            inheritsTouristVip: plan.version.inheritsTouristVip,
            entitlements: plan.version.entitlements.map((item) => ({
                key: item.key,
                ...('planQuota' in item ? { planQuota: item.planQuota } : {}),
                ...('trialQuota' in item ? { trialQuota: item.trialQuota } : {})
            })),
            limits: plan.version.limits.map((item) => ({ key: item.key, value: item.value }))
        },
        keyClasses
    };
}

describe('AC:V2:8 — every real catalog version passes action 18 validation', () => {
    it.each(PRODUCTION_PLAN_CATALOG)('$vertical/$slug', (plan) => {
        expect(() => validatePublication({ context: contextFor(plan) })).not.toThrow();
    });
});
