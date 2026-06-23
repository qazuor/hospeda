import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';

/**
 * SocialAudience entity schema.
 * Named target audience descriptors (e.g. "Turistas", "Familias con niños").
 * Supports soft-delete and full audit FKs.
 */
export const SocialAudienceSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialAudience.id.uuid' }),
    name: z.string().min(1, { message: 'zodError.socialAudience.name.required' }),
    slug: z.string().min(1, { message: 'zodError.socialAudience.slug.required' }),
    description: z.string().optional(),
    active: z.boolean().default(true),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialAudienceSchema}. */
export type SocialAudience = z.infer<typeof SocialAudienceSchema>;
