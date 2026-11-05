import { describe, expect, it } from 'vitest';
import { PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS as SEED_OWNED } from '../../packages/seed/src/catalog/next-version-entitlements.js';
import {
    PRODUCTION_PLAN_CATALOG,
    PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS
} from '../production-catalog/catalog.js';

const VIDEO = 'can_embed_video';

/** Baseline rows of an accommodation plan plus the grants the next-version list adds. */
function effectiveKeys(slug: string): readonly string[] {
    const plan = PRODUCTION_PLAN_CATALOG.find(
        (item) => item.vertical === 'accommodation' && item.slug === slug
    );
    if (!plan) throw new Error(`Missing ${slug}`);
    const added = PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS.filter(
        (entry) => entry.vertical === 'accommodation' && entry.slug === slug
    ).map((entry) => entry.key as string);
    return [...plan.version.entitlements.map((item) => item.key), ...added];
}

describe('HOS-2037 accommodation video link entitlement', () => {
    it('re-exports the one list migration 0133 reads (single source)', () => {
        expect(PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS).toBe(SEED_OWNED);
        expect(PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS).toEqual([
            { vertical: 'accommodation', slug: 'owner-basico', key: VIDEO }
        ]);
    });

    it('keeps the baseline immutable: Basic has no video row, Pro and Premium do', () => {
        const baseline = (slug: string) =>
            PRODUCTION_PLAN_CATALOG.find(
                (item) => item.vertical === 'accommodation' && item.slug === slug
            )?.version.entitlements.map((item) => item.key) ?? [];
        expect(baseline('owner-basico')).not.toContain(VIDEO);
        expect(baseline('owner-pro')).toContain(VIDEO);
        expect(baseline('owner-premium')).toContain(VIDEO);
    });

    it('grants video on Basic (via the next version), Pro and Premium (baseline)', () => {
        for (const slug of ['owner-basico', 'owner-pro', 'owner-premium'])
            expect(effectiveKeys(slug), slug).toContain(VIDEO);
    });

    it('stores no trial rows: the trial derives its video from Premium', () => {
        const trial = PRODUCTION_PLAN_CATALOG.find(
            (plan) => plan.vertical === 'accommodation' && plan.role === 'trial'
        );
        expect(trial?.version.entitlements).toHaveLength(0);
        expect(
            PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS.some((entry) => entry.slug === trial?.slug)
        ).toBe(false);
        expect(effectiveKeys('owner-premium')).toContain(VIDEO);
    });
});
