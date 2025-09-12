import { EntityTypeEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCreateInputSchema,
    UserBookmarkCreateOutputSchema,
    UserBookmarkGetOutputSchema,
    UserBookmarkUpdateInputSchema,
    UserBookmarkUpdateOutputSchema
} from '../../../src/entities/userBookmark/userBookmark.crud.schema.js';
import {
    createUserBookmarkEdgeCases,
    createUserBookmarkFixture,
    createUserBookmarkInputFixture
} from '../../fixtures/userBookmark.fixtures.js';

describe('UserBookmark CRUD Schemas', () => {
    describe('UserBookmarkCreateInputSchema', () => {
        it('should validate valid create input', () => {
            const validInput = createUserBookmarkInputFixture();
            expect(() => UserBookmarkCreateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate create input with minimal required fields', () => {
            const minimalInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION
            };
            expect(() => UserBookmarkCreateInputSchema.parse(minimalInput)).not.toThrow();
        });

        it('should validate create input with optional fields', () => {
            const inputWithOptionals = createUserBookmarkInputFixture({
                name: 'My Favorite Bookmark',
                description: 'This is a detailed description of my bookmark'
            });
            expect(() => UserBookmarkCreateInputSchema.parse(inputWithOptionals)).not.toThrow();
        });

        it('should reject input with server-generated fields', () => {
            const invalidInput = createUserBookmarkInputFixture({
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            expect(() => UserBookmarkCreateInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid userId', () => {
            const invalidInput = createUserBookmarkInputFixture({
                userId: 'not-a-uuid'
            });
            expect(() => UserBookmarkCreateInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid entityId', () => {
            const invalidInput = createUserBookmarkInputFixture({
                entityId: 'not-a-uuid'
            });
            expect(() => UserBookmarkCreateInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid entityType', () => {
            const invalidInput = createUserBookmarkInputFixture({
                entityType: 'INVALID_TYPE'
            });
            expect(() => UserBookmarkCreateInputSchema.parse(invalidInput)).toThrow();
        });

        it('should validate name length constraints', () => {
            const edgeCases = createUserBookmarkEdgeCases();

            // Valid minimum length
            const minInput = createUserBookmarkInputFixture({
                name: edgeCases.minValues.name
            });
            expect(() => UserBookmarkCreateInputSchema.parse(minInput)).not.toThrow();

            // Valid maximum length
            const maxInput = createUserBookmarkInputFixture({
                name: edgeCases.maxValues.name
            });
            expect(() => UserBookmarkCreateInputSchema.parse(maxInput)).not.toThrow();

            // Invalid - too short
            const tooShortInput = createUserBookmarkInputFixture({
                name: edgeCases.invalidValues.nameTooShort
            });
            expect(() => UserBookmarkCreateInputSchema.parse(tooShortInput)).toThrow();

            // Invalid - too long
            const tooLongInput = createUserBookmarkInputFixture({
                name: edgeCases.invalidValues.nameTooLong
            });
            expect(() => UserBookmarkCreateInputSchema.parse(tooLongInput)).toThrow();
        });

        it('should validate description length constraints', () => {
            const edgeCases = createUserBookmarkEdgeCases();

            // Valid minimum length
            const minInput = createUserBookmarkInputFixture({
                description: edgeCases.minValues.description
            });
            expect(() => UserBookmarkCreateInputSchema.parse(minInput)).not.toThrow();

            // Valid maximum length
            const maxInput = createUserBookmarkInputFixture({
                description: edgeCases.maxValues.description
            });
            expect(() => UserBookmarkCreateInputSchema.parse(maxInput)).not.toThrow();

            // Invalid - too short
            const tooShortInput = createUserBookmarkInputFixture({
                description: edgeCases.invalidValues.descriptionTooShort
            });
            expect(() => UserBookmarkCreateInputSchema.parse(tooShortInput)).toThrow();

            // Invalid - too long
            const tooLongInput = createUserBookmarkInputFixture({
                description: edgeCases.invalidValues.descriptionTooLong
            });
            expect(() => UserBookmarkCreateInputSchema.parse(tooLongInput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const inputWithUnknownField = createUserBookmarkInputFixture({
                unknownField: 'should not be allowed'
            });
            expect(() => UserBookmarkCreateInputSchema.parse(inputWithUnknownField)).toThrow();
        });
    });

    describe('UserBookmarkUpdateInputSchema', () => {
        it('should validate valid update input', () => {
            const validInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                name: 'Updated Bookmark Name'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require identification fields', () => {
            const inputWithoutUserId = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                name: 'Updated Name'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(inputWithoutUserId)).toThrow();

            const inputWithoutEntityId = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityType: EntityTypeEnum.ACCOMMODATION,
                name: 'Updated Name'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(inputWithoutEntityId)).toThrow();

            const inputWithoutEntityType = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                name: 'Updated Name'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(inputWithoutEntityType)).toThrow();
        });

        it('should allow partial updates of optional fields', () => {
            const partialUpdate = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                name: 'Only updating the name'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(partialUpdate)).not.toThrow();
        });

        it('should reject server-generated fields', () => {
            const invalidInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                createdAt: new Date()
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const inputWithUnknownField = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                unknownField: 'should not be allowed'
            };
            expect(() => UserBookmarkUpdateInputSchema.parse(inputWithUnknownField)).toThrow();
        });
    });

    describe('UserBookmarkCreateOutputSchema', () => {
        it('should validate create output with complete bookmark', () => {
            const bookmark = createUserBookmarkFixture();
            const validOutput = { userBookmark: bookmark };
            expect(() => UserBookmarkCreateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output without userBookmark field', () => {
            const invalidOutput = { bookmark: createUserBookmarkFixture() };
            expect(() => UserBookmarkCreateOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with additional fields in strict mode', () => {
            const bookmark = createUserBookmarkFixture();
            const invalidOutput = {
                userBookmark: bookmark,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkCreateOutputSchema.parse(invalidOutput)).toThrow();
        });
    });

    describe('UserBookmarkUpdateOutputSchema', () => {
        it('should validate update output with complete bookmark', () => {
            const bookmark = createUserBookmarkFixture();
            const validOutput = { userBookmark: bookmark };
            expect(() => UserBookmarkUpdateOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output without userBookmark field', () => {
            const invalidOutput = { bookmark: createUserBookmarkFixture() };
            expect(() => UserBookmarkUpdateOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with additional fields in strict mode', () => {
            const bookmark = createUserBookmarkFixture();
            const invalidOutput = {
                userBookmark: bookmark,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkUpdateOutputSchema.parse(invalidOutput)).toThrow();
        });
    });

    describe('UserBookmarkGetOutputSchema', () => {
        it('should validate get output with complete bookmark', () => {
            const bookmark = createUserBookmarkFixture();
            const validOutput = { userBookmark: bookmark };
            expect(() => UserBookmarkGetOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output without userBookmark field', () => {
            const invalidOutput = { bookmark: createUserBookmarkFixture() };
            expect(() => UserBookmarkGetOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with additional fields in strict mode', () => {
            const bookmark = createUserBookmarkFixture();
            const invalidOutput = {
                userBookmark: bookmark,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkGetOutputSchema.parse(invalidOutput)).toThrow();
        });
    });
});
