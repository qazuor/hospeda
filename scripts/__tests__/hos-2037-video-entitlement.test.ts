import { describe, expect, it } from 'vitest';
import {
    PRODUCTION_PLAN_CATALOG,
    PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS
} from '../production-catalog/catalog.js';

describe('HOS-2037 accommodation video link entitlement', () => {
    it('grants the video link to every accommodation plan version', () => {
        const plans = PRODUCTION_PLAN_CATALOG.filter(
            (plan) =>
                plan.vertical === 'accommodation' &&
                ['owner-basico', 'owner-pro', 'owner-premium', 'trial'].includes(plan.slug)
        );

        expect(plans.map((plan) => plan.slug).sort()).toEqual([
            'owner-basico',
            'owner-premium',
            'owner-pro',
            'trial'
        ]);
        for (const plan of plans) {
            expect(
                plan.version.entitlements.some(
                    (entitlement) => entitlement.key === 'can_embed_video'
                ) ||
                    PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS.some(
                        (entry) =>
                            entry.vertical === plan.vertical &&
                            entry.slug === plan.slug &&
                            entry.key === 'can_embed_video'
                    ),
                `${plan.slug} should grant can_embed_video`
            ).toBe(true);
        }
    });
});
