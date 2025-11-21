/**
 * BenefitPartner HTTP Schemas
 *
 * HTTP-compatible schemas for benefit partner operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * Benefit category enumeration for HTTP requests
 */
export const BenefitCategoryHttpSchema = z.enum([
    'RESTAURANT',
    'ENTERTAINMENT',
    'TRANSPORT',
    'SHOPPING',
    'WELLNESS',
    'OTHER'
]);

/**
 * HTTP-compatible benefit partner search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const BenefitPartnerSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters
    name: z.string().optional(),
    category: BenefitCategoryHttpSchema.optional(),
    clientId: z.string().uuid().optional(),

    // Array filters
    categories: createArrayQueryParam('Filter by multiple categories'),
    clientIds: createArrayQueryParam('Filter by multiple client IDs'),

    // Boolean filters
    hasDescription: createBooleanQueryParam('Filter partners with description'),
    hasContactInfo: createBooleanQueryParam('Filter partners with contact info')
});

export type BenefitPartnerSearchHttp = z.infer<typeof BenefitPartnerSearchHttpSchema>;

/**
 * HTTP-compatible benefit partner creation schema
 * Handles form data and JSON input for creating benefit partners via HTTP
 * Complete schema matching all CreateBenefitPartnerSchema fields with HTTP coercion
 */
export const BenefitPartnerCreateHttpSchema = z.object({
    // Core required fields
    name: z.string().min(1).max(255),
    category: BenefitCategoryHttpSchema,
    clientId: z.string().uuid(),

    // Optional fields
    description: z.string().max(1000).optional(),
    contactInfo: z.string().max(500).optional(),

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type BenefitPartnerCreateHttp = z.infer<typeof BenefitPartnerCreateHttpSchema>;

/**
 * HTTP-compatible benefit partner update schema
 * Handles partial updates via HTTP PATCH requests
 * All fields optional for partial updates
 */
export const BenefitPartnerUpdateHttpSchema = z.object({
    // Core fields (all optional for updates)
    name: z.string().min(1).max(255).optional(),
    category: BenefitCategoryHttpSchema.optional(),
    // clientId is NOT included - cannot be updated

    // Optional fields
    description: z.string().max(1000).optional(),
    contactInfo: z.string().max(500).optional(),

    // Admin metadata
    adminInfo: z
        .object({
            notes: z.string().max(300).optional(),
            favorite: z.coerce.boolean().default(false)
        })
        .optional()
});

export type BenefitPartnerUpdateHttp = z.infer<typeof BenefitPartnerUpdateHttpSchema>;

/**
 * HTTP to Domain Conversion Functions
 * These functions convert HTTP request data to domain-compatible formats
 */

import { BenefitCategorySchema } from '../../enums/benefit-category.schema.js';
import type { CreateBenefitPartner, UpdateBenefitPartner } from './benefitPartner.crud.schema.js';

/**
 * Convert HTTP benefit partner creation data to domain format
 * All fields are already in the correct format from HTTP schema
 */
export function httpToDomainBenefitPartnerCreate(
    httpData: BenefitPartnerCreateHttp
): CreateBenefitPartner {
    return {
        name: httpData.name,
        category: BenefitCategorySchema.parse(httpData.category),
        clientId: httpData.clientId,
        description: httpData.description,
        contactInfo: httpData.contactInfo,
        adminInfo: httpData.adminInfo || null
    };
}

/**
 * Convert HTTP benefit partner update data to domain format
 * All fields are optional for partial updates
 */
export function httpToDomainBenefitPartnerUpdate(
    httpData: BenefitPartnerUpdateHttp
): UpdateBenefitPartner {
    // Create result object with only defined fields
    const result: UpdateBenefitPartner = {};

    // Only include fields that are actually provided
    if (httpData.name !== undefined) result.name = httpData.name;
    if (httpData.category !== undefined) {
        result.category = BenefitCategorySchema.parse(httpData.category);
    }
    if (httpData.description !== undefined) result.description = httpData.description;
    if (httpData.contactInfo !== undefined) result.contactInfo = httpData.contactInfo;
    if (httpData.adminInfo !== undefined) result.adminInfo = httpData.adminInfo;

    return result;
}
