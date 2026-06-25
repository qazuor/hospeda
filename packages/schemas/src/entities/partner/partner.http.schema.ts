import { z } from 'zod';
import { BaseHttpSearchSchema } from '../../api/http/base-http.schema.js';
import {
    createPaginatedResponseSchema,
    createSingleItemResponseSchema
} from '../../api/response/base-response.schema.js';
import { PartnerSubscriptionStatusEnumSchema } from '../../enums/partner-subscription-status.schema.js';
import { PartnerTierEnumSchema } from '../../enums/partner-tier.schema.js';
import { PartnerTypeEnumSchema } from '../../enums/partner-type.schema.js';
import { adminSearchPartnerSchema } from './partner.admin-search.schema.js';
import { createPartnerSchema } from './partner.create.schema.js';
import { partnerSchema } from './partner.schema.js';
import { updatePartnerSchema } from './partner.update.schema.js';

/**
 * HTTP-compatible partner search schema with automatic coercion
 * Extends base search with partner-specific filters
 */
export const PartnerSearchHttpSchema = BaseHttpSearchSchema.extend({
    q: z.string().optional(),
    type: PartnerTypeEnumSchema.optional(),
    tier: PartnerTierEnumSchema.optional(),
    subscriptionStatus: PartnerSubscriptionStatusEnumSchema.optional(),
    includeInactive: z.coerce.boolean().default(false)
});

export type HttpPartnerSearch = z.infer<typeof PartnerSearchHttpSchema>;

/**
 * Public API response schemas
 */
export const publicPartnerResponseSchema = createSingleItemResponseSchema(partnerSchema);
export const publicPartnersListResponseSchema = createPaginatedResponseSchema(partnerSchema);

/**
 * Admin API request schemas
 */
export const adminCreatePartnerRequestSchema = z.object({
    body: createPartnerSchema
});

export const adminUpdatePartnerRequestSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: updatePartnerSchema
});

export const adminGetPartnerRequestSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const adminDeletePartnerRequestSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const adminSearchPartnerRequestSchema = z.object({
    query: adminSearchPartnerSchema
});

/**
 * Admin API response schemas
 */
export const adminPartnerResponseSchema = createSingleItemResponseSchema(partnerSchema);
export const adminPartnersListResponseSchema = createPaginatedResponseSchema(partnerSchema);

/**
 * Admin action request schemas
 */
export const adminSendPaymentLinkRequestSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    })
});

export const adminManualPaymentRequestSchema = z.object({
    params: z.object({
        id: z.string().uuid()
    }),
    body: z.object({
        note: z.string().max(500).optional()
    })
});

/**
 * Payment link response
 */
export const paymentLinkResponseSchema = createSingleItemResponseSchema(
    z.object({
        paymentUrl: z.string().url(),
        planId: z.string().uuid()
    })
);

/**
 * Type exports
 */
export type AdminCreatePartnerRequest = z.infer<typeof adminCreatePartnerRequestSchema>;
export type AdminUpdatePartnerRequest = z.infer<typeof adminUpdatePartnerRequestSchema>;
export type AdminGetPartnerRequest = z.infer<typeof adminGetPartnerRequestSchema>;
export type AdminDeletePartnerRequest = z.infer<typeof adminDeletePartnerRequestSchema>;
export type AdminSearchPartnerRequest = z.infer<typeof adminSearchPartnerRequestSchema>;
export type AdminSendPaymentLinkRequest = z.infer<typeof adminSendPaymentLinkRequestSchema>;
export type AdminManualPaymentRequest = z.infer<typeof adminManualPaymentRequestSchema>;
