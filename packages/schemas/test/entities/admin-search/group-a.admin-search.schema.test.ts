import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationAdminSearchSchema,
    DestinationAdminSearchSchema,
    EventAdminSearchSchema,
    PostAdminSearchSchema
} from '../../../src/index.js';

describe('Group A Admin Search Schemas', () => {
    describe('AccommodationAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = AccommodationAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.status).toBe('all');
            expect(result.type).toBeUndefined();
            expect(result.destinationId).toBeUndefined();
        });

        it('should accept accommodation-specific filters', () => {
            const result = AccommodationAdminSearchSchema.parse({
                type: 'HOTEL',
                destinationId: '550e8400-e29b-41d4-a716-446655440000',
                ownerId: '550e8400-e29b-41d4-a716-446655440001',
                isFeatured: true,
                minPrice: 50,
                maxPrice: 500
            });
            expect(result.type).toBe('HOTEL');
            expect(result.destinationId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.ownerId).toBe('550e8400-e29b-41d4-a716-446655440001');
            expect(result.isFeatured).toBe(true);
            expect(result.minPrice).toBe(50);
            expect(result.maxPrice).toBe(500);
        });

        it('should reject invalid UUID for destinationId', () => {
            expect(() =>
                AccommodationAdminSearchSchema.parse({ destinationId: 'invalid' })
            ).toThrow(ZodError);
        });

        it('should reject invalid accommodation type', () => {
            expect(() => AccommodationAdminSearchSchema.parse({ type: 'INVALID_TYPE' })).toThrow(
                ZodError
            );
        });

        it('should reject negative prices', () => {
            expect(() => AccommodationAdminSearchSchema.parse({ minPrice: -1 })).toThrow(ZodError);
        });
    });

    describe('DestinationAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = DestinationAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.destinationType).toBeUndefined();
            expect(result.level).toBeUndefined();
        });

        it('should accept destination-specific filters', () => {
            const result = DestinationAdminSearchSchema.parse({
                parentDestinationId: '550e8400-e29b-41d4-a716-446655440000',
                destinationType: 'CITY',
                level: 4,
                isFeatured: true
            });
            expect(result.parentDestinationId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.destinationType).toBe('CITY');
            expect(result.level).toBe(4);
        });

        it('should reject level out of range', () => {
            expect(() => DestinationAdminSearchSchema.parse({ level: 7 })).toThrow(ZodError);
            expect(() => DestinationAdminSearchSchema.parse({ level: -1 })).toThrow(ZodError);
        });
    });

    describe('EventAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = EventAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.category).toBeUndefined();
            expect(result.locationId).toBeUndefined();
        });

        it('should accept event-specific filters', () => {
            const result = EventAdminSearchSchema.parse({
                category: 'MUSIC',
                locationId: '550e8400-e29b-41d4-a716-446655440000',
                organizerId: '550e8400-e29b-41d4-a716-446655440001',
                isFeatured: true,
                startDateAfter: '2025-01-01T00:00:00.000Z',
                endDateBefore: '2025-12-31T23:59:59.999Z'
            });
            expect(result.category).toBe('MUSIC');
            expect(result.isFeatured).toBe(true);
            expect(result.startDateAfter).toBeInstanceOf(Date);
            expect(result.endDateBefore).toBeInstanceOf(Date);
        });

        it('should reject invalid event category', () => {
            expect(() => EventAdminSearchSchema.parse({ category: 'INVALID' })).toThrow(ZodError);
        });
    });

    describe('PostAdminSearchSchema', () => {
        it('should parse with only base defaults', () => {
            const result = PostAdminSearchSchema.parse({});
            expect(result.page).toBe(1);
            expect(result.category).toBeUndefined();
            expect(result.authorId).toBeUndefined();
        });

        it('should accept post-specific filters', () => {
            const result = PostAdminSearchSchema.parse({
                category: 'EVENTS',
                authorId: '550e8400-e29b-41d4-a716-446655440000',
                isFeatured: true,
                isNews: true,
                relatedDestinationId: '550e8400-e29b-41d4-a716-446655440001'
            });
            expect(result.category).toBe('EVENTS');
            expect(result.authorId).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(result.isFeatured).toBe(true);
            expect(result.isNews).toBe(true);
        });

        it('should reject invalid post category', () => {
            expect(() => PostAdminSearchSchema.parse({ category: 'INVALID' })).toThrow(ZodError);
        });
    });
});
