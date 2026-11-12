import { z } from 'zod';

/** Structured output expected from the FAQ draft model. */
export const AiFaqDraftOutputSchema = z
    .object({ hasData: z.boolean(), draft: z.string() })
    .strict();

/** Response returned by the FAQ draft endpoint. */
export const AiFaqDraftResponseSchema = z
    .object({ messageId: z.string().uuid(), hasData: z.boolean(), draft: z.string().nullable() })
    .strict()
    .refine((value) => value.hasData === (value.draft !== null), {
        message: 'draft must be present exactly when hasData is true'
    });

export type AiFaqDraftOutput = z.infer<typeof AiFaqDraftOutputSchema>;
/** Inferred HTTP FAQ draft response type. */
export type AiFaqDraftResponse = z.infer<typeof AiFaqDraftResponseSchema>;
