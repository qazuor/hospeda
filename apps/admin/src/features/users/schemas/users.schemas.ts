import { LifecycleStatusEnum, ModerationStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

export const UserListItemSchema = z
    .object({
        id: z.string(),
        displayName: z.string().optional(),
        slug: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.nativeEnum(RoleEnum).optional(),
        authProvider: z.string().optional(),
        contactInfo: z
            .object({
                email: z.string().email().optional()
            })
            .optional(),
        location: z
            .object({
                city: z.string().optional()
            })
            .optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        accommodationCount: z.number().optional(),
        eventsCount: z.number().optional(),
        postsCount: z.number().optional(),
        createdAt: z.string().optional(),
        // Legacy fields for backward compatibility
        email: z.string().email().optional(),
        username: z.string().optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
        isEmailVerified: z.boolean().optional(),
        isActive: z.boolean().optional(),
        lastLoginAt: z.string().optional(),
        reviewsCount: z.number().optional(),
        likesCount: z.number().optional(),
        followersCount: z.number().optional(),
        followingCount: z.number().optional(),
        updatedAt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        avatar: z.string().url().optional()
    })
    .passthrough();

export type User = z.infer<typeof UserListItemSchema>;
