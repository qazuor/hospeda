import type { PostSponsorCreateInput, PostSponsorUpdateInput } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/postSponsor/postSponsor.normalizers';
import { createActor } from '../../factories/actorFactory';

describe('postSponsor.normalizers', () => {
    const actor = createActor();

    describe('normalizeCreateInput', () => {
        it('should trim name and description', () => {
            // Arrange
            const input: PostSponsorCreateInput = {
                name: '  Sponsor Name  ',
                description: '  Some description  ',
                type: 'POST_SPONSOR'
            } as PostSponsorCreateInput;
            // Act
            const result = normalizeCreateInput(input, actor);
            // Assert
            expect(result.name).toBe('Sponsor Name');
            expect(result.description).toBe('Some description');
        });
        it('should not modify already clean input', () => {
            const input: PostSponsorCreateInput = {
                name: 'Sponsor',
                description: 'Desc',
                type: 'POST_SPONSOR'
            } as PostSponsorCreateInput;
            const result = normalizeCreateInput(input, actor);
            expect(result.name).toBe('Sponsor');
            expect(result.description).toBe('Desc');
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should trim name and description if present', () => {
            const input: PostSponsorUpdateInput = {
                name: '  Sponsor Name  ',
                description: '  Some description  '
            };
            const result = normalizeUpdateInput(input, actor);
            expect(result.name).toBe('Sponsor Name');
            expect(result.description).toBe('Some description');
        });
        it('should not fail if fields are missing', () => {
            const input: PostSponsorUpdateInput = {};
            const result = normalizeUpdateInput(input, actor);
            expect(result).toEqual({});
        });
    });
});
