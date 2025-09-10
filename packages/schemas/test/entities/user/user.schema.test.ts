import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { UserSchema } from '../../../src/entities/user/user.schema.js';
import {
    createAdminUser,
    createInvalidUser,
    createMinimalUser,
    createSuperAdminUser,
    createUserEdgeCases,
    createUserWithComplexProfile,
    createValidUser
} from '../../fixtures/user.fixtures.js';

describe('UserSchema', () => {
    describe('Valid Data', () => {
        it('should validate a complete valid user', () => {
            const validData = createValidUser();

            expect(() => UserSchema.parse(validData)).not.toThrow();

            const result = UserSchema.parse(validData);
            expect(result.id).toBeDefined();
            expect(result.displayName).toBeDefined();
            expect(result.role).toBeDefined();
            expect(Array.isArray(result.permissions)).toBe(true);
        });

        it('should validate minimal required user data', () => {
            const minimalData = createMinimalUser();

            expect(() => UserSchema.parse(minimalData)).not.toThrow();
        });

        it('should validate user with complex profile', () => {
            const complexData = createUserWithComplexProfile();

            expect(() => UserSchema.parse(complexData)).not.toThrow();

            const result = UserSchema.parse(complexData);
            expect(result.profile?.bio).toBeDefined();
            expect(result.settings?.notifications).toBeDefined();
            expect(Array.isArray(result.bookmarks)).toBe(true);
        });

        it('should validate admin user', () => {
            const adminData = createAdminUser();

            expect(() => UserSchema.parse(adminData)).not.toThrow();

            const result = UserSchema.parse(adminData);
            expect(result.role).toBe('ADMIN');
            expect(result.permissions?.length).toBeGreaterThan(0);
        });

        it('should validate super admin user', () => {
            const superAdminData = createSuperAdminUser();

            expect(() => UserSchema.parse(superAdminData)).not.toThrow();

            const result = UserSchema.parse(superAdminData);
            expect(result.role).toBe('SUPER_ADMIN');
            expect(result.permissions).toContain('system.maintenanceMode');
        });
    });

    describe('Invalid Data', () => {
        it('should reject user with invalid data', () => {
            const invalidData = createInvalidUser();

            expect(() => UserSchema.parse(invalidData)).toThrow(ZodError);
        });

        it('should reject user with missing required fields', () => {
            const incompleteData = {
                displayName: 'John Doe'
                // Missing role and contact.personalEmail
            };

            expect(() => UserSchema.parse(incompleteData)).toThrow(ZodError);
        });

        it('should reject user with invalid enum values', () => {
            const validData = createValidUser();
            const invalidData = {
                ...validData,
                role: 'INVALID_ROLE',
                authProvider: 'INVALID_PROVIDER'
            };

            expect(() => UserSchema.parse(invalidData)).toThrow(ZodError);
        });
    });

    describe('Field Validations', () => {
        describe('displayName field', () => {
            it('should accept valid display names', () => {
                const validData = createValidUser();
                const testCases = [
                    'John Doe',
                    'María García',
                    'AB', // Minimum length (2 chars)
                    'A'.repeat(50), // Maximum length (50 chars)
                    'Jean-Pierre',
                    "O'Connor"
                ];

                for (const displayName of testCases) {
                    const data = { ...validData, displayName };
                    expect(() => UserSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid display names', () => {
                const validData = createValidUser();
                const testCases = [
                    '', // Empty
                    'A'.repeat(101) // Too long
                ];

                for (const displayName of testCases) {
                    const data = { ...validData, displayName };
                    expect(() => UserSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('role field', () => {
            it('should accept all valid roles', () => {
                const validData = createValidUser();
                const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];

                for (const role of validRoles) {
                    const data = { ...validData, role };
                    expect(() => UserSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid roles', () => {
                const validData = createValidUser();
                const invalidRoles = ['MODERATOR', 'CUSTOMER', 'invalid', '', null];

                for (const role of invalidRoles) {
                    const data = { ...validData, role };
                    expect(() => UserSchema.parse(data)).toThrow(ZodError);
                }
            });
        });

        describe('contact field', () => {
            it('should accept contact with only mobile phone', () => {
                const validData = createValidUser();
                const dataWithoutEmail = {
                    ...validData,
                    contactInfo: {
                        mobilePhone: '+1234567890',
                        website: 'https://example.com'
                    }
                };

                expect(() => UserSchema.parse(dataWithoutEmail)).not.toThrow();
            });

            it('should accept valid contact information', () => {
                const validData = createValidUser();
                const validContacts = [
                    { personalEmail: 'test@example.com', mobilePhone: '+1234567890' },
                    {
                        personalEmail: 'test@example.com',
                        mobilePhone: '+1234567890',
                        workPhone: '+1234567891'
                    },
                    {
                        personalEmail: 'test@example.com',
                        mobilePhone: '+1234567890',
                        website: 'https://example.com'
                    },
                    {
                        personalEmail: 'test@example.com',
                        workEmail: 'work@example.com',
                        mobilePhone: '+1234567890',
                        homePhone: '+1234567891',
                        website: 'https://example.com'
                    }
                ];

                for (const contact of validContacts) {
                    const data = { ...validData, contactInfo: contact };
                    expect(() => UserSchema.parse(data)).not.toThrow();
                }
            });
        });

        describe('birthDate field', () => {
            it('should accept valid birth dates', () => {
                const validData = createValidUser();
                const validDates = [
                    new Date('1990-01-01'),
                    new Date('2000-12-31'),
                    new Date('1950-06-15')
                ];

                for (const birthDate of validDates) {
                    const data = { ...validData, birthDate };
                    expect(() => UserSchema.parse(data)).not.toThrow();
                }
            });

            it('should accept reasonable birth dates', () => {
                const validData = createValidUser();
                const pastDate = new Date();
                pastDate.setFullYear(pastDate.getFullYear() - 25);

                const data = { ...validData, birthDate: pastDate };
                expect(() => UserSchema.parse(data)).not.toThrow();
            });
        });

        describe('permissions field', () => {
            it('should accept valid permission arrays', () => {
                const validData = createValidUser();
                const validPermissions = [
                    [],
                    ['user.view.profile'],
                    ['user.view.profile', 'user.create', 'accommodation.viewAll'],
                    ['system.maintenanceMode'] // Super admin permission
                ];

                for (const permissions of validPermissions) {
                    const data = { ...validData, permissions };
                    expect(() => UserSchema.parse(data)).not.toThrow();
                }
            });

            it('should reject invalid permissions', () => {
                const validData = createValidUser();
                const invalidPermissions = [
                    ['INVALID_PERMISSION'],
                    ['user.view.profile', 'INVALID_PERMISSION'],
                    [''] // Empty string permission
                ];

                for (const permissions of invalidPermissions) {
                    const data = { ...validData, permissions };
                    expect(() => UserSchema.parse(data)).toThrow(ZodError);
                }
            });
        });
    });

    describe('Nested Objects', () => {
        describe('profile field', () => {
            it('should validate complete profile data', () => {
                const validData = createValidUser();
                const completeProfile = {
                    avatar: 'https://example.com/avatar.jpg',
                    bio: 'This is my bio',
                    location: 'New York, USA',
                    website: 'https://mywebsite.com',
                    interests: ['travel', 'photography', 'food'],
                    languages: ['en', 'es', 'fr']
                };

                const data = { ...validData, profile: completeProfile };
                expect(() => UserSchema.parse(data)).not.toThrow();
            });

            it('should handle optional profile fields', () => {
                const validData = createValidUser();
                const minimalProfile = {
                    bio: 'Just a bio'
                };

                const data = { ...validData, profile: minimalProfile };
                expect(() => UserSchema.parse(data)).not.toThrow();
            });
        });

        describe('settings field', () => {
            it('should validate complete settings data', () => {
                const validData = createValidUser();
                const completeSettings = {
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowPush: false,
                        allowSms: true
                    },
                    privacy: {
                        profileVisibility: 'PUBLIC',
                        showEmail: false,
                        showPhone: false,
                        allowMessages: true
                    },
                    preferences: {
                        language: 'en',
                        timezone: 'America/New_York',
                        currency: 'USD',
                        theme: 'DARK'
                    }
                };

                const data = { ...validData, settings: completeSettings };
                expect(() => UserSchema.parse(data)).not.toThrow();
            });

            it('should reject invalid settings values', () => {
                const validData = createValidUser();
                const invalidSettings = {
                    preferences: {
                        language: 'invalid-lang',
                        currency: 'INVALID',
                        theme: 'INVALID_THEME'
                    }
                };

                const data = { ...validData, settings: invalidSettings };
                expect(() => UserSchema.parse(data)).toThrow(ZodError);
            });
        });

        describe('bookmarks field', () => {
            it('should validate bookmark arrays', () => {
                const validData = createValidUser();
                const validBookmarks = [
                    {
                        id: '123e4567-e89b-12d3-a456-426614174001',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '123e4567-e89b-12d3-a456-426614174002',
                        updatedById: '123e4567-e89b-12d3-a456-426614174002',
                        lifecycleState: 'ACTIVE',
                        userId: '123e4567-e89b-12d3-a456-426614174003',
                        entityType: 'ACCOMMODATION',
                        entityId: '123e4567-e89b-12d3-a456-426614174004'
                    },
                    {
                        id: '123e4567-e89b-12d3-a456-426614174005',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        createdById: '123e4567-e89b-12d3-a456-426614174002',
                        updatedById: '123e4567-e89b-12d3-a456-426614174002',
                        lifecycleState: 'ACTIVE',
                        userId: '123e4567-e89b-12d3-a456-426614174003',
                        entityType: 'DESTINATION',
                        entityId: '123e4567-e89b-12d3-a456-426614174006',
                        description: 'Want to visit here'
                    }
                ];

                const data = { ...validData, bookmarks: validBookmarks };
                expect(() => UserSchema.parse(data)).not.toThrow();
            });

            it('should reject invalid bookmark data', () => {
                const validData = createValidUser();
                const invalidBookmarks = [
                    {
                        id: 'bookmark-1',
                        entityType: 'INVALID_TYPE',
                        entityId: 'accom-123',
                        createdAt: new Date()
                    }
                ];

                const data = { ...validData, bookmarks: invalidBookmarks };
                expect(() => UserSchema.parse(data)).toThrow(ZodError);
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle edge case values', () => {
            const edgeCaseData = createUserEdgeCases();

            expect(() => UserSchema.parse(edgeCaseData)).not.toThrow();
        });

        it('should handle empty arrays and objects', () => {
            const validData = createValidUser();
            const dataWithEmptyValues = {
                ...validData,
                permissions: [],
                bookmarks: [],
                profile: {
                    interests: [],
                    languages: []
                }
            };

            expect(() => UserSchema.parse(dataWithEmptyValues)).not.toThrow();
        });

        it('should handle null vs undefined for optional fields', () => {
            const validData = createValidUser();

            // undefined should be fine for optional fields
            const withUndefined = {
                ...validData,
                profile: undefined,
                settings: undefined,
                bookmarks: undefined
            };
            expect(() => UserSchema.parse(withUndefined)).not.toThrow();
        });
    });

    describe('Type Inference', () => {
        it('should infer correct TypeScript types', () => {
            const validData = createValidUser();
            const result = UserSchema.parse(validData);

            // TypeScript should infer these correctly
            expect(typeof result.id).toBe('string');
            expect(typeof result.displayName).toBe('string');
            expect(typeof result.role).toBe('string');
            expect(Array.isArray(result.permissions)).toBe(true);
            // Contact email is optional, so check if it exists
            if (result.contactInfo?.personalEmail || result.contactInfo?.workEmail) {
                expect(
                    typeof (result.contactInfo.personalEmail || result.contactInfo.workEmail)
                ).toBe('string');
            }
        });
    });
});
