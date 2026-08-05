import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    BirthDateHttpInputSchema,
    UserActivateInputSchema,
    UserAddPermissionInputSchema,
    UserAssignRoleInputSchema,
    UserCreateInputSchema,
    UserCreateOutputSchema,
    UserDeactivateInputSchema,
    UserDeleteInputSchema,
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
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName,
                firstName: user.firstName,
                lastName: user.lastName,
                contactInfo: user.contactInfo,
                profile: user.profile,
                location: user.location,
                settings: user.settings,
                visibility: user.visibility,
                slug: user.slug,
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

        // HOS-375: the public author route (getBySlug.ts) validates its
        // `:slug` path param against `^[a-z0-9]+(?:[_-][a-z0-9]+)*$` and 400s
        // otherwise, so a non-conforming slug produces a permanently 404ing
        // author page. That pattern is deliberately NOT enforced here: this is
        // a PUBLISHED schema, and adding a regex to a shipped field is a
        // narrowing the additive-only compat policy forbids. It lives in
        // `UserService`'s normalizer instead, where a bad value is REPAIRED via
        // `toSlug` rather than refused — see
        // `packages/service-core/src/services/user/user.normalizers.ts`.
        it('does NOT reject a non-ASCII slug — narrowing a published schema is forbidden', () => {
            const user = createUserFixture();
            const legacyInput = {
                ...user,
                slug: 'ana-rodríguez'
            };

            expect(() => UserCreateInputSchema.parse(legacyInput)).not.toThrow();
        });

        it('still rejects an EMPTY slug — the pre-existing `.min(1)` is untouched', () => {
            // Non-vacuity for the case above: proves the field is still
            // validated at all, and that only the added regex was removed.
            const user = createUserFixture();

            expect(() => UserCreateInputSchema.parse({ ...user, slug: '' })).toThrow(ZodError);
        });

        it('accepts a plain ASCII hyphenated slug', () => {
            const user = createUserFixture();
            const validInput = {
                ...user,
                slug: 'ana-rodriguez'
            };

            expect(() => UserCreateInputSchema.parse(validInput)).not.toThrow();
        });

        it('accepts the auto-generated `user-<8 hex>` slug shape', () => {
            // Must keep passing: `users.slug.$defaultFn` in
            // packages/db/src/schemas/user/user.dbschema.ts produces exactly
            // this shape for any signup that omits a slug.
            const user = createUserFixture();
            const validInput = {
                ...user,
                slug: 'user-a1b2c3d4'
            };

            expect(() => UserCreateInputSchema.parse(validInput)).not.toThrow();
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

        // Regression: system flags must NOT be re-injected as Zod defaults on a
        // partial update. `BaseCrudService.update` re-parses input through this
        // schema, so an injected `emailVerified: false` / `profileCompleted:
        // false` would be persisted and silently reset the user's state.
        it('does not inject system flags on a partial update', () => {
            const parsed = UserUpdateInputSchema.parse({ firstName: 'Jane' });

            for (const flag of [
                'emailVerified',
                'profileCompleted',
                'setPasswordPrompted',
                'serviceSuspended',
                'isSystemAccount',
                'permissions',
                'banned',
                'banReason',
                'banExpires'
            ]) {
                expect(
                    Object.hasOwn(parsed, flag),
                    `system flag '${flag}' must not be present after parsing a partial update`
                ).toBe(false);
            }
        });

        it('strips system flags supplied explicitly', () => {
            const parsed = UserUpdateInputSchema.parse({
                firstName: 'Jane',
                emailVerified: true,
                profileCompleted: true,
                banned: true,
                serviceSuspended: true,
                isSystemAccount: false
            }) as Record<string, unknown>;

            expect(parsed.firstName).toBe('Jane');
            expect(Object.hasOwn(parsed, 'emailVerified')).toBe(false);
            expect(Object.hasOwn(parsed, 'profileCompleted')).toBe(false);
            expect(Object.hasOwn(parsed, 'banned')).toBe(false);
            expect(Object.hasOwn(parsed, 'serviceSuspended')).toBe(false);
            // HOS-375: a generic user edit must not be able to clear the
            // system-account flag. If it could, an unrelated profile save on a
            // staff account would turn it back into an indexable author page.
            expect(Object.hasOwn(parsed, 'isSystemAccount')).toBe(false);
        });

        // HOS-375: same reasoning as UserCreateInputSchema above — the public
        // slug pattern is enforced by REPAIR in the service normalizer, never
        // by narrowing this published write schema.
        it('does NOT reject a non-ASCII slug — narrowing a published schema is forbidden', () => {
            const legacyInput = { slug: 'carlos-martínez' };

            expect(() => UserUpdateInputSchema.parse(legacyInput)).not.toThrow();
        });

        it('still rejects an EMPTY slug — the pre-existing `.min(1)` is untouched', () => {
            expect(() => UserUpdateInputSchema.parse({ slug: '' })).toThrow(ZodError);
        });

        it('accepts a plain ASCII hyphenated slug', () => {
            const validInput = { slug: 'carlos-martinez' };

            expect(() => UserUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('accepts the auto-generated `user-<8 hex>` slug shape', () => {
            const validInput = { slug: 'user-a1b2c3d4' };

            expect(() => UserUpdateInputSchema.parse(validInput)).not.toThrow();
        });

        it('omitting slug still means "no change" (partial semantics preserved)', () => {
            const parsed = UserUpdateInputSchema.parse({ firstName: 'Jane' }) as Record<
                string,
                unknown
            >;

            expect(Object.hasOwn(parsed, 'slug')).toBe(false);
        });

        it('no longer carries a scalar `role` (HOS-296)', () => {
            // Role changes moved to the dedicated grant/revoke endpoints, so an
            // update payload can neither set nor imply one. A schema that still
            // accepted it would silently discard an admin's intent.
            expect(Object.keys(UserUpdateInputSchema.shape)).not.toContain('role');

            const parsed = UserUpdateInputSchema.parse({ role: 'ADMIN' }) as Record<
                string,
                unknown
            >;
            expect(parsed.role).toBeUndefined();
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

    // Regression: BETA-34 — editing the profile birth date rejected the
    // `YYYY-MM-DD` string every `<input type="date">` sends. This schema is
    // the HTTP-layer override applied to `birthDate` on all four user write
    // routes; it must accept a plain calendar date and `''` (clear), and
    // reject non-date garbage.
    describe('BirthDateHttpInputSchema', () => {
        it('accepts a valid YYYY-MM-DD date string', () => {
            expect(() => BirthDateHttpInputSchema.parse('1990-05-15')).not.toThrow();
            expect(BirthDateHttpInputSchema.parse('1990-05-15')).toBe('1990-05-15');
        });

        it('accepts an empty string (clears the field)', () => {
            expect(() => BirthDateHttpInputSchema.parse('')).not.toThrow();
            expect(BirthDateHttpInputSchema.parse('')).toBe('');
        });

        it('accepts null', () => {
            expect(() => BirthDateHttpInputSchema.parse(null)).not.toThrow();
            expect(BirthDateHttpInputSchema.parse(null)).toBeNull();
        });

        it('accepts undefined (field not submitted)', () => {
            expect(() => BirthDateHttpInputSchema.parse(undefined)).not.toThrow();
            expect(BirthDateHttpInputSchema.parse(undefined)).toBeUndefined();
        });

        it('rejects a non-date garbage string', () => {
            expect(() => BirthDateHttpInputSchema.parse('not-a-date')).toThrow(ZodError);
        });

        it('rejects a full ISO-8601 datetime string (the pre-fix, overly strict shape)', () => {
            expect(() => BirthDateHttpInputSchema.parse('1990-05-15T00:00:00Z')).toThrow(ZodError);
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

            it.each([
                'SYSTEM',
                'GUEST'
            ])('should reject the non-assignable role %s (HOS-296)', (role) => {
                // This is an HTTP-shaped input feeding `UserService.assignRole`,
                // which delegates straight to `grantRole`. `GUEST` is synthesised
                // in-memory for anonymous requests and never stored; `SYSTEM`
                // belongs to one reserved non-loginable account. The seed grants
                // `SYSTEM` by calling `grantRole` DIRECTLY, so restricting this
                // schema does not block it.
                const input = {
                    userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' as any,
                    role: role as any
                };

                expect(() => UserAssignRoleInputSchema.parse(input)).toThrow(ZodError);
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
                    // biome-ignore lint/suspicious/noConsole: console.log used for debugging schema parse failures in tests
                    console.log('UserSchema parsing failed:', (error as Error).message);
                }

                // Test UserCreateOutputSchema parsing directly (not wrapped)
                try {
                    const _parsedOutput = UserCreateOutputSchema.parse(user);
                } catch (error) {
                    // biome-ignore lint/suspicious/noConsole: console.log used for debugging schema parse failures in tests
                    console.log('UserCreateOutputSchema parsing failed:', (error as Error).message);
                }

                expect(() => UserCreateOutputSchema.parse(user)).not.toThrow();
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
