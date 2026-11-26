import { z } from 'zod';
import { LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL } from '../../catalog/listing-photo-limit.js';
import { UNLIMITED_LIMIT_VALUE } from '../../catalog/unlimited-limit.js';

const FinitePhotoLimitSchema = z.number().int().positive().lt(UNLIMITED_LIMIT_VALUE);

const ListingPhotoAllowanceContributionSchema = z.object({
    kind: z.enum([
        'PLAN',
        'TRIAL',
        'ADDON',
        'COURTESY',
        'PERMANENT_GRANT',
        'BASE',
        'PRE_TRIAL_DRAFT'
    ]),
    value: z.union([FinitePhotoLimitSchema, z.literal('unlimited')]),
    sources: z.number().int().positive()
});

const ListingPhotoAllowanceBaseSchema = z.object({
    limitKey: z.enum(Object.values(LISTING_PHOTO_LIMIT_KEY_BY_VERTICAL)),
    source: z.enum(['EFFECTIVE_SET', 'PRE_TRIAL_DRAFT']),
    /** Visible non-cover photos, regardless of moderation state. */
    used: z.number().int().nonnegative(),
    /** Approved visible non-cover photos beyond the cap. */
    hiddenCount: z.number().int().nonnegative(),
    coverAllowed: z.boolean(),
    breakdown: z
        .object({ contributions: z.array(ListingPhotoAllowanceContributionSchema).readonly() })
        .nullable()
});

/** Photo allowance response for an owned listing, with the cap encoded by status. */
export const ListingPhotoAllowanceSchema = z.discriminatedUnion('status', [
    ListingPhotoAllowanceBaseSchema.extend({
        status: z.literal('LIMITED'),
        cap: FinitePhotoLimitSchema
    }),
    ListingPhotoAllowanceBaseSchema.extend({ status: z.literal('UNLIMITED'), cap: z.null() }),
    ListingPhotoAllowanceBaseSchema.extend({ status: z.literal('NONE'), cap: z.literal(0) })
]);

/** Parsed photo allowance for the listing editor. */
export type ListingPhotoAllowance = z.infer<typeof ListingPhotoAllowanceSchema>;
