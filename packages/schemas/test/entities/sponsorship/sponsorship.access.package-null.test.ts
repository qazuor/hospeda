import { describe, expect, it } from 'vitest';
import {
    SponsorshipAdminSchema,
    SponsorshipProtectedSchema,
    SponsorshipPublicSchema
} from '../../../src/entities/sponsorship/index.js';
import { createValidSponsorship } from '../../fixtures/sponsorship.fixtures.js';

/**
 * HOS-1905: `sponsorships.package_id` is nullable and the relation loader emits
 * `package: null`, so every access schema must accept it.
 */
describe.each([
    ['public', SponsorshipPublicSchema],
    ['protected', SponsorshipProtectedSchema],
    ['admin', SponsorshipAdminSchema]
] as const)('Sponsorship %s access schema package relation', (_name, schema) => {
    it('accepts package: null', () => {
        // Arrange
        const input = { ...createValidSponsorship(), package: null };

        // Act
        const result = schema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.success && result.data.package).toBeNull();
    });

    it('accepts an absent package', () => {
        // Arrange
        const input = createValidSponsorship();

        // Act
        const result = schema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
    });
});
