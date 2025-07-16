import { describe, expect, it } from 'vitest';
import {
    normalizeCreateInput,
    normalizeUpdateInput
} from '../../../src/services/postSponsor/postSponsor.normalizers';
import type {
    CreatePostSponsorInput,
    UpdatePostSponsorInput
} from '../../../src/services/postSponsor/postSponsor.schemas';
import { createActor } from '../../factories/actorFactory';

describe('postSponsor.normalizers', () => {
    const actor = createActor();

    describe('normalizeCreateInput', () => {
        it('should trim name and description', () => {
            // Arrange
            const input: CreatePostSponsorInput = {
                name: '  Sponsor Name  ',
                description: '  Some description  ',
                type: 'POST_SPONSOR'
            } as CreatePostSponsorInput;
            // Act
            const result = normalizeCreateInput(input, actor);
            // Assert
            expect(result.name).toBe('Sponsor Name');
            expect(result.description).toBe('Some description');
        });
        it('should not modify already clean input', () => {
            const input: CreatePostSponsorInput = {
                name: 'Sponsor',
                description: 'Desc',
                type: 'POST_SPONSOR'
            } as CreatePostSponsorInput;
            const result = normalizeCreateInput(input, actor);
            expect(result.name).toBe('Sponsor');
            expect(result.description).toBe('Desc');
        });
    });

    describe('normalizeUpdateInput', () => {
        it('should trim name and description if present', () => {
            const input: UpdatePostSponsorInput = {
                name: '  Sponsor Name  ',
                description: '  Some description  '
            };
            const result = normalizeUpdateInput(input, actor);
            expect(result.name).toBe('Sponsor Name');
            expect(result.description).toBe('Some description');
        });
        it('should not fail if fields are missing', () => {
            const input: UpdatePostSponsorInput = {};
            const result = normalizeUpdateInput(input, actor);
            expect(result).toEqual({});
        });
    });
});
