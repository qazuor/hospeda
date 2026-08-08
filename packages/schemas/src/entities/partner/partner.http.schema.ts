import { z } from 'zod';
import { BaseHttpSearchSchema } from '../../api/http/base-http.schema.js';
import {
    createPaginatedResponseSchema,
    createSingleItemResponseSchema
} from '../../api/response/base-response.schema.js';
import { adminSearchPartnerSchema } from './partner.admin-search.schema.js';
import { createPartnerSchema } from './partner.create.schema.js';
import { partnerSchema } from './partner.schema.js';
import { updatePartnerSchema } from './partner.update.schema.js';

/**
 * HTTP-compatible partner search schema with automatic coercion.
 * Only returns active partners — `includeInactive` is intentionally absent
 * so that the active-only filter is always enforced on public endpoints.
 *
 * PAGINATION ONLY, deliberately (HOS-294 D-5). It used to carry `q`, `type`,
 * `tier` and `subscriptionStatus` — the filter surface of the public partner
 * DIRECTORY, a page the owner retired and that is not coming back. Leaving the
 * params accepted would have meant the directory survived as an API: anyone
 * could rebuild it with `?tier=gold&type=ngo&q=…` long after the page was
 * deleted. The only remaining caller is the home carousel, which sends
 * `pageSize` alone.
 *
 * Two of them were already not doing what they appeared to do:
 * `subscriptionStatus` was accepted and then silently discarded, since
 * `PartnerModel.findByFilters` never read it.
 *
 * `q` is `.omit()`ed rather than simply left out of an extend: it comes from
 * {@link BaseHttpSearchSchema} itself, so dropping the `.extend()` block alone
 * left free-text search on the endpoint — the single most directory-shaped
 * param of the four.
 */
export const PartnerSearchHttpSchema = BaseHttpSearchSchema.omit({ q: true });

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
