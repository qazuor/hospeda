import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    EventLocationAdminSearchSchema,
    EventOrganizerAdminSearchSchema,
    OwnerPromotionAdminSearchSchema,
    PostSponsorAdminSearchSchema
} from '../../../src/index.js';

describe('Group C Admin Search Schemas', () => {
    describe('PostSponsorAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = PostSponsorAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.status).toBe('all');
            expect(result.type).toBeUndefined();
        });

        it('should accept sponsor-specific filters', () => {
            const result = PostSponsorAdminSearchSchema.parse({
                type: 'POST_SPONSOR',
                search: 'acme'
            });
            expect(result.type).toBe('POST_SPONSOR');
            expect(result.search).toBe('acme');
        });

        it('should accept ADVERTISER client type', () => {
            const result = PostSponsorAdminSearchSchema.parse({ type: 'ADVERTISER' });
            expect(result.type).toBe('ADVERTISER');
        });

        it('should accept HOST client type', () => {
            const result = PostSponsorAdminSearchSchema.parse({ type: 'HOST' });
            expect(result.type).toBe('HOST');
        });

        it('should reject invalid client type', () => {
            expect(() => PostSponsorAdminSearchSchema.parse({ type: 'INVALID' })).toThrow(ZodError);
        });
    });

    describe('EventLocationAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = EventLocationAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.city).toBeUndefined();
            expect(result.minCapacity).toBeUndefined();
        });

        it('should accept location-specific filters', () => {
            const result = EventLocationAdminSearchSchema.parse({
                city: 'Buenos Aires',
                minCapacity: 50,
                maxCapacity: 500,
                isVerified: true
            });
            expect(result.city).toBe('Buenos Aires');
            expect(result.minCapacity).toBe(50);
            expect(result.maxCapacity).toBe(500);
            expect(result.isVerified).toBe(true);
        });

        it('should coerce string numbers for capacity', () => {
            const result = EventLocationAdminSearchSchema.parse({
                minCapacity: '10',
                maxCapacity: '200'
            });
            expect(result.minCapacity).toBe(10);
            expect(result.maxCapacity).toBe(200);
        });

        it('should coerce string boolean for isVerified', () => {
            const result = EventLocationAdminSearchSchema.parse({ isVerified: 'true' });
            expect(result.isVerified).toBe(true);
        });

        it('should reject capacity less than 1', () => {
            expect(() => EventLocationAdminSearchSchema.parse({ minCapacity: 0 })).toThrow(
                ZodError
            );
        });

        it('should reject negative maxCapacity', () => {
            expect(() => EventLocationAdminSearchSchema.parse({ maxCapacity: -5 })).toThrow(
                ZodError
            );
        });
    });

    describe('EventOrganizerAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = EventOrganizerAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.isVerified).toBeUndefined();
        });

        it('should accept organizer-specific filters', () => {
            const result = EventOrganizerAdminSearchSchema.parse({
                isVerified: true,
                search: 'john'
            });
            expect(result.isVerified).toBe(true);
            expect(result.search).toBe('john');
        });

        it('should coerce string "false" to true via z.coerce.boolean', () => {
            // z.coerce.boolean() uses Boolean() coercion: any non-empty string is true
            const result = EventOrganizerAdminSearchSchema.parse({ isVerified: 'false' });
            expect(result.isVerified).toBe(true);
        });
    });

    describe('OwnerPromotionAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.accommodationId).toBeUndefined();
            expect(result.discountType).toBeUndefined();
        });

        it('should accept promotion-specific filters', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({
                accommodationId: '550e8400-e29b-41d4-a716-446655440000',
                ownerId: '550e8400-e29b-41d4-a716-446655440001',
                isActive: true
            });
            expect(result.accommodationId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.ownerId).toBe('550e8400-e29b-41d4-a716-446655440001');
            expect(result.isActive).toBe(true);
        });

        it('should accept percentage discount type', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({ discountType: 'percentage' });
            expect(result.discountType).toBe('percentage');
        });

        it('should accept fixed discount type', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({ discountType: 'fixed' });
            expect(result.discountType).toBe('fixed');
        });

        it('should accept free_night discount type', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({ discountType: 'free_night' });
            expect(result.discountType).toBe('free_night');
        });

        it('should reject invalid discount type', () => {
            expect(() =>
                OwnerPromotionAdminSearchSchema.parse({ discountType: 'INVALID' })
            ).toThrow(ZodError);
        });

        it('should reject invalid UUID for accommodationId', () => {
            expect(() =>
                OwnerPromotionAdminSearchSchema.parse({ accommodationId: 'invalid' })
            ).toThrow(ZodError);
        });

        it('should reject invalid UUID for ownerId', () => {
            expect(() => OwnerPromotionAdminSearchSchema.parse({ ownerId: 'not-a-uuid' })).toThrow(
                ZodError
            );
        });

        it('should coerce string boolean for isActive', () => {
            const result = OwnerPromotionAdminSearchSchema.parse({ isActive: 'true' });
            expect(result.isActive).toBe(true);
        });
    });
});
