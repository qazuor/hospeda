import { EntityTypeEnum } from '@repo/types';
import { describe, expect, it } from 'vitest';
import {
    UserBookmarkCountByEntityInputSchema,
    UserBookmarkCountByUserInputSchema,
    UserBookmarkCountOutputSchema,
    UserBookmarkListByEntityInputSchema,
    UserBookmarkListByEntityOutputSchema,
    UserBookmarkListByUserInputSchema,
    UserBookmarkListByUserOutputSchema,
    UserBookmarkPaginatedListOutputSchema
} from '../../../src/entities/userBookmark/userBookmark.query.schema.js';
import { createUserBookmarkListFixture } from '../../fixtures/userBookmark.fixtures.js';

describe('UserBookmark Query Schemas', () => {
    describe('UserBookmarkListByUserInputSchema', () => {
        it('should validate input with userId only', () => {
            const validInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001'
            };
            expect(() => UserBookmarkListByUserInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate input with userId and pagination', () => {
            const validInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                pagination: {
                    page: 1,
                    pageSize: 20
                }
            };
            expect(() => UserBookmarkListByUserInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate input with default pagination values', () => {
            const validInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                pagination: {}
            };
            const parsed = UserBookmarkListByUserInputSchema.parse(validInput);
            expect(parsed.pagination?.page).toBe(1);
            expect(parsed.pagination?.pageSize).toBe(10);
        });

        it('should reject input with invalid userId', () => {
            const invalidInput = {
                userId: 'not-a-uuid'
            };
            expect(() => UserBookmarkListByUserInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input without userId', () => {
            const invalidInput = {
                pagination: { page: 1, pageSize: 20 }
            };
            expect(() => UserBookmarkListByUserInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid pagination values', () => {
            const invalidInputs = [
                {
                    userId: '550e8400-e29b-41d4-a716-446655440001',
                    pagination: { page: 0, pageSize: 20 }
                },
                {
                    userId: '550e8400-e29b-41d4-a716-446655440001',
                    pagination: { page: 1, pageSize: 0 }
                },
                {
                    userId: '550e8400-e29b-41d4-a716-446655440001',
                    pagination: { page: -1, pageSize: 20 }
                }
            ];

            for (const input of invalidInputs) {
                expect(() => UserBookmarkListByUserInputSchema.parse(input)).toThrow();
            }
        });

        it('should reject unknown fields in strict mode', () => {
            const invalidInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                unknownField: 'not allowed'
            };
            expect(() => UserBookmarkListByUserInputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('UserBookmarkListByEntityInputSchema', () => {
        it('should validate input with entity fields only', () => {
            const validInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION
            };
            expect(() => UserBookmarkListByEntityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate input with entity fields and pagination', () => {
            const validInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.POST,
                pagination: {
                    page: 2,
                    pageSize: 50
                }
            };
            expect(() => UserBookmarkListByEntityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate all entity types', () => {
            const entityTypes = [
                EntityTypeEnum.ACCOMMODATION,
                EntityTypeEnum.POST,
                EntityTypeEnum.EVENT,
                EntityTypeEnum.DESTINATION,
                EntityTypeEnum.USER
            ];

            for (const entityType of entityTypes) {
                const validInput = {
                    entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                    entityType
                };
                expect(() => UserBookmarkListByEntityInputSchema.parse(validInput)).not.toThrow();
            }
        });

        it('should reject input with invalid entityId', () => {
            const invalidInput = {
                entityId: 'not-a-uuid',
                entityType: EntityTypeEnum.ACCOMMODATION
            };
            expect(() => UserBookmarkListByEntityInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid entityType', () => {
            const invalidInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: 'INVALID_TYPE'
            };
            expect(() => UserBookmarkListByEntityInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input missing required fields', () => {
            const invalidInputs = [
                { entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
                { entityType: EntityTypeEnum.ACCOMMODATION },
                {}
            ];

            for (const input of invalidInputs) {
                expect(() => UserBookmarkListByEntityInputSchema.parse(input)).toThrow();
            }
        });

        it('should reject unknown fields in strict mode', () => {
            const invalidInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.ACCOMMODATION,
                unknownField: 'not allowed'
            };
            expect(() => UserBookmarkListByEntityInputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('UserBookmarkCountByEntityInputSchema', () => {
        it('should validate input with entity fields', () => {
            const validInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: EntityTypeEnum.EVENT
            };
            expect(() => UserBookmarkCountByEntityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject input with invalid entityId', () => {
            const invalidInput = {
                entityId: 'not-a-uuid',
                entityType: EntityTypeEnum.ACCOMMODATION
            };
            expect(() => UserBookmarkCountByEntityInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input with invalid entityType', () => {
            const invalidInput = {
                entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                entityType: 'INVALID_TYPE'
            };
            expect(() => UserBookmarkCountByEntityInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input missing required fields', () => {
            const invalidInputs = [
                { entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
                { entityType: EntityTypeEnum.ACCOMMODATION },
                {}
            ];

            for (const input of invalidInputs) {
                expect(() => UserBookmarkCountByEntityInputSchema.parse(input)).toThrow();
            }
        });
    });

    describe('UserBookmarkCountByUserInputSchema', () => {
        it('should validate input with userId', () => {
            const validInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001'
            };
            expect(() => UserBookmarkCountByUserInputSchema.parse(validInput)).not.toThrow();
        });

        it('should reject input with invalid userId', () => {
            const invalidInput = {
                userId: 'not-a-uuid'
            };
            expect(() => UserBookmarkCountByUserInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject input without userId', () => {
            const invalidInput = {};
            expect(() => UserBookmarkCountByUserInputSchema.parse(invalidInput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const invalidInput = {
                userId: '550e8400-e29b-41d4-a716-446655440001',
                unknownField: 'not allowed'
            };
            expect(() => UserBookmarkCountByUserInputSchema.parse(invalidInput)).toThrow();
        });
    });

    describe('UserBookmarkListByUserOutputSchema', () => {
        it('should validate output with empty bookmarks array', () => {
            const validOutput = { bookmarks: [] };
            expect(() => UserBookmarkListByUserOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate output with bookmarks array', () => {
            const bookmarks = createUserBookmarkListFixture(3);
            const validOutput = { bookmarks };
            expect(() => UserBookmarkListByUserOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output without bookmarks field', () => {
            const invalidOutput = { items: [] };
            expect(() => UserBookmarkListByUserOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with invalid bookmark objects', () => {
            const invalidOutput = {
                bookmarks: [{ invalidField: 'not a bookmark' }]
            };
            expect(() => UserBookmarkListByUserOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const bookmarks = createUserBookmarkListFixture(1);
            const invalidOutput = {
                bookmarks,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkListByUserOutputSchema.parse(invalidOutput)).toThrow();
        });
    });

    describe('UserBookmarkListByEntityOutputSchema', () => {
        it('should validate output with empty bookmarks array', () => {
            const validOutput = { bookmarks: [] };
            expect(() => UserBookmarkListByEntityOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate output with bookmarks array', () => {
            const bookmarks = createUserBookmarkListFixture(5);
            const validOutput = { bookmarks };
            expect(() => UserBookmarkListByEntityOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output without bookmarks field', () => {
            const invalidOutput = { items: [] };
            expect(() => UserBookmarkListByEntityOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const bookmarks = createUserBookmarkListFixture(2);
            const invalidOutput = {
                bookmarks,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkListByEntityOutputSchema.parse(invalidOutput)).toThrow();
        });
    });

    describe('UserBookmarkCountOutputSchema', () => {
        it('should validate output with zero count', () => {
            const validOutput = { count: 0 };
            expect(() => UserBookmarkCountOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate output with positive count', () => {
            const validOutput = { count: 42 };
            expect(() => UserBookmarkCountOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output with negative count', () => {
            const invalidOutput = { count: -1 };
            expect(() => UserBookmarkCountOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with non-integer count', () => {
            const invalidOutput = { count: 3.14 };
            expect(() => UserBookmarkCountOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with non-numeric count', () => {
            const invalidOutput = { count: '42' };
            expect(() => UserBookmarkCountOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output without count field', () => {
            const invalidOutput = { total: 42 };
            expect(() => UserBookmarkCountOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject unknown fields in strict mode', () => {
            const invalidOutput = {
                count: 42,
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkCountOutputSchema.parse(invalidOutput)).toThrow();
        });
    });

    describe('UserBookmarkPaginatedListOutputSchema', () => {
        it('should validate output with bookmarks and pagination', () => {
            const bookmarks = createUserBookmarkListFixture(3);
            const validOutput = {
                bookmarks,
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 3
                }
            };
            expect(() => UserBookmarkPaginatedListOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate output with empty bookmarks and pagination', () => {
            const validOutput = {
                bookmarks: [],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                }
            };
            expect(() => UserBookmarkPaginatedListOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should reject output missing bookmarks field', () => {
            const invalidOutput = {
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 0
                }
            };
            expect(() => UserBookmarkPaginatedListOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output missing pagination field', () => {
            const bookmarks = createUserBookmarkListFixture(2);
            const invalidOutput = { bookmarks };
            expect(() => UserBookmarkPaginatedListOutputSchema.parse(invalidOutput)).toThrow();
        });

        it('should reject output with invalid pagination values', () => {
            const bookmarks = createUserBookmarkListFixture(1);
            const invalidOutputs = [
                {
                    bookmarks,
                    pagination: { page: 0, pageSize: 20, total: 1 }
                },
                {
                    bookmarks,
                    pagination: { page: 1, pageSize: 0, total: 1 }
                },
                {
                    bookmarks,
                    pagination: { page: 1, pageSize: 20, total: -1 }
                }
            ];

            for (const output of invalidOutputs) {
                expect(() => UserBookmarkPaginatedListOutputSchema.parse(output)).toThrow();
            }
        });

        it('should reject unknown fields in strict mode', () => {
            const bookmarks = createUserBookmarkListFixture(1);
            const invalidOutput = {
                bookmarks,
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 1
                },
                extraField: 'not allowed'
            };
            expect(() => UserBookmarkPaginatedListOutputSchema.parse(invalidOutput)).toThrow();
        });
    });
});
