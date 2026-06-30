import { describe, expect, it } from 'vitest';
import { LIMIT_METADATA } from '../src/config/limits.config.js';
import {
    OWNER_BASICO_PLAN,
    TOURIST_FREE_PLAN,
    TOURIST_PLUS_PLAN,
    TOURIST_VIP_PLAN
} from '../src/config/plans.config.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('Limits Configuration', () => {
    describe('LIMIT_METADATA', () => {
        const allLimitKeys = Object.values(LimitKey);

        it('should have entries for all LimitKey values', () => {
            const metadataKeys = Object.keys(LIMIT_METADATA);
            const allLimitKeys = Object.values(LimitKey);

            expect(metadataKeys).toHaveLength(allLimitKeys.length);
            expect(allLimitKeys.length).toBeGreaterThan(0);
        });

        it('should have an entry for MAX_ACCOMMODATIONS', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_ACCOMMODATIONS]).toBeDefined();
        });

        it('should have an entry for MAX_PHOTOS_PER_ACCOMMODATION', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]).toBeDefined();
        });

        it('should have an entry for MAX_ACTIVE_PROMOTIONS', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_ACTIVE_PROMOTIONS]).toBeDefined();
        });

        it('should have an entry for MAX_FAVORITES', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_FAVORITES]).toBeDefined();
        });

        it('should have an entry for MAX_PROPERTIES', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_PROPERTIES]).toBeDefined();
        });

        it('should have an entry for MAX_STAFF_ACCOUNTS', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_STAFF_ACCOUNTS]).toBeDefined();
        });

        it('should have an entry for MAX_ACTIVE_ALERTS', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_ACTIVE_ALERTS]).toBeDefined();
        });

        it('should have an entry for MAX_COMPARE_ITEMS', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_COMPARE_ITEMS]).toBeDefined();
        });

        it('should have an entry for MAX_AI_TEXT_IMPROVE_PER_MONTH', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]).toBeDefined();
        });

        it('should have an entry for MAX_AI_CHAT_PER_MONTH', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_AI_CHAT_PER_MONTH]).toBeDefined();
        });

        it('should have an entry for MAX_AI_SEARCH_PER_MONTH', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_AI_SEARCH_PER_MONTH]).toBeDefined();
        });

        it('should have an entry for MAX_AI_SUPPORT_PER_MONTH', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_AI_SUPPORT_PER_MONTH]).toBeDefined();
        });

        it('should have keys matching LimitKey enum values exactly', () => {
            // Arrange
            const metadataKeys = Object.keys(LIMIT_METADATA);
            const enumValues = Object.values(LimitKey);

            // Act & Assert
            expect(metadataKeys.sort()).toEqual(enumValues.sort());
        });

        it('should have no duplicate keys', () => {
            // Arrange
            const metadataKeys = Object.keys(LIMIT_METADATA);
            const uniqueKeys = new Set(metadataKeys);

            // Act & Assert
            expect(uniqueKeys.size).toBe(metadataKeys.length);
        });

        // SPEC-289 — search history limit key
        it('should have an entry for MAX_SEARCH_HISTORY_ENTRIES', () => {
            expect(LIMIT_METADATA[LimitKey.MAX_SEARCH_HISTORY_ENTRIES]).toBeDefined();
        });

        it('should have non-empty name and description for MAX_SEARCH_HISTORY_ENTRIES', () => {
            const entry = LIMIT_METADATA[LimitKey.MAX_SEARCH_HISTORY_ENTRIES];
            expect(entry.name.trim().length).toBeGreaterThan(0);
            expect(entry.description.trim().length).toBeGreaterThan(0);
        });

        it('should have non-empty name string for every entry', () => {
            for (const limitKey of allLimitKeys) {
                // Arrange
                const entry = LIMIT_METADATA[limitKey];

                // Act & Assert
                expect(typeof entry.name).toBe('string');
                expect(entry.name.trim().length).toBeGreaterThan(0);
            }
        });

        it('should have non-empty description string for every entry', () => {
            for (const limitKey of allLimitKeys) {
                // Arrange
                const entry = LIMIT_METADATA[limitKey];

                // Act & Assert
                expect(typeof entry.description).toBe('string');
                expect(entry.description.trim().length).toBeGreaterThan(0);
            }
        });
    });

    // =========================================================================
    // SPEC-289 — MAX_SEARCH_HISTORY_ENTRIES plan-value assertions
    // =========================================================================

    describe('MAX_SEARCH_HISTORY_ENTRIES plan values (SPEC-289)', () => {
        it('tourist-free plan should NOT have MAX_SEARCH_HISTORY_ENTRIES (no entitlement)', () => {
            // Arrange & Act
            const limitEntry = TOURIST_FREE_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_SEARCH_HISTORY_ENTRIES
            );

            // Assert — free plan is entitlement-gated; the limit key must be absent
            expect(limitEntry).toBeUndefined();
        });

        it('tourist-plus plan should have MAX_SEARCH_HISTORY_ENTRIES = 50', () => {
            // Arrange & Act
            const limitEntry = TOURIST_PLUS_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_SEARCH_HISTORY_ENTRIES
            );

            // Assert
            expect(limitEntry).toBeDefined();
            expect(limitEntry?.value).toBe(50);
        });

        it('tourist-vip plan should have MAX_SEARCH_HISTORY_ENTRIES = 200', () => {
            // Arrange & Act
            const limitEntry = TOURIST_VIP_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_SEARCH_HISTORY_ENTRIES
            );

            // Assert
            expect(limitEntry).toBeDefined();
            expect(limitEntry?.value).toBe(200);
        });

        it('owner plan should inherit MAX_SEARCH_HISTORY_ENTRIES = 200 via TOURIST_VIP_LIMITS', () => {
            // Arrange & Act — owner/complex plans spread TOURIST_VIP_LIMITS, so the
            // VIP entry-count limit must flow through the inheritance mechanism.
            const limitEntry = OWNER_BASICO_PLAN.limits.find(
                (l) => l.key === LimitKey.MAX_SEARCH_HISTORY_ENTRIES
            );

            // Assert
            expect(limitEntry).toBeDefined();
            expect(limitEntry?.value).toBe(200);
        });
    });
});
