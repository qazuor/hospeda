/**
 * Tests for HOS-21 T-003: wire a dedicated `VIP_PROMOTIONS_ACCESS` entitlement
 * for the tourist-vip tier of exclusive deals.
 *
 * `VIP_PROMOTIONS_ACCESS` is a NEW, standalone entitlement — distinct from
 * `VIP_VISIBILITY_ACCESS` (accommodation-visibility bypass, unrelated
 * feature). The original HOS-21 spec assumed VIP_PROMOTIONS_ACCESS was an
 * orphaned enum member left over from the SPEC-286 rename; that premise was
 * false (SPEC-286 renamed it directly to VIP_VISIBILITY_ACCESS, with no
 * leftover member), so this task creates the key fresh instead of reusing
 * VIP_VISIBILITY_ACCESS.
 */
import { describe, expect, it } from 'vitest';
import { ENTITLEMENT_DEFINITIONS } from '../src/config/entitlements.config.js';
import { TOURIST_PLUS_PLAN, TOURIST_VIP_PLAN } from '../src/config/plans.config.js';
import { EntitlementKey } from '../src/types/entitlement.types.js';

describe('EntitlementKey.VIP_PROMOTIONS_ACCESS (HOS-21 T-003)', () => {
    it('is defined with the expected string value', () => {
        expect(EntitlementKey.VIP_PROMOTIONS_ACCESS).toBe('vip_promotions_access');
    });

    it('has its own metadata, distinct from VIP_VISIBILITY_ACCESS', () => {
        const definition = ENTITLEMENT_DEFINITIONS.find(
            (e) => e.key === EntitlementKey.VIP_PROMOTIONS_ACCESS
        );
        expect(definition).toBeDefined();
        expect(definition?.name).toBeTruthy();
        expect(definition?.description).toBeTruthy();

        const visibilityDefinition = ENTITLEMENT_DEFINITIONS.find(
            (e) => e.key === EntitlementKey.VIP_VISIBILITY_ACCESS
        );
        expect(definition?.description).not.toBe(visibilityDefinition?.description);
    });

    it('is granted by the tourist-vip plan', () => {
        expect(TOURIST_VIP_PLAN.entitlements).toContain(EntitlementKey.VIP_PROMOTIONS_ACCESS);
    });

    it('is NOT granted by the tourist-plus plan', () => {
        expect(TOURIST_PLUS_PLAN.entitlements).not.toContain(EntitlementKey.VIP_PROMOTIONS_ACCESS);
    });
});
