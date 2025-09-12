import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    UserActivateInputSchema,
    UserAddPermissionInputSchema,
    UserAssignRoleInputSchema,
    UserCreateInputSchema,
    UserCreateOutputSchema,
    UserDeactivateInputSchema,
    UserDeleteInputSchema,
    UserEnsureFromAuthProviderInputSchema,
    UserGetByAuthProviderInputSchema,
    UserGetByAuthProviderOutputSchema,
    UserPasswordChangeInputSchema,
    UserPasswordOutputSchema,
    UserPasswordResetInputSchema,
    UserPatchInputSchema,
    UserRemovePermissionInputSchema,
    UserRestoreInputSchema,
    UserRolePermissionOutputSchema,
    UserSetPermissionsInputSchema,
    UserUpdateInputSchema
} from '../../../src/entities/user/user.crud.schema.js';
import { UserSchema } from '../../../src/entities/user/user.schema.js';
import { createUserFixture } from '../../fixtures/user.fixtures.js';

describe('User CRUD Schemas', () => {
    describe('UserCreateInputSchema', () => {
        it('should validate valid user creation input', () => {
            const user = createUserFixture();
            const validInput = {
                displayName: user.displayName,
                firstName: user.firstName,
                lastName: user.lastName,
                contactInfo: user.contactInfo,
                profile: user.profile,
                location: user.location,
                settings: user.settings,
                visibility: user.visibility,
                slug: user.slug,
                role: user.role,
                permissions: user.permissions
            };

            expect(() => UserCreateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require displayName', () => {
            const invalidInput = {
                firstName: 'John',
                lastName: 'Doe'
            };

            expect(() => UserCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate email format in contactInfo', () => {
            const invalidInput = {
                displayName: 'John Doe',
                contactInfo: {
                    personalEmail: 'invalid-email',
                    mobilePhone: '+1234567890'
                }
            };

            expect(() => UserCreateInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('UserUpdateInputSchema', () => {
        it('should validate valid user update input', () => {
            const validInput = {
                displayName: 'Jane Doe Updated',
                firstName: 'Jane',
                lastName: 'Doe'
            };

            expect(() => UserUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow partial updates', () => {
            const validInput = {
                displayName: 'Updated Name Only'
            };

            expect(() => UserUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate nested profile updates', () => {
            const validInput = {
                profile: {
                    bio: 'Updated bio',
                    avatar: 'https://example.com/avatar.jpg'
                }
            };

            expect(() => UserUpdateInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserPatchInputSchema', () => {
        it('should validate patch operations', () => {
            const validInput = {
                displayName: 'Patched Name'
            };

            expect(() => UserPatchInputSchema.parse(validInput)).not.toThrow();
        });

        it('should allow empty patch', () => {
            const validInput = {};

            expect(() => UserPatchInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserDeleteInputSchema', () => {
        it('should validate user deletion input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => UserDeleteInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require valid UUID for id', () => {
            const invalidInput = {
                id: 'invalid-uuid'
            };

            expect(() => UserDeleteInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('UserRestoreInputSchema', () => {
        it('should validate user restoration input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => UserRestoreInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserActivateInputSchema', () => {
        it('should validate user activation input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => UserActivateInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserDeactivateInputSchema', () => {
        it('should validate user deactivation input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
            };

            expect(() => UserDeactivateInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserPasswordChangeInputSchema', () => {
        it('should validate password change input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                currentPassword: 'CurrentPass123!',
                newPassword: 'NewPass456@'
            };

            expect(() => UserPasswordChangeInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require all password fields', () => {
            const invalidInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                newPassword: 'newPass456'
                // Missing currentPassword
            };

            expect(() => UserPasswordChangeInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should enforce minimum password length', () => {
            const invalidInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                currentPassword: 'current',
                newPassword: '123' // Too short
            };

            expect(() => UserPasswordChangeInputSchema.parse(invalidInput)).toThrow(ZodError);
        });
    });

    describe('UserPasswordResetInputSchema', () => {
        it('should validate password reset input', () => {
            const validInput = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                newPassword: 'NewSecurePass123!'
            };

            expect(() => UserPasswordResetInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('Auth Provider Schemas', () => {
        describe('UserGetByAuthProviderInputSchema', () => {
            it('should validate auth provider lookup input', () => {
                const validInput = {
                    provider: 'google',
                    providerUserId: 'google-user-123'
                };

                expect(() => UserGetByAuthProviderInputSchema.parse(validInput)).not.toThrow();
            });

            it('should require provider and providerUserId', () => {
                const invalidInput = {
                    provider: 'google'
                    // Missing providerUserId
                };

                expect(() => UserGetByAuthProviderInputSchema.parse(invalidInput)).toThrow(
                    ZodError
                );
            });

            it('should reject empty strings', () => {
                const invalidInput = {
                    provider: '',
                    providerUserId: 'google-user-123'
                };

                expect(() => UserGetByAuthProviderInputSchema.parse(invalidInput)).toThrow(
                    ZodError
                );
            });
        });

        describe('UserEnsureFromAuthProviderInputSchema', () => {
            it('should validate complete auth provider input', () => {
                const validInput = {
                    provider: 'google',
                    providerUserId: 'google-user-123',
                    profile: {
                        firstName: 'John',
                        lastName: 'Doe',
                        displayName: 'John Doe',
                        contactInfo: {
                            personalEmail: 'john@example.com'
                        }
                    },
                    identities: [
                        {
                            provider: 'google',
                            providerUserId: 'google-user-123',
                            email: 'john@example.com'
                        }
                    ]
                };

                expect(() => UserEnsureFromAuthProviderInputSchema.parse(validInput)).not.toThrow();
            });

            it('should work with minimal input', () => {
                const validInput = {
                    provider: 'github',
                    providerUserId: 'github-user-456'
                };

                expect(() => UserEnsureFromAuthProviderInputSchema.parse(validInput)).not.toThrow();
            });
        });
    });

    describe('Role & Permission Management Schemas', () => {
        describe('UserAssignRoleInputSchema', () => {
            it('should validate role assignment input', () => {
                const validInput = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                    role: 'ADMIN' as any
                };

                expect(() => UserAssignRoleInputSchema.parse(validInput)).not.toThrow();
            });

            it('should require valid userId and role', () => {
                const invalidInput = {
                    userId: 'invalid-uuid',
                    role: 'ADMIN' as any
                };

                expect(() => UserAssignRoleInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });

        describe('UserAddPermissionInputSchema', () => {
            it('should validate permission addition input', () => {
                const validInput = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    permission: 'user.read.all'
                };

                expect(() => UserAddPermissionInputSchema.parse(validInput)).not.toThrow();
            });
        });

        describe('UserRemovePermissionInputSchema', () => {
            it('should validate permission removal input', () => {
                const validInput = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    permission: 'user.create'
                };

                expect(() => UserRemovePermissionInputSchema.parse(validInput)).not.toThrow();
            });
        });

        describe('UserSetPermissionsInputSchema', () => {
            it('should validate permissions setting input', () => {
                const validInput = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    permissions: ['user.read.all', 'user.create']
                };

                expect(() => UserSetPermissionsInputSchema.parse(validInput)).not.toThrow();
            });

            it('should require at least one permission', () => {
                const invalidInput = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                    permissions: []
                };

                expect(() => UserSetPermissionsInputSchema.parse(invalidInput)).toThrow(ZodError);
            });
        });
    });

    describe('Output Schemas', () => {
        describe('UserCreateOutputSchema', () => {
            it('should validate user creation output', () => {
                const user = createUserFixture();

                // Test UserSchema parsing first
                try {
                    const _parsedUser = UserSchema.parse(user);
                } catch (error) {
                    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
                    console.log('UserSchema parsing failed:', (error as Error).message);
                }

                // Test UserCreateOutputSchema parsing directly (not wrapped)
                try {
                    const _parsedOutput = UserCreateOutputSchema.parse(user);
                } catch (error) {
                    // biome-ignore lint/suspicious/noConsoleLog: <explanation>
                    console.log('UserCreateOutputSchema parsing failed:', (error as Error).message);
                }

                expect(() => UserCreateOutputSchema.parse(user)).not.toThrow();
            });
        });

        describe('UserGetByAuthProviderOutputSchema', () => {
            it('should validate auth provider lookup output with user', () => {
                const user = createUserFixture();
                const validOutput = { user };

                expect(() => UserGetByAuthProviderOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should validate auth provider lookup output with null user', () => {
                const validOutput = { user: null };

                expect(() => UserGetByAuthProviderOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('UserRolePermissionOutputSchema', () => {
            it('should validate role/permission operation output', () => {
                const user = createUserFixture();
                const validOutput = { user };

                expect(() => UserRolePermissionOutputSchema.parse(validOutput)).not.toThrow();
            });
        });

        describe('UserPasswordOutputSchema', () => {
            it('should validate password operation output', () => {
                const validOutput = {
                    success: true,
                    message: 'Password updated successfully'
                };

                expect(() => UserPasswordOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should work with minimal output', () => {
                const validOutput = {
                    success: true
                };

                expect(() => UserPasswordOutputSchema.parse(validOutput)).not.toThrow();
            });

            it('should default success to true', () => {
                const input = {};
                const result = UserPasswordOutputSchema.parse(input);

                expect(result.success).toBe(true);
            });
        });
    });
});
