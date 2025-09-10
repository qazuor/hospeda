import { describe, expect, it } from 'vitest';
import {
    AccommodationReviewCreateInputSchema,
    AccommodationReviewCreateOutputSchema,
    AccommodationReviewDeleteInputSchema,
    AccommodationReviewDeleteOutputSchema,
    AccommodationReviewPatchInputSchema,
    AccommodationReviewRestoreInputSchema,
    AccommodationReviewRestoreOutputSchema,
    AccommodationReviewUpdateInputSchema,
    AccommodationReviewUpdateOutputSchema
} from '../../../src/entities/accommodationReview/accommodationReview.crud.schema.js';

describe('AccommodationReview CRUD Schemas', () => {
    describe('AccommodationReviewCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                title: 'Great place!',
                content: 'This accommodation was amazing and exceeded all expectations.',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject input with missing required fields', () => {
            const invalidInput = {
                title: 'Great place!',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should reject input with invalid rating values', () => {
            const invalidInput = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                rating: {
                    cleanliness: 6, // Invalid: should be 1-5
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });

        it('should ignore auto-generated fields (they are omitted from schema)', () => {
            const inputWithAutoFields = {
                id: '123e4567-e89b-12d3-a456-426614174002', // Should be ignored
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                createdAt: new Date(), // Should be ignored
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(inputWithAutoFields);
            expect(result.success).toBe(true);
            // Verify that auto-generated fields are not in the result
            if (result.success) {
                expect(result.data).not.toHaveProperty('id');
                expect(result.data).not.toHaveProperty('createdAt');
            }
        });
    });

    describe('AccommodationReviewUpdateInputSchema', () => {
        it('should validate partial update input', () => {
            const validInput = {
                title: 'Updated title',
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 4,
                    accuracy: 5,
                    communication: 4,
                    location: 5
                }
            };

            const result = AccommodationReviewUpdateInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should validate empty update input', () => {
            const result = AccommodationReviewUpdateInputSchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should ignore auto-generated fields (they are omitted from schema)', () => {
            const inputWithAutoFields = {
                id: '123e4567-e89b-12d3-a456-426614174002', // Should be ignored
                title: 'Updated title',
                createdAt: new Date() // Should be ignored
            };

            const result = AccommodationReviewUpdateInputSchema.safeParse(inputWithAutoFields);
            expect(result.success).toBe(true);
            // Verify that auto-generated fields are not in the result
            if (result.success) {
                expect(result.data).not.toHaveProperty('id');
                expect(result.data).not.toHaveProperty('createdAt');
            }
        });
    });

    describe('AccommodationReviewPatchInputSchema', () => {
        it('should be identical to update schema', () => {
            const input = {
                title: 'Patched title'
            };

            const updateResult = AccommodationReviewUpdateInputSchema.safeParse(input);
            const patchResult = AccommodationReviewPatchInputSchema.safeParse(input);

            expect(updateResult.success).toBe(patchResult.success);
        });
    });

    describe('AccommodationReviewDeleteInputSchema', () => {
        it('should validate delete input with ID', () => {
            const validInput = {
                id: '123e4567-e89b-12d3-a456-426614174002'
            };

            const result = AccommodationReviewDeleteInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should validate delete input with force flag', () => {
            const validInput = {
                id: '123e4567-e89b-12d3-a456-426614174002',
                force: true
            };

            const result = AccommodationReviewDeleteInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should default force to false', () => {
            const input = {
                id: '123e4567-e89b-12d3-a456-426614174002'
            };

            const result = AccommodationReviewDeleteInputSchema.parse(input);
            expect(result.force).toBe(false);
        });

        it('should reject input without ID', () => {
            const invalidInput = {
                force: true
            };

            const result = AccommodationReviewDeleteInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('AccommodationReviewDeleteOutputSchema', () => {
        it('should validate delete output with success', () => {
            const validOutput = {
                success: true,
                deletedAt: new Date()
            };

            const result = AccommodationReviewDeleteOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });

        it('should validate delete output without deletedAt', () => {
            const validOutput = {
                success: true
            };

            const result = AccommodationReviewDeleteOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });

        it('should default success to true', () => {
            const input = {};

            const result = AccommodationReviewDeleteOutputSchema.parse(input);
            expect(result.success).toBe(true);
        });
    });

    describe('AccommodationReviewRestoreInputSchema', () => {
        it('should validate restore input with ID', () => {
            const validInput = {
                id: '123e4567-e89b-12d3-a456-426614174002'
            };

            const result = AccommodationReviewRestoreInputSchema.safeParse(validInput);
            expect(result.success).toBe(true);
        });

        it('should reject input without ID', () => {
            const invalidInput = {};

            const result = AccommodationReviewRestoreInputSchema.safeParse(invalidInput);
            expect(result.success).toBe(false);
        });
    });

    describe('Output Schemas', () => {
        it('should validate create output', () => {
            const validOutput = {
                id: '123e4567-e89b-12d3-a456-426614174002',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                title: 'Great place!',
                content: 'This accommodation was amazing.',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                deletedAt: null,
                adminInfo: {
                    notes: 'Great review from verified guest',
                    favorite: false
                }
            };

            const result = AccommodationReviewCreateOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });

        it('should validate update output', () => {
            const validOutput = {
                id: '123e4567-e89b-12d3-a456-426614174002',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                title: 'Updated title',
                content: 'Updated content.',
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 4,
                    accuracy: 5,
                    communication: 4,
                    location: 5
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                deletedAt: null,
                adminInfo: {
                    notes: 'Updated review from verified guest',
                    favorite: true
                }
            };

            const result = AccommodationReviewUpdateOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });

        it('should validate restore output', () => {
            const validOutput = {
                id: '123e4567-e89b-12d3-a456-426614174002',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                title: 'Restored review',
                content: 'This review was restored.',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                deletedAt: null,
                adminInfo: {
                    notes: 'Restored review from verified guest',
                    favorite: false
                }
            };

            const result = AccommodationReviewRestoreOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
        });
    });
});
