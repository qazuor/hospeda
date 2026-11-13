import { z } from 'zod';

/** Protected owner's free addon choice request. */
export const AddonFreeChoiceRequestSchema = z.strictObject({
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    orderRequestId: z.string().min(1).max(64),
    addonVersionId: z.uuid()
});

/** Successful free addon choice, including an idempotent replay. */
export const AddonFreeChoiceResponseSchema = z.strictObject({
    outcome: z.enum(['CREATED', 'EXISTING']),
    instanceId: z.uuid(),
    status: z.literal('ACTIVE')
});
