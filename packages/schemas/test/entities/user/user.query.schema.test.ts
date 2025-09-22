import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    UserFiltersSchema,
    UserListInputSchema,
    UserListItemSchema,
    UserListItemWithCountsSchema,
    UserListOutputSchema,
    UserListWithCountsOutputSchema,
    UserSearchInputSchema,
    UserSearchOutputSchema,
    UserSearchResultSchema,
    UserStatsSchema,
    UserSummarySchema
} from '../../../src/entities/user/user.query.schema.js';
import { createUserFixture } from '../../fixtures/user.fixtures.js';
import { createPaginatedResponse } from '../../helpers/pagination.helpers.js';

describe('User Query Schemas', () => {
    describe('UserFiltersSchema', () => {
        it('should validate empty filters', () => {
            const validFilters = {};
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should validate role filter', () => {
            const validFilters = {
                role: 'ADMIN' as any
            };
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should validate multiple filters', () => {
            const validFilters = {
                role: 'USER' as any,
                isActive: true,
                hasAccommodations: true,
                createdAfter: new Date('2024-01-01'),
                createdBefore: new Date('2024-12-31')
            };
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should validate search query', () => {
            const validFilters = {
                query: 'john doe'
            };
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should accept empty search query', () => {
            const validInput = {
                query: ''
            };
            expect(() => UserFiltersSchema.parse(validInput)).not.toThrow();
        });

        it('should validate location filters', () => {
            const validFilters = {
                country: 'AR',
                region: 'Entre Ríos',
                city: 'Paraná'
            };
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });

        it('should validate date range filters', () => {
            const validFilters = {
                lastLoginAfter: new Date('2024-01-01'),
                lastLoginBefore: new Date('2024-12-31')
            };
            expect(() => UserFiltersSchema.parse(validFilters)).not.toThrow();
        });
    });

    describe('UserListInputSchema', () => {
        it('should validate basic list input', () => {
            const validInput = {
                filters: {},
                page: 1,
                pageSize: 10
            };
            expect(() => UserListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should work with minimal input', () => {
            const validInput = {};
            expect(() => UserListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate sorting', () => {
            const validInput = {
                sorting: {
                    field: 'createdAt',
                    direction: 'desc' as const
                }
            };
            expect(() => UserListInputSchema.parse(validInput)).not.toThrow();
        });

        it('should enforce pagination limits', () => {
            const invalidInput = {
                page: 1.5, // Invalid: must be integer
                pageSize: 10
            };
            expect(() => UserListInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('UserListItemSchema', () => {
        it('should validate user list item', () => {
            const user = createUserFixture();
            expect(() => UserListItemSchema.parse(user)).not.toThrow();
        });

        it('should validate minimal user data', () => {
            const minimalUser = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                slug: 'john-doe',
                displayName: 'John Doe',
                lifecycleState: 'ACTIVE' as any,
                visibility: 'PUBLIC' as any,
                role: 'USER' as any,
                permissions: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            expect(() => UserListItemSchema.parse(minimalUser)).not.toThrow();
        });
    });

    describe('UserListOutputSchema', () => {
        it('should validate user list output', () => {
            const users = [createUserFixture(), createUserFixture()];
            const validOutput = {
                data: users,
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 3,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            expect(() => UserListOutputSchema.parse(validOutput)).not.toThrow();
        });

        it('should validate empty list', () => {
            const validOutput = {
                data: [],
                pagination: {
                    page: 1,
                    pageSize: 10,
                    total: 0,
                    totalPages: 0,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            };
            expect(() => UserListOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('UserSearchInputSchema', () => {
        it('should validate search input', () => {
            const validInput = {
                query: 'john',
                filters: {
                    role: 'USER' as any
                },
                pagination: {
                    page: 1,
                    pageSize: 20
                }
            };
            expect(() => UserSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should work without query (query is optional)', () => {
            const validInput = {
                filters: {}
            };
            expect(() => UserSearchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept empty query when provided', () => {
            const validInput = {
                query: '' // Empty string is valid
            };
            expect(() => UserSearchInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserSearchResultSchema', () => {
        it('should validate search result with score', () => {
            const user = createUserFixture();
            const validResult = createPaginatedResponse([user], 1, 10, 1);
            expect(() => UserSearchResultSchema.parse(validResult)).not.toThrow();
        });

        it('should validate result without optional fields', () => {
            const user = createUserFixture();
            const validResult = createPaginatedResponse([user]);
            expect(() => UserSearchResultSchema.parse(validResult)).not.toThrow();
        });

        it('should enforce search score range', () => {
            const user = createUserFixture();
            const invalidResult = {
                ...user,
                score: 1.5 // Exceeds maximum
            };
            expect(() => UserSearchResultSchema.parse(invalidResult)).toThrow(ZodError);
        });
    });

    describe('UserSearchOutputSchema', () => {
        it('should validate search output', () => {
            const user = createUserFixture();
            const validOutput = createPaginatedResponse([user], 1, 10, 1);
            expect(() => UserSearchOutputSchema.parse(validOutput)).not.toThrow();
        });
    });

    describe('UserSummarySchema', () => {
        it('should validate user summary', () => {
            const validSummary = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                displayName: 'John Doe',
                firstName: 'John',
                lastName: 'Doe',
                profilePicture: 'https://example.com/avatar.jpg',
                role: 'USER' as any,
                isActive: true,
                createdAt: new Date()
            };
            expect(() => UserSummarySchema.parse(validSummary)).not.toThrow();
        });

        it('should work with minimal summary data', () => {
            const validSummary = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                displayName: 'Jane Doe',
                firstName: 'Jane',
                lastName: 'Doe',
                role: 'USER' as any,
                isActive: false,
                createdAt: new Date()
            };
            expect(() => UserSummarySchema.parse(validSummary)).not.toThrow();
        });

        it('should reject invalid data', () => {
            const invalidSummary = {
                id: 'invalid-uuid', // Invalid UUID
                displayName: 'John Doe',
                firstName: 'John',
                lastName: 'Doe',
                role: 'USER' as any,
                isActive: true,
                createdAt: new Date()
            };
            expect(() => UserSummarySchema.parse(invalidSummary)).toThrow(ZodError);
        });
    });

    describe('UserStatsSchema', () => {
        it('should validate comprehensive user stats', () => {
            const validStats = {
                totalUsers: 1000,
                activeUsers: 850,
                inactiveUsers: 150,
                newUsersThisMonth: 45,
                newUsersThisWeek: 12,
                usersLoggedInToday: 234,
                usersLoggedInThisWeek: 567,
                usersWithAccommodations: 123,
                usersWithSubscriptions: 89,
                topCountries: [
                    { country: 'Argentina', userCount: 456 },
                    { country: 'Brazil', userCount: 234 }
                ]
            };
            expect(() => UserStatsSchema.parse(validStats)).not.toThrow();
        });

        it('should work with minimal stats', () => {
            const validStats = {
                totalUsers: 100,
                activeUsers: 80,
                inactiveUsers: 20
            };
            expect(() => UserStatsSchema.parse(validStats)).not.toThrow();
        });

        it('should use default values', () => {
            const input = {};
            const result = UserStatsSchema.parse(input);

            expect(result.totalUsers).toBe(0);
            expect(result.activeUsers).toBe(0);
            expect(result.verifiedUsers).toBe(0);
        });

        it('should enforce non-negative counts', () => {
            const invalidStats = {
                totalUsers: -5 // Invalid negative count
            };
            expect(() => UserStatsSchema.parse(invalidStats)).toThrow(ZodError);
        });
    });

    describe('Enhanced List Schemas', () => {
        describe('UserListItemWithCountsSchema', () => {
            it('should validate user with content counts', () => {
                const user = createUserFixture();
                const userWithCounts = {
                    ...user,
                    accommodationsCount: 5,
                    eventsCount: 3,
                    reviewsCount: 12
                };
                expect(() => UserListItemWithCountsSchema.parse(userWithCounts)).not.toThrow();
            });

            it('should work without optional counts', () => {
                const user = createUserFixture();
                expect(() => UserListItemWithCountsSchema.parse(user)).not.toThrow();
            });

            it('should enforce non-negative counts', () => {
                const user = createUserFixture();
                const invalidUser = {
                    ...user,
                    accommodationsCount: -1 // Invalid negative count
                };
                expect(() => UserListItemWithCountsSchema.parse(invalidUser)).toThrow(ZodError);
            });
        });

        describe('UserListWithCountsOutputSchema', () => {
            it('should validate list output with counts', () => {
                const user = createUserFixture();
                const userWithCounts = {
                    ...user,
                    accommodationsCount: 5,
                    eventsCount: 3,
                    reviewsCount: 12
                };
                const validOutput = createPaginatedResponse([userWithCounts], 1, 10, 1);
                expect(() => UserListWithCountsOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should validate empty list with counts', () => {
                const validOutput = {
                    data: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 0,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                };
                expect(() => UserListWithCountsOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should enforce non-negative total', () => {
                const invalidOutput = {
                    data: [],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: -1, // Invalid negative total
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                };
                expect(() => UserListWithCountsOutputSchema.parse(invalidOutput)).toThrow(ZodError);
            });
        });
    });
});
