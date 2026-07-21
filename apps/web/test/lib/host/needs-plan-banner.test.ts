/**
 * @file needs-plan-banner.test.ts
 * @description Unit tests for the "anfitrión en preparación" banner decision
 * (HOS-217) — a HOST with at least one draft property but no real
 * owner/complex-category subscription should see a proactive nag banner on
 * the property-listing page; a HOST who can actually publish should not.
 */

import { describe, expect, it } from 'vitest';
import { shouldShowNeedsPlanBanner } from '../../../src/lib/host/needs-plan-banner';

describe('shouldShowNeedsPlanBanner', () => {
    it('shows the banner for a HOST with a draft property and no owner plan', () => {
        // Arrange
        const params = {
            isEmpty: false,
            fetchError: false,
            hasDraftProperty: true,
            hasOwnerPlan: false
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(true);
    });

    it('does NOT show the banner when the HOST already has an owner plan', () => {
        // Arrange
        const params = {
            isEmpty: false,
            fetchError: false,
            hasDraftProperty: true,
            hasOwnerPlan: true
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(false);
    });

    it('does NOT show the banner when the property list is empty (empty state owns the CTA instead)', () => {
        // Arrange
        const params = {
            isEmpty: true,
            fetchError: false,
            hasDraftProperty: false,
            hasOwnerPlan: false
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(false);
    });

    it('does NOT show the banner when the SSR fetch failed (error state owns the message instead)', () => {
        // Arrange
        const params = {
            isEmpty: false,
            fetchError: true,
            hasDraftProperty: true,
            hasOwnerPlan: false
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(false);
    });

    it('does NOT show the banner when none of the properties are drafts (all ACTIVE/ARCHIVED/INACTIVE)', () => {
        // Arrange
        const params = {
            isEmpty: false,
            fetchError: false,
            hasDraftProperty: false,
            hasOwnerPlan: false
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(false);
    });

    it('does NOT show the banner when every condition that would suppress it is true at once', () => {
        // Arrange
        const params = {
            isEmpty: true,
            fetchError: true,
            hasDraftProperty: false,
            hasOwnerPlan: true
        };

        // Act
        const result = shouldShowNeedsPlanBanner(params);

        // Assert
        expect(result).toBe(false);
    });
});
