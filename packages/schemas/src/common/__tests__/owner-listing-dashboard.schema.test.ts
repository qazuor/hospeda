import { describe, expect, it } from 'vitest';
import {
    OwnerDashboardWindowSchema,
    OwnerListingDashboardSchema
} from '../owner-listing-dashboard.schema.js';

const listings = { total: 3, published: 1, draft: 1, archived: 1 };
const traffic = { windowDays: 30, unique: 4, total: 9 };

describe('OwnerListingDashboardSchema', () => {
    it('requires traffic when access is granted', () => {
        // Arrange
        const input = { vertical: 'venue', listings, trafficAccess: 'granted' };
        // Act
        const result = OwnerListingDashboardSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts a granted payload with traffic', () => {
        const result = OwnerListingDashboardSchema.safeParse({
            vertical: 'experience',
            listings,
            trafficAccess: 'granted',
            traffic
        });
        expect(result.success).toBe(true);
    });

    it.each(['locked', 'unavailable'] as const)('strips traffic when access is %s', (access) => {
        // Arrange
        const input = { vertical: 'venue', listings, trafficAccess: access, traffic };
        // Act
        const result = OwnerListingDashboardSchema.parse(input);
        // Assert
        expect(result).not.toHaveProperty('traffic');
    });

    it('rejects an unknown vertical and negative counts', () => {
        expect(
            OwnerListingDashboardSchema.safeParse({
                vertical: 'accommodation',
                listings,
                trafficAccess: 'locked'
            }).success
        ).toBe(false);
        expect(
            OwnerListingDashboardSchema.safeParse({
                vertical: 'venue',
                listings: { ...listings, draft: -1 },
                trafficAccess: 'locked'
            }).success
        ).toBe(false);
    });
});

describe('OwnerDashboardWindowSchema', () => {
    it('accepts 7d and 30d', () => {
        expect(OwnerDashboardWindowSchema.parse('7d')).toBe('7d');
        expect(OwnerDashboardWindowSchema.parse('30d')).toBe('30d');
    });

    it('falls back to 30d on an unsupported value', () => {
        expect(OwnerDashboardWindowSchema.parse('90d')).toBe('30d');
        expect(OwnerDashboardWindowSchema.parse(undefined)).toBe('30d');
    });
});
