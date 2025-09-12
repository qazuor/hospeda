import type { PostSponsorshipCreateInput, PostSponsorshipUpdateInput } from '@repo/schemas';
import { PriceCurrencyEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/postSponsorship/postSponsorship.normalizers';
import { createActor } from '../../factories/actorFactory';
import { getMockPostSponsorId } from '../../factories/postSponsorFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('postSponsorship.normalizers', () => {
    const actor = createActor();

    describe('normalizeCreateInput', () => {
        it('should trim message and description', () => {
            // Arrange
            const input: PostSponsorshipCreateInput = {
                sponsorId: getMockPostSponsorId('sponsor-1'),
                postId: getMockId('post', 'post-1') as any,
                message: '  Sponsored message  ',
                description: '  Some description  ',
                paid: { price: 100, currency: PriceCurrencyEnum.USD },
                paidAt: new Date('2024-01-01T00:00:00.000Z'),
                fromDate: new Date('2024-01-01T00:00:00.000Z'),
                toDate: new Date('2024-01-02T00:00:00.000Z'),
                isHighlighted: true
            };
            // Act
            const result = normalizeCreateInput(input, actor);
            // Assert
            expect(result.message).toBe('Sponsored message');
            expect(result.description).toBe('Some description');
        });
        it('should not modify already clean input', () => {
            const input: PostSponsorshipCreateInput = {
                sponsorId: getMockPostSponsorId('sponsor-2'),
                postId: getMockId('post', 'post-2') as any,
                message: 'Message',
                description: 'Desc',
                paid: { price: 100, currency: PriceCurrencyEnum.USD },
                isHighlighted: false
            };
            const result = normalizeCreateInput(input, actor);
            expect(result.message).toBe('Message');
            expect(result.description).toBe('Desc');
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should trim message and description if present', () => {
            const input: PostSponsorshipUpdateInput = {
                message: '  Sponsored message  ',
                description: '  Some description  '
            };
            const result = normalizeUpdateInput(input, actor);
            expect(result.message).toBe('Sponsored message');
            expect(result.description).toBe('Some description');
        });
        it('should not fail if fields are missing', () => {
            const input: PostSponsorshipUpdateInput = {};
            const result = normalizeUpdateInput(input, actor);
            expect(result).toEqual({});
        });
    });
});
