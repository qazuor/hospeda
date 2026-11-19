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
    reason: z.string().min(1).optional(),
    /**
     * How a one-time (`UNA_VEZ`) purchase is paid (HOS-2179): `ORDER`, the card-token order
     * (the default until T-6 moves the route), or `PAGE`, a provider payment page the customer
     * is redirected to. Ignored for recurring products.
     */
    oneTimeChannel: z.enum(['ORDER', 'PAGE']).optional()
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
    'ORDER_REQUEST_REUSED',
    'ORDER_REQUEST_ABANDONED'
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
