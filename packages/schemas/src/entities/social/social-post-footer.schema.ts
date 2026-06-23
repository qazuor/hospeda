import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * SocialPostFooter entity schema.
 * Reusable footer templates appended to posts
 * (e.g. "Reservá en hospeda.com.ar").
 * Supports soft-delete and full audit FKs.
 */
export const SocialPostFooterSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialPostFooter.id.uuid' }),
    name: z.string().min(1, { message: 'zodError.socialPostFooter.name.required' }),
    slug: z.string().min(1, { message: 'zodError.socialPostFooter.slug.required' }),
    /** Footer body text. May contain emoji and links. */
    content: z.string().min(1, { message: 'zodError.socialPostFooter.content.required' }),
    /** Optional platform restriction — null means applies to all platforms */
    platform: SocialPlatformEnumSchema.nullable().optional(),
    active: z.boolean().default(true),
    isDefault: z.boolean().default(false),
    priority: z.number().int().default(0),
    notes: z.string().nullable().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialPostFooterSchema}. */
export type SocialPostFooter = z.infer<typeof SocialPostFooterSchema>;
