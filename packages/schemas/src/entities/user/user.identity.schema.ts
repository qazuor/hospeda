import { z } from 'zod';

/**
 * User Identity Schemas
 *
 * This file contains schemas for managing external user identities
 * from authentication providers (OAuth, SAML, etc.)
 */

// ============================================================================
// IDENTITY INPUT SCHEMAS
// ============================================================================

/**
 * Schema for external user identity input
 * Used when creating or updating identity information from auth providers
 */
export const UserIdentityInputSchema = z.object({
    provider: z
        .string({
            message: 'zodError.userIdentity.provider.required'
        })
        .min(1, { message: 'zodError.userIdentity.provider.min' }),

    providerUserId: z
        .string({
            message: 'zodError.userIdentity.providerUserId.required'
        })
        .min(1, { message: 'zodError.userIdentity.providerUserId.min' }),

    email: z
        .string({
            message: 'zodError.userIdentity.email.invalidType'
        })
        .email({ message: 'zodError.userIdentity.email.format' })
        .optional(),

    username: z
        .string({
            message: 'zodError.userIdentity.username.invalidType'
        })
        .min(1, { message: 'zodError.userIdentity.username.min' })
        .optional(),

    avatarUrl: z
        .string({
            message: 'zodError.userIdentity.avatarUrl.invalidType'
        })
        .url({ message: 'zodError.userIdentity.avatarUrl.format' })
        .optional(),

    raw: z.unknown().optional(),

    lastLoginAt: z
        .date({
            message: 'zodError.userIdentity.lastLoginAt.invalidType'
        })
        .optional()
});

/**
 * Schema for user profile updates from auth providers
 * Partial user profile data that can be updated from external providers
 */
export const UserProfileFromProviderSchema = z.object({
    firstName: z
        .string({
            message: 'zodError.userProfile.firstName.invalidType'
        })
        .min(1, { message: 'zodError.userProfile.firstName.min' })
        .optional(),

    lastName: z
        .string({
            message: 'zodError.userProfile.lastName.invalidType'
        })
        .min(1, { message: 'zodError.userProfile.lastName.min' })
        .optional(),

    displayName: z
        .string({
            message: 'zodError.userProfile.displayName.invalidType'
        })
        .min(1, { message: 'zodError.userProfile.displayName.min' })
        .optional(),

    contactInfo: z
        .object({
            personalEmail: z.string().email().optional(),
            workEmail: z.string().email().optional(),
            phone: z.string().optional(),
            website: z.string().url().optional()
        })
        .optional(),

    profile: z
        .object({
            avatar: z
                .object({
                    url: z.string().url(),
                    alt: z.string().optional(),
                    width: z.number().int().positive().optional(),
                    height: z.number().int().positive().optional()
                })
                .optional(),
            bio: z.string().max(500).optional(),
            location: z.string().max(100).optional()
        })
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserIdentityInput = z.infer<typeof UserIdentityInputSchema>;
export type UserProfileFromProvider = z.infer<typeof UserProfileFromProviderSchema>;
