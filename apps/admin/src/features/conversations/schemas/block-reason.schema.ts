/**
 * Zod schema for the BlockDialog form.
 * Used for inline validation in TanStack Form.
 */

import { z } from 'zod';

/**
 * Schema for the block conversation form.
 * The block reason is optional but limited to 1000 characters.
 */
export const blockReasonSchema = z.object({
    blockReason: z.string().max(1000, 'conversations.errors.blockReasonTooLong').optional()
});

/** Inferred type from blockReasonSchema */
export type BlockReasonFormValues = z.infer<typeof blockReasonSchema>;
