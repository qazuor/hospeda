import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    UserIdentityInputSchema,
    UserProfileFromProviderSchema
} from '../../../src/entities/user/user.identity.schema.js';

describe('User Identity Schemas', () => {
    describe('UserIdentityInputSchema', () => {
        it('should validate complete identity input', () => {
            const validInput = {
                provider: 'google',
                providerUserId: 'google-123456',
                email: 'user@example.com',
                username: 'johndoe',
                avatarUrl: 'https://example.com/avatar.jpg',
                raw: {
                    googleId: '123456',
                    verified: true
                },
                lastLoginAt: new Date()
            };

            expect(() => UserIdentityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate minimal identity input', () => {
            const validInput = {
                provider: 'github',
                providerUserId: 'github-789'
            };

            expect(() => UserIdentityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should require provider', () => {
            const invalidInput = {
                providerUserId: 'user-123'
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should require providerUserId', () => {
            const invalidInput = {
                provider: 'facebook'
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject empty provider', () => {
            const invalidInput = {
                provider: '',
                providerUserId: 'user-123'
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should reject empty providerUserId', () => {
            const invalidInput = {
                provider: 'twitter',
                providerUserId: ''
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate email format', () => {
            const invalidInput = {
                provider: 'google',
                providerUserId: 'google-123',
                email: 'invalid-email-format'
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should validate avatarUrl format', () => {
            const invalidInput = {
                provider: 'google',
                providerUserId: 'google-123',
                avatarUrl: 'not-a-valid-url'
            };

            expect(() => UserIdentityInputSchema.parse(invalidInput)).toThrow(ZodError);
        });

        it('should accept valid avatarUrl', () => {
            const validInput = {
                provider: 'google',
                providerUserId: 'google-123',
                avatarUrl: 'https://lh3.googleusercontent.com/avatar.jpg'
            };

            expect(() => UserIdentityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should accept any raw data', () => {
            const validInput = {
                provider: 'custom',
                providerUserId: 'custom-123',
                raw: {
                    complexObject: {
                        nested: true,
                        array: [1, 2, 3],
                        nullValue: null
                    }
                }
            };

            expect(() => UserIdentityInputSchema.parse(validInput)).not.toThrow();
        });

        it('should validate lastLoginAt as date', () => {
            const validInput = {
                provider: 'linkedin',
                providerUserId: 'linkedin-456',
                lastLoginAt: new Date('2024-01-15T10:30:00Z')
            };

            expect(() => UserIdentityInputSchema.parse(validInput)).not.toThrow();
        });
    });

    describe('UserProfileFromProviderSchema', () => {
        it('should validate complete profile from provider', () => {
            const validProfile = {
                firstName: 'John',
                lastName: 'Doe',
                displayName: 'John Doe',
                contactInfo: {
                    personalEmail: 'john@example.com',
                    workEmail: 'john@company.com',
                    phone: '+1234567890',
                    website: 'https://johndoe.com'
                },
                profile: {
                    avatar: {
                        url: 'https://example.com/avatar.jpg',
                        alt: 'John Doe Avatar',
                        width: 200,
                        height: 200
                    },
                    bio: 'Software developer passionate about web technologies.',
                    location: 'San Francisco, CA'
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });

        it('should validate minimal profile', () => {
            const validProfile = {
                firstName: 'Jane'
            };

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });

        it('should validate empty profile', () => {
            const validProfile = {};

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });

        it('should reject empty firstName', () => {
            const invalidProfile = {
                firstName: ''
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should reject empty lastName', () => {
            const invalidProfile = {
                lastName: ''
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should reject empty displayName', () => {
            const invalidProfile = {
                displayName: ''
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should validate email formats in contactInfo', () => {
            const invalidProfile = {
                contactInfo: {
                    personalEmail: 'invalid-email',
                    workEmail: 'john@company.com'
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should validate website URL in contactInfo', () => {
            const invalidProfile = {
                contactInfo: {
                    website: 'not-a-url'
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should validate avatar URL in profile', () => {
            const invalidProfile = {
                profile: {
                    avatar: {
                        url: 'invalid-url'
                    }
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should enforce positive avatar dimensions', () => {
            const invalidProfile = {
                profile: {
                    avatar: {
                        url: 'https://example.com/avatar.jpg',
                        width: -100
                    }
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should enforce bio length limit', () => {
            const invalidProfile = {
                profile: {
                    bio: 'x'.repeat(501) // Exceeds 500 character limit
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should enforce location length limit', () => {
            const invalidProfile = {
                profile: {
                    location: 'x'.repeat(101) // Exceeds 100 character limit
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(invalidProfile)).toThrow(ZodError);
        });

        it('should validate nested profile structure', () => {
            const validProfile = {
                profile: {
                    avatar: {
                        url: 'https://example.com/avatar.jpg'
                    },
                    bio: 'Short bio',
                    location: 'New York'
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });

        it('should validate partial contactInfo', () => {
            const validProfile = {
                contactInfo: {
                    personalEmail: 'personal@example.com'
                    // Other fields are optional
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });

        it('should validate partial avatar info', () => {
            const validProfile = {
                profile: {
                    avatar: {
                        url: 'https://example.com/avatar.jpg',
                        alt: 'Avatar description'
                        // width and height are optional
                    }
                }
            };

            expect(() => UserProfileFromProviderSchema.parse(validProfile)).not.toThrow();
        });
    });
});
