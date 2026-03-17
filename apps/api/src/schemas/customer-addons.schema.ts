/**
 * Customer Add-on Purchases Schemas
 *
 * @deprecated Import directly from '@repo/schemas' instead.
 * This file re-exports from the canonical source for backward compatibility.
 *
 * @module schemas/customer-addons
 */

export {
    ADDON_PURCHASE_RESPONSE_STATUSES,
    ADDON_PURCHASE_STATUSES,
    CustomerAddonActionResponseSchema,
    CustomerAddonIdParamSchema,
    CustomerAddonResponseSchema,
    CustomerAddonsListResponseSchema,
    EntitlementAdjustmentSchema,
    LimitAdjustmentSchema,
    ListCustomerAddonsQuerySchema
} from '@repo/schemas';

export type {
    CustomerAddonActionResponse,
    CustomerAddonIdParam,
    CustomerAddonResponse,
    CustomerAddonsListResponse,
    ListCustomerAddonsQuery
} from '@repo/schemas';
