import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    SponsorshipAnalyticsSchema,
    SponsorshipSchema
} from '../../../src/entities/sponsorship/index.js';
import {
    createMinimalSponsorship,
    createValidSponsorship
} from '../../fixtures/sponsorship.fixtures.js';

describe('SponsorshipAnalyticsSchema', () => {
    describe('Valid Data', () => {
        it('should validate analytics with explicit values', () => {
            // Arrange
            const input = { impressions: 500, clicks: 50, couponsUsed: 10 };

            // Act
            const result = SponsorshipAnalyticsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.impressions).toBe(500);
                expect(result.data.clicks).toBe(50);
                expect(result.data.couponsUsed).toBe(10);
            }
        });

        it('should apply default values when analytics object is empty', () => {
            // Arrange
            const input = {};

            // Act
            const result = SponsorshipAnalyticsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.impressions).toBe(0);
                expect(result.data.clicks).toBe(0);
                expect(result.data.couponsUsed).toBe(0);
            }
        });

        it('should accept zero values for all analytics fields', () => {
            // Arrange
            const input = { impressions: 0, clicks: 0, couponsUsed: 0 };

            // Act
            const result = SponsorshipAnalyticsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Invalid Data', () => {
        it('should reject negative impressions', () => {
            // Arrange
            const input = { impressions: -1, clicks: 0, couponsUsed: 0 };

            // Act
            const result = SponsorshipAnalyticsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-integer analytics values', () => {
            // Arrange
            const input = { impressions: 1.5, clicks: 0, couponsUsed: 0 };

            // Act
            const result = SponsorshipAnalyticsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

describe('SponsorshipSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid sponsorship', () => {
            // Arrange
            const validData = createValidSponsorship();

            // Act
            const result = SponsorshipSchema.safeParse(validData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should validate minimal required sponsorship data', () => {
            // Arrange
            const minimalData = createMinimalSponsorship();

            // Act
            const result = SponsorshipSchema.safeParse(minimalData);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should default status to "pending" when not provided', () => {
            // Arrange
            const data = { ...createMinimalSponsorship() };
            // biome-ignore lint/performance/noDelete: intentional for testing default
            delete (data as Record<string, unknown>).status;

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.status).toBe('pending');
            }
        });

        it('should apply analytics defaults when analytics is undefined', () => {
            // Arrange
            const data = { ...createMinimalSponsorship() };
            // biome-ignore lint/performance/noDelete: intentional for testing default
            delete (data as Record<string, unknown>).analytics;

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.analytics.impressions).toBe(0);
                expect(result.data.analytics.clicks).toBe(0);
                expect(result.data.analytics.couponsUsed).toBe(0);
            }
        });

        it('should accept all valid status enum values', () => {
            // Arrange
            const statusValues = ['pending', 'active', 'expired', 'cancelled'];

            for (const status of statusValues) {
                const data = { ...createMinimalSponsorship(), status };

                // Act
                const result = SponsorshipSchema.safeParse(data);

                // Assert
                expect(result.success, `Status "${status}" should be valid`).toBe(true);
            }
        });

        it('should accept all valid targetType enum values', () => {
            // Arrange
            const targetTypes = ['event', 'post'];

            for (const targetType of targetTypes) {
                const data = { ...createMinimalSponsorship(), targetType };

                // Act
                const result = SponsorshipSchema.safeParse(data);

                // Assert
                expect(result.success, `targetType "${targetType}" should be valid`).toBe(true);
            }
        });

        it('should coerce startsAt from string to Date', () => {
            // Arrange
            const data = {
                ...createMinimalSponsorship(),
                startsAt: '2025-01-15T10:00:00Z'
            };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startsAt).toBeInstanceOf(Date);
            }
        });

        it('should coerce endsAt from string to Date', () => {
            // Arrange
            const data = {
                ...createMinimalSponsorship(),
                endsAt: '2026-12-31T23:59:59Z'
            };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.endsAt).toBeInstanceOf(Date);
            }
        });

        it('should accept null for endsAt', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), endsAt: null };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.endsAt).toBeNull();
            }
        });

        it('should accept null for logoUrl and linkUrl', () => {
            // Arrange
            const data = {
                ...createMinimalSponsorship(),
                logoUrl: null,
                linkUrl: null
            };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept valid URL for logoUrl and linkUrl', () => {
            // Arrange
            const data = {
                ...createMinimalSponsorship(),
                logoUrl: 'https://example.com/logo.png',
                linkUrl: 'https://example.com/sponsor'
            };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept couponDiscountPercent at boundary values 0 and 100', () => {
            // Arrange
            const dataMin = { ...createMinimalSponsorship(), couponDiscountPercent: 0 };
            const dataMax = { ...createMinimalSponsorship(), couponDiscountPercent: 100 };

            // Act
            const resultMin = SponsorshipSchema.safeParse(dataMin);
            const resultMax = SponsorshipSchema.safeParse(dataMax);

            // Assert
            expect(resultMin.success).toBe(true);
            expect(resultMax.success).toBe(true);
        });

        it('should accept null for packageId', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), packageId: null };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('Invalid Data', () => {
        it('should reject missing required fields', () => {
            // Arrange
            const input = { slug: 'some-slug' };

            // Act
            const result = SponsorshipSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeInstanceOf(ZodError);
        });

        it('should reject empty slug', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), slug: '' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid status enum value', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), status: 'INVALID_STATUS' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid targetType enum value', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), targetType: 'accommodation' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-UUID targetId', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), targetId: 'not-a-uuid' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid URL for logoUrl', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), logoUrl: 'not-a-url' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject invalid URL for linkUrl', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), linkUrl: 'not-a-valid-url' };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject couponDiscountPercent below 0', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), couponDiscountPercent: -1 };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject couponDiscountPercent above 100', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), couponDiscountPercent: 101 };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject non-integer couponDiscountPercent', () => {
            // Arrange
            const data = { ...createMinimalSponsorship(), couponDiscountPercent: 50.5 };

            // Act
            const result = SponsorshipSchema.safeParse(data);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('Type Inference', () => {
        it('should infer correct types from parsed valid data', () => {
            // Arrange
            const data = createMinimalSponsorship();

            // Act
            const result = SponsorshipSchema.parse(data);

            // Assert
            expect(typeof result.id).toBe('string');
            expect(typeof result.slug).toBe('string');
            expect(typeof result.sponsorUserId).toBe('string');
            expect(typeof result.targetType).toBe('string');
            expect(typeof result.targetId).toBe('string');
            expect(result.startsAt).toBeInstanceOf(Date);
            expect(result.analytics).toBeTypeOf('object');
        });
    });
});
