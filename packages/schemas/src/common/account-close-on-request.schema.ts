import { z } from 'zod';

/**
 * Request body for administrative action 24 (ACC:24): close an account at its
 * owner's request. The reason is mandatory and lands in the audit event's "why"
 * field (`account.closed_on_request.reason`).
 */
export const AccountCloseOnRequestSchema = z.object({
    reason: z
        .string({ message: 'zodError.common.accountCloseOnRequest.reason.required' })
        .trim()
        .min(1, { message: 'zodError.common.accountCloseOnRequest.reason.required' })
        .max(2000, { message: 'zodError.common.accountCloseOnRequest.reason.max' })
});

/** Response returned after administrative action 24 closed the account. */
export const AccountCloseOnRequestResponseSchema = z.object({
    closed: z.literal(true)
});

/**
 * The read that precedes action 24: whose account it is (its CURRENT name and
 * mailbox, so the confirmation can say it) and the three preconditions of the
 * manual closure, each on its own so the panel can say which step is missing.
 * `ready` is true only when nothing can charge, no listing is outside `PURGED`
 * and no partner presence holds content. It informs; the closure itself re-reads
 * everything under its own locks.
 */
export const AccountClosurePreviewSchema = z.object({
    userId: z.string().uuid(),
    displayName: z.string().nullable(),
    email: z.string(),
    canCharge: z.boolean(),
    listingsNotPurged: z.number().int().min(0),
    partnerPresenceWithContent: z.boolean(),
    ready: z.boolean()
});

/** Validated body of administrative action 24. */
export type AccountCloseOnRequest = z.infer<typeof AccountCloseOnRequestSchema>;
/** Response of administrative action 24. */
export type AccountCloseOnRequestResponse = z.infer<typeof AccountCloseOnRequestResponseSchema>;
/** The read that precedes administrative action 24. */
export type AccountClosurePreview = z.infer<typeof AccountClosurePreviewSchema>;
