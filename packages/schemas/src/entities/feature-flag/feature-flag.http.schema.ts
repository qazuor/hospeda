import { z } from 'zod';
import { RoleEnumSchema } from '../../enums/role.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import {
    FEATURE_FLAG_DESCRIPTION_MAX_LENGTH,
    FEATURE_FLAG_KEY_MAX_LENGTH,
    FeatureFlagSchema
} from './feature-flag.schema.js';

export const FeatureFlagPublicSchema = z.object({
    key: z.string(),
    enabled: z.boolean()
});

export type FeatureFlagPublic = z.infer<typeof FeatureFlagPublicSchema>;

export const FeatureFlagPublicResponseSchema = z.object({}).catchall(z.boolean());

export type FeatureFlagPublicResponse = z.infer<typeof FeatureFlagPublicResponseSchema>;

export const FeatureFlagAdminSchema = FeatureFlagSchema;

export type FeatureFlagAdmin = z.infer<typeof FeatureFlagAdminSchema>;

export const FeatureFlagAdminResponseSchema = z.object({
    featureFlag: FeatureFlagAdminSchema
});

export type FeatureFlagAdminResponse = z.infer<typeof FeatureFlagAdminResponseSchema>;

export const FeatureFlagCreateHttpSchema = z.object({
    key: z
        .string()
        .min(1)
        .max(FEATURE_FLAG_KEY_MAX_LENGTH)
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
            message: 'zodError.featureFlag.key.invalidPattern'
        }),
    description: z.string().min(1).max(FEATURE_FLAG_DESCRIPTION_MAX_LENGTH),
    enabled: z.coerce.boolean().default(false),
    isActive: z.coerce.boolean().default(true),
    forceOnUserIds: z.array(z.string().uuid()).default([]),
    forceOffUserIds: z.array(z.string().uuid()).default([]),
    enabledForRoles: z.array(RoleEnumSchema).default([])
});

export type FeatureFlagCreateHttp = z.infer<typeof FeatureFlagCreateHttpSchema>;

export const FeatureFlagUpdateHttpSchema = z
    .object(stripShapeDefaults(FeatureFlagCreateHttpSchema.shape))
    .partial();

export type FeatureFlagUpdateHttp = z.infer<typeof FeatureFlagUpdateHttpSchema>;

export const FeatureFlagToggleHttpSchema = z.object({
    isActive: z.boolean(),
    reason: z.string().max(500).optional()
});

export type FeatureFlagToggleHttp = z.infer<typeof FeatureFlagToggleHttpSchema>;

export const FeatureFlagDeleteResponseSchema = z.object({
    success: z.boolean()
});

export type FeatureFlagDeleteResponse = z.infer<typeof FeatureFlagDeleteResponseSchema>;

export const FeatureFlagAdminListResponseSchema = z.object({
    items: z.array(FeatureFlagAdminSchema),
    total: z.number()
});

export type FeatureFlagAdminListResponse = z.infer<typeof FeatureFlagAdminListResponseSchema>;

export const FeatureFlagAuditLogEntrySchema = z.object({
    id: z.string().uuid(),
    flagId: z.string().uuid(),
    action: z.string(),
    previousValue: z.record(z.string(), z.unknown()).nullable(),
    newValue: z.record(z.string(), z.unknown()).nullable(),
    reason: z.string().nullable(),
    performedById: z.string().uuid(),
    createdAt: z.string().datetime()
});

export const FeatureFlagAuditLogResponseSchema = z.array(FeatureFlagAuditLogEntrySchema);

export type FeatureFlagAuditLogResponse = z.infer<typeof FeatureFlagAuditLogResponseSchema>;
