import { z } from 'zod';

/** Optional listing filter for an owner's live recurring addons. */
export const OwnerRecurringAddonsQuerySchema = z.object({
    listingId: z.uuid().optional()
});

/** One live recurring addon owned by the requesting actor. */
export const OwnerRecurringAddonSchema = z.object({
    addonInstanceId: z.uuid(),
    name: z.string().min(1),
    chargeKind: z.literal('PERIODICO'),
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
    price: z.number().int().positive(),
    currency: z.literal('ARS'),
    status: z.enum(['PENDING_AUTHORIZATION', 'ACTIVE']),
    targetId: z.uuid().nullable(),
    targetName: z.string().nullable()
});

/** Response for the owner recurring addon list. */
export const OwnerRecurringAddonsResponseSchema = z.object({
    items: z.array(OwnerRecurringAddonSchema)
});

/** UUID path parameter for withdrawing one addon instance. */
export const AddonWithdrawalParamsSchema = z.object({ instanceId: z.uuid() });

/** Result of an owner's addon withdrawal. */
export const AddonWithdrawalResponseSchema = z.object({
    instanceId: z.uuid(),
    status: z.literal('CANCELLED'),
    providerCall: z.enum(['SENT', 'NOT_NEEDED', 'NOTICE_PENDING', 'FAILED'])
});

/** One owner recurring addon returned by the API. */
export type OwnerRecurringAddon = z.infer<typeof OwnerRecurringAddonSchema>;
/** Owner recurring addon list returned by the API. */
export type OwnerRecurringAddonsResponse = z.infer<typeof OwnerRecurringAddonsResponseSchema>;
