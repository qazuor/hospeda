import { z } from 'zod';

/** Validated owner choice; payment details are intentionally absent. */
export const ChooseFreeAddonInputSchema = z.strictObject({
    ownerId: z.uuid(),
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    orderRequestId: z.string().min(1).max(64),
    expectedAddonVersionId: z.uuid()
});

/** Owner's free addon choice. */
export type ChooseFreeAddonInput = z.infer<typeof ChooseFreeAddonInputSchema>;

/** Closed A1-bis refusal reasons. */
export const CHOOSE_FREE_ADDON_REFUSAL_REASONS = [
    'PRODUCT_NOT_FOUND',
    'TARGET_NOT_FOUND',
    'NO_FREE_TITLE',
    'ADDON_VERSION_NOT_CURRENT',
    'ALREADY_ACTIVE',
    'PENDING_ELSEWHERE',
    'ORDER_REQUEST_REUSED'
] as const;

/** One closed A1-bis refusal. */
export type ChooseFreeAddonRefusalReason = (typeof CHOOSE_FREE_ADDON_REFUSAL_REASONS)[number];

/** A1-bis result. */
export type ChooseFreeAddonResult =
    | {
          readonly outcome: 'CREATED' | 'EXISTING';
          readonly instanceId: string;
          readonly status: 'ACTIVE';
      }
    | { readonly outcome: 'REFUSED'; readonly reason: ChooseFreeAddonRefusalReason };
