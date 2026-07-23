/**
 * Unit tests for `resolveCommercePlanSlug` (HOS-166 D-7, §6.4).
 *
 * `env` is module-mocked so both the "configured" and "unset"
 * `HOSPEDA_COMMERCE_PLAN_ID` cases are exercised without touching real
 * process.env or booting the full app. Mirrors the mocking style used in
 * `start-subscription.service.test.ts`.
 */
import { CommerceEntityTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mock (hoisted above imports by Vitest). `vi.hoisted` is required so
// `mockEnv` is safely accessible from inside the (also hoisted) `vi.mock`
// factory — a plain top-level `const` is NOT reliably visible there.
// ──────────────────────────────────────────────────────────────────────────
const mockEnv = vi.hoisted<{ HOSPEDA_COMMERCE_PLAN_ID?: string }>(() => ({
    HOSPEDA_COMMERCE_PLAN_ID: 'commerce-listing'
}));

vi.mock('../../src/utils/env', () => ({
    env: mockEnv
}));

import {
    CommercePlanNotConfiguredError,
    resolveCommercePlanSlug
} from '../../src/services/commerce-plan-resolver';

describe('resolveCommercePlanSlug', () => {
    it('should return the configured plan slug for gastronomy', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = 'commerce-listing';

        const result = resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY });

        expect(result).toBe('commerce-listing');
    });

    it('should return the configured plan slug for experience', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = 'commerce-listing';

        const result = resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.EXPERIENCE });

        expect(result).toBe('commerce-listing');
    });

    it('should throw CommercePlanNotConfiguredError when HOSPEDA_COMMERCE_PLAN_ID is unset', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = undefined;

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })
        ).toThrow(CommercePlanNotConfiguredError);
    });

    it("should throw an error whose message matches the admin route's 503 wording", () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = undefined;

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.EXPERIENCE })
        ).toThrow(/HOSPEDA_COMMERCE_PLAN_ID unset/);
    });

    it('should throw when HOSPEDA_COMMERCE_PLAN_ID is an empty string', () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = '';

        expect(() =>
            resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY })
        ).toThrow(CommercePlanNotConfiguredError);
    });
});
