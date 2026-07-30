import { z } from 'zod';
import { RoleEnumSchema } from '../../enums/role.schema.js';

export const FEATURE_FLAG_KEY_MAX_LENGTH = 100;
export const FEATURE_FLAG_DESCRIPTION_MAX_LENGTH = 2000;
export const FEATURE_FLAG_REASON_MAX_LENGTH = 500;

export const FeatureFlagSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    key: z
        .string()
        .min(1, { message: 'zodError.featureFlag.key.min' })
        .max(FEATURE_FLAG_KEY_MAX_LENGTH, { message: 'zodError.featureFlag.key.max' }),

    description: z
        .string()
        .min(1, { message: 'zodError.featureFlag.description.min' })
        .max(FEATURE_FLAG_DESCRIPTION_MAX_LENGTH, {
            message: 'zodError.featureFlag.description.max'
        }),

    enabled: z.boolean().default(false),

    isActive: z.boolean().default(true),

    forceOnUserIds: z.array(z.string().uuid()).default([]),

    forceOffUserIds: z.array(z.string().uuid()).default([]),

    enabledForRoles: z.array(RoleEnumSchema).default([]),

    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable()
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const FlagContextSchema = z.object({
    userId: z.string().uuid().optional(),
    /**
     * Every role the evaluating actor holds (HOS-296). A flag targeted at any
     * held role is on — an account that is both a host and an editor gets the
     * union, which is the only sensible reading of "enabled for role X" once
     * one account can wear several hats.
     */
    roles: RoleEnumSchema.array().optional()
});

export type FlagContext = z.infer<typeof FlagContextSchema>;
