import { z } from 'zod';

/** Validated A1 purchase intention. */
export const PurchaseAddonInputSchema = z.strictObject({
    ownerId: z.uuid(),
    productId: z.uuid(),
    targetId: z.uuid().nullable(),
    orderRequestId: z.string().min(1).max(64),
    expectedAddonVersionId: z.uuid(),
    payerEmail: z.email().optional(),
    returnUrl: z.url(),
    reason: z.string().min(1).optional()
});

/** Input for the addon purchase service. */
export type PurchaseAddonInput = z.infer<typeof PurchaseAddonInputSchema>;

/** Closed refusal reasons mapped exhaustively by the API. */
export const PURCHASE_ADDON_REFUSAL_REASONS = [
    'PRODUCT_NOT_FOUND',
    'TARGET_NOT_FOUND',
    'NO_VALID_TITLE',
    'ADDON_VERSION_NOT_CURRENT',
    'ALREADY_ACTIVE',
    'FREE_UNDER_GRANT',
    'ORDER_REQUEST_REUSED'
] as const;

/** One closed A1 refusal reason. */
export type PurchaseAddonRefusalReason = (typeof PURCHASE_ADDON_REFUSAL_REASONS)[number];

/** Result of A1, including conflict and replay outcomes. */
export type PurchaseAddonResult =
    | {
          readonly outcome: 'CREATED' | 'EXISTING' | 'PENDING_ELSEWHERE';
          readonly instanceId: string;
          readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
          readonly checkoutUrl?: string;
      }
    | { readonly outcome: 'REFUSED'; readonly reason: PurchaseAddonRefusalReason };
