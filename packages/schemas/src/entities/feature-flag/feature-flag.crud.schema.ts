import { z } from 'zod';
import { stripShapeDefaults } from '../../utils/utils.js';
import { FeatureFlagSchema } from './feature-flag.schema.js';

export const CreateFeatureFlagSchema = FeatureFlagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true
});

export type CreateFeatureFlag = z.infer<typeof CreateFeatureFlagSchema>;

export const UpdateFeatureFlagSchema = z
    .object(stripShapeDefaults(CreateFeatureFlagSchema.shape))
    .partial();

export type UpdateFeatureFlag = z.infer<typeof UpdateFeatureFlagSchema>;

export const ToggleFeatureFlagSchema = z.object({
    isActive: z.boolean(),
    reason: z.string().max(500, { message: 'zodError.featureFlag.reason.max' }).optional()
});

export type ToggleFeatureFlag = z.infer<typeof ToggleFeatureFlagSchema>;
