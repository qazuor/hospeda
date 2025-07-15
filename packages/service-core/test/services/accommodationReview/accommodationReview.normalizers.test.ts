import { RoleEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/accommodationReview/accommodationReview.normalizers';
import type {
    CreateAccommodationReviewSchema,
    UpdateAccommodationReviewSchema
} from '../../../src/services/accommodationReview/accommodationReview.schemas';

const validCreateInput: z.infer<typeof CreateAccommodationReviewSchema> = {
    accommodationId: 'acc-1',
    userId: 'user-1',
    rating: {
        cleanliness: 5,
        hospitality: 4,
        services: 3,
        accuracy: 4,
        communication: 5,
        location: 4
    },
    title: 'Great stay',
    content: 'Everything was perfect.'
};

const validUpdateInput: z.infer<typeof UpdateAccommodationReviewSchema> = {
    title: 'Updated title',
    content: 'Updated content.'
};

describe('accommodationReview.normalizers', () => {
    it('normalizeCreateInput should return input as is', () => {
        const result = normalizeCreateInput(validCreateInput, {
            id: 'actor-1',
            role: RoleEnum.USER,
            permissions: []
        });
        expect(result).toEqual(validCreateInput);
    });

    it('normalizeUpdateInput should return input as is', () => {
        const result = normalizeUpdateInput(validUpdateInput, {
            id: 'actor-1',
            role: RoleEnum.USER,
            permissions: []
        });
        expect(result).toEqual(validUpdateInput);
    });
});
