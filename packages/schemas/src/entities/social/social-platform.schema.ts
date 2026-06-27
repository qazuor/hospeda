import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * SocialPlatform entity schema.
 * One config row per platform (INSTAGRAM, FACEBOOK, X).
 * The `platform` column is UNIQUE but not the PK — id UUID is the PK.
 * Supports soft-delete and full audit FKs.
 */
export const SocialPlatformSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPlatform.id.uuid' }),
    platform: SocialPlatformEnumSchema,
    label: z.string().min(1, { message: 'zodError.socialPlatform.label.required' }),
    enabled: z.boolean().default(true),
    notes: z.string().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialPlatformSchema}. */
export type SocialPlatformEntity = z.infer<typeof SocialPlatformSchema>;
