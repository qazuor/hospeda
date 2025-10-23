import { describe, expect, it } from 'vitest';
import {
    FeaturedStatusEnum,
    FeaturedStatusSchema,
    FeaturedTypeEnum,
    FeaturedTypeSchema,
    SponsorshipEntityTypeEnum,
    SponsorshipEntityTypeSchema,
    SponsorshipStatusEnum,
    SponsorshipStatusSchema
} from '../../src/enums';

describe('Sponsorships and Featured Enums Integration', () => {
    describe('enums can be imported from main index', () => {
        it('should import SponsorshipEntityTypeEnum', () => {
            expect(SponsorshipEntityTypeEnum.POST).toBe('POST');
            expect(SponsorshipEntityTypeEnum.EVENT).toBe('EVENT');
        });

        it('should import SponsorshipStatusEnum', () => {
            expect(SponsorshipStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(SponsorshipStatusEnum.PAUSED).toBe('PAUSED');
            expect(SponsorshipStatusEnum.EXPIRED).toBe('EXPIRED');
            expect(SponsorshipStatusEnum.CANCELLED).toBe('CANCELLED');
        });

        it('should import FeaturedTypeEnum', () => {
            expect(FeaturedTypeEnum.HOME).toBe('HOME');
            expect(FeaturedTypeEnum.DESTINATION).toBe('DESTINATION');
            expect(FeaturedTypeEnum.SEARCH).toBe('SEARCH');
            expect(FeaturedTypeEnum.OTHER).toBe('OTHER');
        });

        it('should import FeaturedStatusEnum', () => {
            expect(FeaturedStatusEnum.ACTIVE).toBe('ACTIVE');
            expect(FeaturedStatusEnum.PAUSED).toBe('PAUSED');
            expect(FeaturedStatusEnum.EXPIRED).toBe('EXPIRED');
            expect(FeaturedStatusEnum.CANCELLED).toBe('CANCELLED');
        });
    });

    describe('schemas can validate enum values', () => {
        it('should validate sponsorship entity types', () => {
            const entityTypes = ['POST', 'EVENT'];
            for (const type of entityTypes) {
                expect(SponsorshipEntityTypeSchema.parse(type)).toBe(type);
            }
        });

        it('should validate sponsorship status workflow', () => {
            // Valid sponsorship progression
            expect(SponsorshipStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(SponsorshipStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(SponsorshipStatusSchema.parse('EXPIRED')).toBe('EXPIRED');
            expect(SponsorshipStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });

        it('should validate featured types', () => {
            const featuredTypes = ['HOME', 'DESTINATION', 'SEARCH', 'OTHER'];
            for (const type of featuredTypes) {
                expect(FeaturedTypeSchema.parse(type)).toBe(type);
            }
        });

        it('should validate featured status workflow', () => {
            // Valid featured status progression
            expect(FeaturedStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(FeaturedStatusSchema.parse('PAUSED')).toBe('PAUSED');
            expect(FeaturedStatusSchema.parse('EXPIRED')).toBe('EXPIRED');
            expect(FeaturedStatusSchema.parse('CANCELLED')).toBe('CANCELLED');
        });
    });

    describe('business logic validations', () => {
        it('should have identical status enums for sponsorship and featured', () => {
            // Both share same status lifecycle
            expect(SponsorshipStatusEnum.ACTIVE).toBe(FeaturedStatusEnum.ACTIVE);
            expect(SponsorshipStatusEnum.PAUSED).toBe(FeaturedStatusEnum.PAUSED);
            expect(SponsorshipStatusEnum.EXPIRED).toBe(FeaturedStatusEnum.EXPIRED);
            expect(SponsorshipStatusEnum.CANCELLED).toBe(FeaturedStatusEnum.CANCELLED);
        });

        it('should validate sponsorship can target different entity types', () => {
            expect(SponsorshipEntityTypeEnum.POST).toBe('POST');
            expect(SponsorshipEntityTypeEnum.EVENT).toBe('EVENT');
        });

        it('should validate featured content can appear in different locations', () => {
            expect(FeaturedTypeEnum.HOME).toBe('HOME');
            expect(FeaturedTypeEnum.DESTINATION).toBe('DESTINATION');
            expect(FeaturedTypeEnum.SEARCH).toBe('SEARCH');
            expect(FeaturedTypeEnum.OTHER).toBe('OTHER');
        });

        it('should support same status operations for both sponsorship and featured', () => {
            const commonStatuses = ['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'];

            for (const status of commonStatuses) {
                expect(SponsorshipStatusSchema.parse(status)).toBe(status);
                expect(FeaturedStatusSchema.parse(status)).toBe(status);
            }
        });
    });

    describe('enum completeness', () => {
        it('should have correct number of values in each enum', () => {
            expect(Object.values(SponsorshipEntityTypeEnum)).toHaveLength(2);
            expect(Object.values(SponsorshipStatusEnum)).toHaveLength(4);
            expect(Object.values(FeaturedTypeEnum)).toHaveLength(4);
            expect(Object.values(FeaturedStatusEnum)).toHaveLength(4);
        });

        it('should validate that all enum values are strings', () => {
            for (const value of Object.values(SponsorshipEntityTypeEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(SponsorshipStatusEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(FeaturedTypeEnum)) {
                expect(typeof value).toBe('string');
            }
            for (const value of Object.values(FeaturedStatusEnum)) {
                expect(typeof value).toBe('string');
            }
        });
    });

    describe('cross-domain validations', () => {
        it('should support combined sponsorship and featured logic', () => {
            // A sponsored POST can be featured on HOME page
            expect(SponsorshipEntityTypeSchema.parse('POST')).toBe('POST');
            expect(FeaturedTypeSchema.parse('HOME')).toBe('HOME');
            expect(SponsorshipStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
            expect(FeaturedStatusSchema.parse('ACTIVE')).toBe('ACTIVE');
        });

        it('should support sponsored events featured in destination pages', () => {
            // A sponsored EVENT can be featured on DESTINATION page
            expect(SponsorshipEntityTypeSchema.parse('EVENT')).toBe('EVENT');
            expect(FeaturedTypeSchema.parse('DESTINATION')).toBe('DESTINATION');
        });
    });
});
