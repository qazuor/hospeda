import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';

/**
 * SocialContentBatch entity schema.
 * Publishing sprint grouping (e.g. "Hospeda Launch 2026-06").
 * Supports soft-delete and full audit FKs.
 */
export const SocialContentBatchSchema = z.object({
    id: z.string().uuid({ message: 'zodError.socialContentBatch.id.uuid' }),
    name: z.string().min(1, { message: 'zodError.socialContentBatch.name.required' }),
    slug: z.string().min(1, { message: 'zodError.socialContentBatch.slug.required' }),
    description: z.string().optional(),
    active: z.boolean().default(true),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    ...BaseAuditFields
});

/** TypeScript type inferred from {@link SocialContentBatchSchema}. */
export type SocialContentBatch = z.infer<typeof SocialContentBatchSchema>;
