import { PriceCurrencyEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/postSponsorship/postSponsorship.normalizers';
import type {
    CreatePostSponsorshipInput,
    UpdatePostSponsorshipInput
} from '../../../src/services/postSponsorship/postSponsorship.schemas';
import { createActor } from '../../factories/actorFactory';

describe('postSponsorship.normalizers', () => {
    const actor = createActor();

    describe('normalizeCreateInput', () => {
        it('should trim message and description', () => {
            // Arrange
            const input: CreatePostSponsorshipInput = {
                sponsorId: 'uuid-sponsor',
                postId: 'uuid-post',
                message: '  Sponsored message  ',
                description: '  Some description  ',
                paid: { price: 100, currency: PriceCurrencyEnum.USD },
                paidAt: '2024-01-01T00:00:00.000Z',
                fromDate: '2024-01-01T00:00:00.000Z',
                toDate: '2024-01-02T00:00:00.000Z',
                isHighlighted: true
            };
            // Act
            const result = normalizeCreateInput(input, actor);
            // Assert
            expect(result.message).toBe('Sponsored message');
            expect(result.description).toBe('Some description');
        });
        it('should not modify already clean input', () => {
            const input: CreatePostSponsorshipInput = {
                sponsorId: 'uuid-sponsor',
                postId: 'uuid-post',
                message: 'Message',
                description: 'Desc',
                paid: { price: 100, currency: PriceCurrencyEnum.USD }
            };
            const result = normalizeCreateInput(input, actor);
            expect(result.message).toBe('Message');
            expect(result.description).toBe('Desc');
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should trim message and description if present', () => {
            const input: UpdatePostSponsorshipInput = {
                message: '  Sponsored message  ',
                description: '  Some description  '
            };
            const result = normalizeUpdateInput(input, actor);
            expect(result.message).toBe('Sponsored message');
            expect(result.description).toBe('Some description');
        });
        it('should not fail if fields are missing', () => {
            const input: UpdatePostSponsorshipInput = {};
            const result = normalizeUpdateInput(input, actor);
            expect(result).toEqual({});
        });
    });
});
