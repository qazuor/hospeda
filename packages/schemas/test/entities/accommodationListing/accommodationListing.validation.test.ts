import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccommodationListingBusinessValidationSchema } from '../../../src/entities/accommodationListing/accommodationListing.crud.schema.js';
import {
    createAccommodationListingWithInvalidDates,
    createAccommodationListingWithValidDates
} from '../../fixtures/accommodationListing.fixtures.js';

describe('AccommodationListingBusinessValidationSchema', () => {
    describe('Date Validation', () => {
        it('should validate when toDate is after fromDate', () => {
            const validData = createAccommodationListingWithValidDates();

            expect(() =>
                AccommodationListingBusinessValidationSchema.parse(validData)
            ).not.toThrow();
        });

        it('should reject when toDate is before fromDate', () => {
            const invalidData = createAccommodationListingWithInvalidDates();

            expect(() => AccommodationListingBusinessValidationSchema.parse(invalidData)).toThrow(
                ZodError
            );

            try {
                AccommodationListingBusinessValidationSchema.parse(invalidData);
            } catch (error) {
                if (error instanceof ZodError) {
                    expect(error.issues).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                path: ['toDate'],
                                message: 'zodError.accommodationListing.toDate.mustBeAfterFromDate'
                            })
                        ])
                    );
                }
            }
        });
    });

    describe('Trial Validation', () => {
        it('should validate trial listing with trialEndsAt', () => {
            const validTrialData = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                fromDate: new Date().toISOString(),
                toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                isTrial: true,
                trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };

            expect(() =>
                AccommodationListingBusinessValidationSchema.parse(validTrialData)
            ).not.toThrow();
        });

        it('should reject trial listing without trialEndsAt', () => {
            const invalidTrialData = {
                id: '550e8400-e29b-41d4-a716-446655440001',
                fromDate: new Date().toISOString(),
                toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                isTrial: true,
                trialEndsAt: undefined
            };

            expect(() =>
                AccommodationListingBusinessValidationSchema.parse(invalidTrialData)
            ).toThrow(ZodError);

            try {
                AccommodationListingBusinessValidationSchema.parse(invalidTrialData);
            } catch (error) {
                if (error instanceof ZodError) {
                    expect(error.issues).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                path: ['trialEndsAt'],
                                message:
                                    'zodError.accommodationListing.trialEndsAt.requiredForTrial'
                            })
                        ])
                    );
                }
            }
        });

        it('should validate non-trial listing without trialEndsAt', () => {
            const validNonTrialData = {
                id: '550e8400-e29b-41d4-a716-446655440002',
                fromDate: new Date().toISOString(),
                toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                isTrial: false,
                trialEndsAt: undefined
            };

            expect(() =>
                AccommodationListingBusinessValidationSchema.parse(validNonTrialData)
            ).not.toThrow();
        });
    });

    describe('Combined Validations', () => {
        it('should validate when both date and trial validations pass', () => {
            const validData = {
                id: '550e8400-e29b-41d4-a716-446655440003',
                fromDate: new Date().toISOString(),
                toDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                isTrial: true,
                trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };

            expect(() =>
                AccommodationListingBusinessValidationSchema.parse(validData)
            ).not.toThrow();
        });

        it('should reject when multiple validations fail', () => {
            const invalidData = {
                id: 'valid-uuid-here',
                fromDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                toDate: new Date().toISOString(), // toDate before fromDate
                isTrial: true,
                trialEndsAt: undefined // missing trialEndsAt for trial
            };

            expect(() => AccommodationListingBusinessValidationSchema.parse(invalidData)).toThrow(
                ZodError
            );

            try {
                AccommodationListingBusinessValidationSchema.parse(invalidData);
            } catch (error) {
                if (error instanceof ZodError) {
                    expect(error.issues.length).toBeGreaterThanOrEqual(2);
                }
            }
        });
    });
});
