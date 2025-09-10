import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    AccommodationTypeEnumSchema,
    LifecycleStatusEnumSchema,
    ModerationStatusEnumSchema,
    PermissionEnumSchema,
    PostCategoryEnumSchema,
    PreferredContactEnumSchema,
    PriceCurrencyEnumSchema,
    RoleEnumSchema,
    VisibilityEnumSchema
} from '../../src/enums/index.js';

describe('Enum Schemas', () => {
    describe('AccommodationTypeEnumSchema', () => {
        it('should accept all valid accommodation types', () => {
            const validTypes = [
                'HOTEL',
                'CABIN',
                'HOSTEL',
                'APARTMENT',
                'HOUSE',
                'MOTEL',
                'RESORT'
            ];

            for (const type of validTypes) {
                expect(() => AccommodationTypeEnumSchema.parse(type)).not.toThrow();
            }
        });

        it('should reject invalid accommodation types', () => {
            const invalidTypes = ['MANSION', 'CASTLE', 'invalid', '', null, undefined];

            for (const type of invalidTypes) {
                expect(() => AccommodationTypeEnumSchema.parse(type)).toThrow(ZodError);
            }
        });
    });

    describe('PostCategoryEnumSchema', () => {
        it('should accept all valid post categories', () => {
            const validCategories = [
                'EVENTS',
                'CULTURE',
                'GASTRONOMY',
                'NATURE',
                'TOURISM',
                'GENERAL',
                'SPORT',
                'CARNIVAL',
                'NIGHTLIFE',
                'HISTORY',
                'TRADITIONS',
                'WELLNESS',
                'FAMILY',
                'TIPS',
                'ART',
                'BEACH',
                'RURAL',
                'FESTIVALS'
            ];

            for (const category of validCategories) {
                expect(() => PostCategoryEnumSchema.parse(category)).not.toThrow();
            }
        });

        it('should reject invalid post categories', () => {
            const invalidCategories = [
                'TRAVEL',
                'FOOD',
                'ADVENTURE',
                'invalid',
                '',
                null,
                undefined
            ];

            for (const category of invalidCategories) {
                expect(() => PostCategoryEnumSchema.parse(category)).toThrow(ZodError);
            }
        });
    });

    describe('RoleEnumSchema', () => {
        it('should accept all valid roles', () => {
            const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN', 'GUEST'];

            for (const role of validRoles) {
                expect(() => RoleEnumSchema.parse(role)).not.toThrow();
            }
        });

        it('should reject invalid roles', () => {
            const invalidRoles = ['MODERATOR', 'CUSTOMER', 'OWNER', 'invalid', '', null, undefined];

            for (const role of invalidRoles) {
                expect(() => RoleEnumSchema.parse(role)).toThrow(ZodError);
            }
        });
    });

    describe('PermissionEnumSchema', () => {
        it('should accept valid permission formats', () => {
            const validPermissions = [
                'user.read.all',
                'user.create',
                'user.update.roles',
                'user.delete',
                'user.hardDelete',
                'accommodation.view.private',
                'accommodation.create',
                'accommodation.update.any',
                'accommodation.delete.any',
                'post.create',
                'post.update',
                'post.delete',
                'destination.create',
                'destination.update',
                'system.maintenanceMode',
                'access.panelAdmin'
            ];

            for (const permission of validPermissions) {
                expect(() => PermissionEnumSchema.parse(permission)).not.toThrow();
            }
        });

        it('should reject invalid permission formats', () => {
            const invalidPermissions = [
                'SYSTEM_ADMIN', // Old format
                'USER_VIEW', // Old format
                'invalid.permission',
                'user.invalid.action',
                '',
                null,
                undefined
            ];

            for (const permission of invalidPermissions) {
                expect(() => PermissionEnumSchema.parse(permission)).toThrow(ZodError);
            }
        });
    });

    describe('VisibilityEnumSchema', () => {
        it('should accept all valid visibility values', () => {
            const validVisibilities = ['PUBLIC', 'PRIVATE', 'RESTRICTED'];

            for (const visibility of validVisibilities) {
                expect(() => VisibilityEnumSchema.parse(visibility)).not.toThrow();
            }
        });

        it('should reject invalid visibility values', () => {
            const invalidVisibilities = ['UNLISTED', 'HIDDEN', 'invalid', '', null, undefined];

            for (const visibility of invalidVisibilities) {
                expect(() => VisibilityEnumSchema.parse(visibility)).toThrow(ZodError);
            }
        });
    });

    describe('LifecycleStatusEnumSchema', () => {
        it('should accept all valid lifecycle statuses', () => {
            const validStatuses = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

            for (const status of validStatuses) {
                expect(() => LifecycleStatusEnumSchema.parse(status)).not.toThrow();
            }
        });

        it('should reject invalid lifecycle statuses', () => {
            const invalidStatuses = [
                'PENDING',
                'DELETED',
                'SUSPENDED',
                'invalid',
                '',
                null,
                undefined
            ];

            for (const status of invalidStatuses) {
                expect(() => LifecycleStatusEnumSchema.parse(status)).toThrow(ZodError);
            }
        });
    });

    describe('ModerationStatusEnumSchema', () => {
        it('should accept all valid moderation statuses', () => {
            const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];

            for (const status of validStatuses) {
                expect(() => ModerationStatusEnumSchema.parse(status)).not.toThrow();
            }
        });

        it('should reject invalid moderation statuses', () => {
            const invalidStatuses = ['DRAFT', 'ACTIVE', 'BANNED', 'invalid', '', null, undefined];

            for (const status of invalidStatuses) {
                expect(() => ModerationStatusEnumSchema.parse(status)).toThrow(ZodError);
            }
        });
    });

    describe('PriceCurrencyEnumSchema', () => {
        it('should accept all valid currencies', () => {
            const validCurrencies = ['USD', 'ARS'];

            for (const currency of validCurrencies) {
                expect(() => PriceCurrencyEnumSchema.parse(currency)).not.toThrow();
            }
        });

        it('should reject invalid currencies', () => {
            const invalidCurrencies = ['EUR', 'GBP', 'BRL', 'invalid', '', null, undefined];

            for (const currency of invalidCurrencies) {
                expect(() => PriceCurrencyEnumSchema.parse(currency)).toThrow(ZodError);
            }
        });
    });

    describe('PreferredContactEnumSchema', () => {
        it('should accept all valid contact preferences', () => {
            const validPreferences = ['HOME', 'WORK', 'MOBILE'];

            for (const preference of validPreferences) {
                expect(() => PreferredContactEnumSchema.parse(preference)).not.toThrow();
            }
        });

        it('should reject invalid contact preferences', () => {
            const invalidPreferences = [
                'personal',
                'work',
                'home',
                'mobile',
                'PERSONAL',
                'invalid',
                '',
                null,
                undefined
            ];

            for (const preference of invalidPreferences) {
                expect(() => PreferredContactEnumSchema.parse(preference)).toThrow(ZodError);
            }
        });
    });

    describe('Enum Consistency', () => {
        it('should maintain consistent error message format', () => {
            expect(() => AccommodationTypeEnumSchema.parse('INVALID')).toThrow(ZodError);
        });

        it('should handle case sensitivity correctly', () => {
            // All enums should be case-sensitive and use UPPER_CASE
            expect(() => AccommodationTypeEnumSchema.parse('hotel')).toThrow(ZodError);
            expect(() => AccommodationTypeEnumSchema.parse('Hotel')).toThrow(ZodError);
            expect(() => AccommodationTypeEnumSchema.parse('HOTEL')).not.toThrow();

            expect(() => RoleEnumSchema.parse('user')).toThrow(ZodError);
            expect(() => RoleEnumSchema.parse('User')).toThrow(ZodError);
            expect(() => RoleEnumSchema.parse('USER')).not.toThrow();
        });

        it('should provide meaningful error messages', () => {
            const testCases = [
                AccommodationTypeEnumSchema,
                PostCategoryEnumSchema,
                RoleEnumSchema,
                VisibilityEnumSchema
            ];

            for (const schema of testCases) {
                expect(() => schema.parse('INVALID')).toThrow(ZodError);
            }
        });
    });

    describe('Type Safety', () => {
        it('should infer correct TypeScript types', () => {
            const accommodationType = AccommodationTypeEnumSchema.parse('HOTEL');
            const postCategory = PostCategoryEnumSchema.parse('TOURISM');
            const role = RoleEnumSchema.parse('USER');
            const visibility = VisibilityEnumSchema.parse('PUBLIC');

            // TypeScript should infer these as literal types
            expect(typeof accommodationType).toBe('string');
            expect(typeof postCategory).toBe('string');
            expect(typeof role).toBe('string');
            expect(typeof visibility).toBe('string');

            // Values should match exactly
            expect(accommodationType).toBe('HOTEL');
            expect(postCategory).toBe('TOURISM');
            expect(role).toBe('USER');
            expect(visibility).toBe('PUBLIC');
        });
    });
});
