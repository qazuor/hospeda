import { describe, expect, it } from 'vitest';
import {
    AccommodationReviewCreateBodySchema,
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
import { ModerationStatusEnum } from '../../../src/enums/moderation-status.enum.js';

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

        it('should omit averageRating (computed field, not user-settable)', () => {
            const inputWithAvgRating = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                averageRating: 4.5, // Should be ignored
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(inputWithAvgRating);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty('averageRating');
            }
        });

        it('should allow lifecycleState in create input', () => {
            const inputWithLifecycle = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                lifecycleState: 'ARCHIVED',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(inputWithLifecycle);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe('ARCHIVED');
            }
        });

        it('should default lifecycleState to ACTIVE when omitted on create', () => {
            const inputWithoutLifecycle = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result = AccommodationReviewCreateInputSchema.safeParse(inputWithoutLifecycle);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe('ACTIVE');
            }
        });

        it('should reject invalid lifecycleState on create', () => {
            const inputWithInvalidLifecycle = {
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                lifecycleState: 'PUBLISHED',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                }
            };

            const result =
                AccommodationReviewCreateInputSchema.safeParse(inputWithInvalidLifecycle);
            expect(result.success).toBe(false);
        });
    });

    // ===========================================================================
    // AccommodationReviewCreateBodySchema (strict HTTP boundary)
    // ===========================================================================

    describe('AccommodationReviewCreateBodySchema', () => {
        const validRating = {
            cleanliness: 5,
            hospitality: 4,
            services: 5,
            accuracy: 4,
            communication: 5,
            location: 4
        };

        it('accepts a rating-only payload', () => {
            const result = AccommodationReviewCreateBodySchema.safeParse({ rating: validRating });
            expect(result.success).toBe(true);
        });

        it('accepts optional title and content alongside rating', () => {
            const result = AccommodationReviewCreateBodySchema.safeParse({
                rating: validRating,
                title: 'Great place!',
                content: 'This accommodation was amazing and exceeded all expectations.'
            });
            expect(result.success).toBe(true);
        });

        it('REJECTS a body containing userId (strict schema)', () => {
            // userId must come from the actor, never from the client body
            const result = AccommodationReviewCreateBodySchema.safeParse({
                rating: validRating,
                userId: '123e4567-e89b-12d3-a456-426614174001'
            });
            expect(result.success).toBe(false);
        });

        it('REJECTS a body containing accommodationId (strict schema)', () => {
            // accommodationId comes from the URL path, not the body
            const result = AccommodationReviewCreateBodySchema.safeParse({
                rating: validRating,
                accommodationId: '123e4567-e89b-12d3-a456-426614174002'
            });
            expect(result.success).toBe(false);
        });

        it('REJECTS a body containing arbitrary unknown fields (strict schema)', () => {
            const result = AccommodationReviewCreateBodySchema.safeParse({
                rating: validRating,
                moderationState: 'APPROVED'
            });
            expect(result.success).toBe(false);
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

        it('should REJECT auto-generated fields when passed as input (strict mode, T-017)', () => {
            // SPEC-063-gaps T-017 (GAP-016): .strict() changes the semantics from
            // "silently drop unknown keys" to "reject with validation error", so
            // the route boundary returns a 400 VALIDATION_ERROR instead of quietly
            // ignoring the attacker's payload.
            const inputWithAutoFields = {
                id: '123e4567-e89b-12d3-a456-426614174002', // omit() + .strict() → rejected
                title: 'Updated title',
                createdAt: new Date() // omit() + .strict() → rejected
            };

            const result = AccommodationReviewUpdateInputSchema.safeParse(inputWithAutoFields);
            expect(result.success).toBe(false);
        });

        it('should accept lifecycleState in update input', () => {
            const result = AccommodationReviewUpdateInputSchema.safeParse({
                lifecycleState: 'ARCHIVED'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.lifecycleState).toBe('ARCHIVED');
            }
        });

        it('should reject invalid lifecycleState in update input', () => {
            const result = AccommodationReviewUpdateInputSchema.safeParse({
                lifecycleState: 'DELETED'
            });
            expect(result.success).toBe(false);
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
                averageRating: 4.5,
                lifecycleState: 'ACTIVE',
                moderationState: ModerationStatusEnum.APPROVED,
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
                averageRating: 4.5,
                lifecycleState: 'ACTIVE',
                moderationState: ModerationStatusEnum.APPROVED,
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
                averageRating: 4.5,
                lifecycleState: 'ACTIVE',
                moderationState: ModerationStatusEnum.APPROVED,
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

        it('should validate create output with averageRating defaulting to 0', () => {
            const validOutput = {
                id: '123e4567-e89b-12d3-a456-426614174002',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                accommodationId: '123e4567-e89b-12d3-a456-426614174001',
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                },
                lifecycleState: 'ACTIVE',
                moderationState: ModerationStatusEnum.APPROVED,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdById: '123e4567-e89b-12d3-a456-426614174003',
                updatedById: '123e4567-e89b-12d3-a456-426614174003',
                deletedAt: null
            };

            const result = AccommodationReviewCreateOutputSchema.safeParse(validOutput);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.averageRating).toBe(0);
            }
        });
    });
});
