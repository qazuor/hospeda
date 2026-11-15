import { z } from 'zod';

/** Owner-only explanation of Partner public presence. AC:V8b:1; V7 §1.6. */
export const PartnerOwnerPresenceSchema = z
    .object({
        publicPage: z.enum(['visible', 'hidden']),
        carousel: z.enum(['visible', 'hidden']),
        moderated: z.boolean(),
        moderationReason: z.string().min(1).nullable()
    })
    .refine((presence) => presence.moderated || presence.moderationReason === null, {
        message: 'A moderation reason requires active moderation',
        path: ['moderationReason']
    });

/** Inferred owner-only presence block. */
export type PartnerOwnerPresence = z.infer<typeof PartnerOwnerPresenceSchema>;
