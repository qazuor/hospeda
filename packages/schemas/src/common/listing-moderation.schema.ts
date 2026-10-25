import { z } from 'zod';
import { PublicationStatusEnumSchema } from '../enums/publication-status.schema.js';

/** Read-only listing and open fix-request state for moderation controls. */
export const ListingModerationStateSchema = z.object({
    publicationStatus: PublicationStatusEnumSchema,
    fixRequest: z
        .object({
            reason: z.string(),
            suggestedDate: z.string().date().nullable(),
            openedAt: z.iso.datetime(),
            ownerReportedFixedAt: z.iso.datetime().nullable()
        })
        .nullable()
});

export type ListingModerationState = z.infer<typeof ListingModerationStateSchema>;

const reason = z
    .string()
    .trim()
    .min(1, { message: 'zodError.common.listingModeration.reason.required' })
    .max(2000, { message: 'zodError.common.listingModeration.reason.max' });
const suggestedDate = z.iso
    .date({ message: 'zodError.common.listingModeration.suggestedDate.invalid' })
    .nullable()
    .optional();

/** Request body for the four administrative listing moderation gestures. */
export const ListingModerationActionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('REQUEST_FIX'), reason, suggestedDate }),
    z.object({ action: z.literal('TAKE_DOWN'), reason }),
    z.object({ action: z.literal('LIFT'), reason, keepFixRequest: z.boolean() }),
    z.object({ action: z.literal('CLOSE_FIX_REQUEST'), reason })
]);

/** State returned after an administrative moderation gesture. */
export const ListingModerationResponseSchema = z.object({
    publicationStatus: PublicationStatusEnumSchema,
    fixRequestOpen: z.boolean()
});

export type ListingModerationAction = z.infer<typeof ListingModerationActionSchema>;
export type ListingModerationResponse = z.infer<typeof ListingModerationResponseSchema>;
