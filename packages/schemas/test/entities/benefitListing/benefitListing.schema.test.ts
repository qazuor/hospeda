import { describe, expect, it } from 'vitest';
import {
    BenefitListingSchema,
    CreateBenefitListingSchema,
    HttpCreateBenefitListingSchema,
    HttpSearchBenefitListingsSchema,
    SearchBenefitListingsSchema,
    UpdateBenefitListingSchema
} from '../../../src/entities/benefitListing/index.js';
import { ListingStatusEnum } from '../../../src/enums/listing-status.enum.js';

describe('Benefit Listing Schema', () => {
    describe('BenefitListingSchema', () => {
        it('should exist and be callable', () => {
            expect(typeof BenefitListingSchema.safeParse).toBe('function');
        });
    });

    describe('CreateBenefitListingSchema', () => {
        it('should exist and be callable', () => {
            expect(typeof CreateBenefitListingSchema.safeParse).toBe('function');
        });
    });

    describe('UpdateBenefitListingSchema', () => {
        it('should validate partial updates', () => {
            const updateData = {
                status: ListingStatusEnum.PAUSED
            };

            const result = UpdateBenefitListingSchema.safeParse(updateData);
            expect(result.success).toBe(true);
        });
    });

    describe('SearchBenefitListingsSchema', () => {
        it('should use default pagination values', () => {
            const emptySearch = {};

            const result = SearchBenefitListingsSchema.safeParse(emptySearch);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });
    });

    describe('HttpCreateBenefitListingSchema', () => {
        it('should exist and be callable', () => {
            expect(typeof HttpCreateBenefitListingSchema.safeParse).toBe('function');
        });
    });

    describe('HttpSearchBenefitListingsSchema', () => {
        it('should handle date coercion for search filters', () => {
            const httpSearchData = {
                startDateFrom: '2023-01-01T00:00:00Z',
                startDateTo: '2023-12-31T23:59:59Z'
            };

            const result = HttpSearchBenefitListingsSchema.safeParse(httpSearchData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startDateFrom).toBeInstanceOf(Date);
                expect(result.data.startDateTo).toBeInstanceOf(Date);
            }
        });
    });
});
