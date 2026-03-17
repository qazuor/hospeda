import { describe, expect, it } from 'vitest';
import { LIMIT_METADATA } from '../src/config/limits.config.js';
import { LimitKey } from '../src/types/plan.types.js';

describe('Limits Configuration', () => {
    describe('LIMIT_METADATA', () => {
        const allLimitKeys = Object.values(LimitKey);

        it('should have entries for all 6 LimitKey values', () => {
            // Arrange
            const metadataKeys = Object.keys(LIMIT_METADATA);

            // Act & Assert
            expect(metadataKeys).toHaveLength(6);
            expect(allLimitKeys).toHaveLength(6);
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
});
