import { describe, expect, it } from 'vitest';
import {
    DestinationReviewCreateInputSchema,
    DestinationReviewDeleteInputSchema,
    DestinationReviewRestoreInputSchema,
    DestinationReviewUpdateInputSchema
} from '../../../src/entities/destinationReview/destinationReview.crud.schema';

describe('DestinationReview CRUD Schemas', () => {
    const validCreateData = {
        userId: '123e4567-e89b-12d3-a456-426614174001',
        destinationId: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Amazing destination',
        content: 'This destination was incredible with breathtaking landscapes.',
        rating: {
            landscape: 5,
            attractions: 4,
            accessibility: 3,
            safety: 5,
            cleanliness: 4,
            hospitality: 5,
            culturalOffer: 4,
            gastronomy: 5,
            affordability: 3,
            nightlife: 4,
            infrastructure: 4,
            environmentalCare: 5,
            wifiAvailability: 3,
            shopping: 3,
            beaches: 4,
            greenSpaces: 5,
            localEvents: 4,
            weatherSatisfaction: 4
        }
    };

    describe('DestinationReviewCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const result = DestinationReviewCreateInputSchema.safeParse(validCreateData);
            expect(result.success).toBe(true);
        });

        it('should require userId and destinationId', () => {
            const { userId, ...withoutUserId } = validCreateData;
            const { destinationId, ...withoutDestinationId } = validCreateData;

            const resultWithoutUserId = DestinationReviewCreateInputSchema.safeParse(withoutUserId);
            const resultWithoutDestinationId =
                DestinationReviewCreateInputSchema.safeParse(withoutDestinationId);

            expect(resultWithoutUserId.success).toBe(false);
            expect(resultWithoutDestinationId.success).toBe(false);
        });

        it('should require rating', () => {
            const { rating, ...withoutRating } = validCreateData;

            const result = DestinationReviewCreateInputSchema.safeParse(withoutRating);
            expect(result.success).toBe(false);
        });

        it('should allow optional title and content', () => {
            const { title, content, ...minimalData } = validCreateData;

            const result = DestinationReviewCreateInputSchema.safeParse(minimalData);
            expect(result.success).toBe(true);
        });

        it('should not allow audit fields', () => {
            const dataWithAuditFields = {
                ...validCreateData,
                id: '123e4567-e89b-12d3-a456-426614174000',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = DestinationReviewCreateInputSchema.safeParse(dataWithAuditFields);
            expect(result.success).toBe(false);
        });
    });

    describe('DestinationReviewUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const updateData = {
                title: 'Updated title',
                content: 'Updated content with more details about the destination.'
            };

            const result = DestinationReviewUpdateInputSchema.safeParse(updateData);
            expect(result.success).toBe(true);
        });

        it('should allow partial updates', () => {
            const partialUpdate = {
                title: 'Only updating title'
            };

            const result = DestinationReviewUpdateInputSchema.safeParse(partialUpdate);
            expect(result.success).toBe(true);
        });

        it('should allow empty update object', () => {
            const emptyUpdate = {};

            const result = DestinationReviewUpdateInputSchema.safeParse(emptyUpdate);
            expect(result.success).toBe(true);
        });

        it('should not allow userId or destinationId changes', () => {
            const updateWithUserId = {
                userId: '123e4567-e89b-12d3-a456-426614174999',
                title: 'Updated title'
            };

            const updateWithDestinationId = {
                destinationId: '123e4567-e89b-12d3-a456-426614174999',
                title: 'Updated title'
            };

            const resultWithUserId = DestinationReviewUpdateInputSchema.safeParse(updateWithUserId);
            const resultWithDestinationId =
                DestinationReviewUpdateInputSchema.safeParse(updateWithDestinationId);

            expect(resultWithUserId.success).toBe(false);
            expect(resultWithDestinationId.success).toBe(false);
        });

        it('should not allow audit fields', () => {
            const updateWithAuditFields = {
                title: 'Updated title',
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = DestinationReviewUpdateInputSchema.safeParse(updateWithAuditFields);
            expect(result.success).toBe(false);
        });
    });

    describe('DestinationReviewDeleteInputSchema', () => {
        it('should validate valid delete input', () => {
            const deleteData = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = DestinationReviewDeleteInputSchema.safeParse(deleteData);
            expect(result.success).toBe(true);
        });

        it('should validate delete input with force flag', () => {
            const deleteData = {
                id: '123e4567-e89b-12d3-a456-426614174000',
                force: true
            };

            const result = DestinationReviewDeleteInputSchema.safeParse(deleteData);
            expect(result.success).toBe(true);
        });

        it('should require id', () => {
            const deleteData = {
                force: true
            };

            const result = DestinationReviewDeleteInputSchema.safeParse(deleteData);
            expect(result.success).toBe(false);
        });

        it('should default force to false', () => {
            const deleteData = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = DestinationReviewDeleteInputSchema.safeParse(deleteData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.force).toBe(false);
            }
        });
    });

    describe('DestinationReviewRestoreInputSchema', () => {
        it('should validate valid restore input', () => {
            const restoreData = {
                id: '123e4567-e89b-12d3-a456-426614174000'
            };

            const result = DestinationReviewRestoreInputSchema.safeParse(restoreData);
            expect(result.success).toBe(true);
        });

        it('should require id', () => {
            const restoreData = {};

            const result = DestinationReviewRestoreInputSchema.safeParse(restoreData);
            expect(result.success).toBe(false);
        });

        it('should validate UUID format', () => {
            const restoreData = {
                id: 'invalid-uuid'
            };

            const result = DestinationReviewRestoreInputSchema.safeParse(restoreData);
            expect(result.success).toBe(false);
        });
    });
});
