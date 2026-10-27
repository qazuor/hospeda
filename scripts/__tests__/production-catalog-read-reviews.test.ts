import { describe, expect, it } from 'vitest';
import {
    type PlanCatalogDefinition,
    PRODUCTION_PLAN_CATALOG
} from '../production-catalog/catalog.js';
import { buildPlanCatalogLoads } from '../production-catalog/loads.js';

function versionsWhereReadAndWriteReviewsDiffer({
    catalog
}: {
    readonly catalog: readonly PlanCatalogDefinition[];
}): string[] {
    return catalog
        .filter((plan) => {
            const keys = new Set(plan.version.entitlements.map((entry) => entry.key));
            return keys.has('read_reviews') !== keys.has('write_reviews');
        })
        .map((plan) => `${plan.vertical}/${plan.slug}`)
        .sort();
}

describe('TEST:1626:8 — read_reviews follows write_reviews in the production catalog', () => {
    it('derives the same grant set for both review keys', () => {
        expect(
            versionsWhereReadAndWriteReviewsDiffer({ catalog: PRODUCTION_PLAN_CATALOG })
        ).toEqual([]);
    });

    it('grants read_reviews to the eleven expected versions', () => {
        const versions = PRODUCTION_PLAN_CATALOG.filter((plan) =>
            plan.version.entitlements.some((entry) => entry.key === 'read_reviews')
        )
            .map((plan) => `${plan.vertical}/${plan.slug}`)
            .sort();

        expect(versions).toEqual([
            'accommodation/owner-basico',
            'accommodation/owner-premium',
            'accommodation/owner-pro',
            'experience/experience-basico',
            'experience/experience-premium',
            'experience/experience-pro',
            'venue/venue-basico',
            'venue/venue-premium',
            'venue/venue-pro',
            'tourist/floor',
            'tourist/tourist-vip'
        ]);
    });

    it('stores no quotas for any read_reviews row', () => {
        const rows = buildPlanCatalogLoads()[2].rows.filter((row) => row[2] === 'read_reviews');

        expect(rows.length).toBe(11);
        expect(rows.map((row) => [row[3], row[4]])).toEqual(
            Array.from({ length: 11 }, () => [null, null])
        );
    });

    it('detects a missing read_reviews grant in tourist-vip', () => {
        const catalog = PRODUCTION_PLAN_CATALOG.map((plan) =>
            plan.vertical === 'tourist' && plan.slug === 'tourist-vip'
                ? {
                      ...plan,
                      version: {
                          ...plan.version,
                          entitlements: plan.version.entitlements.filter(
                              (entry) => entry.key !== 'read_reviews'
                          )
                      }
                  }
                : plan
        );

        expect(versionsWhereReadAndWriteReviewsDiffer({ catalog })).toEqual([
            'tourist/tourist-vip'
        ]);
    });
});
