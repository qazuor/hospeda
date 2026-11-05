import { describe, expect, it } from 'vitest';
import {
    PRODUCTION_PLAN_CATALOG,
    PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS
} from '../production-catalog/catalog.js';

describe('HOS-2037 accommodation video link entitlement', () => {
    it('publishes a Basic version while the trial continues to derive video from Premium', () => {
        expect(PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS).toEqual([
            { vertical: 'accommodation', slug: 'owner-basico', key: 'can_embed_video' }
        ]);
        const premium = PRODUCTION_PLAN_CATALOG.find((plan) => plan.slug === 'owner-premium');
        const trial = PRODUCTION_PLAN_CATALOG.find(
            (plan) => plan.vertical === 'accommodation' && plan.role === 'trial'
        );
        expect(premium?.version.entitlements.some((item) => item.key === 'can_embed_video')).toBe(
            true
        );
        expect(trial?.version.entitlements).toHaveLength(0);
    });
});
