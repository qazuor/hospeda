import { z } from 'zod';

/** Route parameters for ACC:25 emptying a Partner presence. */
export const PartnerEmptyPresenceParamsSchema = z.strictObject({ id: z.uuid() });

/** Confirmed request to empty a Partner presence with an audit reason. */
export const PartnerEmptyPresenceRequestSchema = z.strictObject({
    reason: z.string().trim().min(1).max(500),
    confirm: z.literal(true)
});

/** Result of emptying the Partner presence and processing remote assets. */
export const PartnerEmptyPresenceResponseSchema = z.strictObject({
    id: z.uuid(),
    clearedFields: z.array(z.string()),
    remoteAssetsDeleted: z.number().int().nonnegative(),
    remoteAssetsSkipped: z.number().int().nonnegative()
});

/** Parsed route parameters for ACC:25. */
export type PartnerEmptyPresenceParams = z.infer<typeof PartnerEmptyPresenceParamsSchema>;
/** Parsed request body for ACC:25. */
export type PartnerEmptyPresenceRequest = z.infer<typeof PartnerEmptyPresenceRequestSchema>;
/** Parsed response body for ACC:25. */
export type PartnerEmptyPresenceResponse = z.infer<typeof PartnerEmptyPresenceResponseSchema>;
