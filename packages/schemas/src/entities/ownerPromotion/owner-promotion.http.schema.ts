/**
 * Owner Promotion HTTP Schemas
 *
 * HTTP-compatible schemas for owner promotion operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createBooleanQueryParam,
    createDateQueryParam
} from '../../api/http/base-http.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { OwnerPromotionDiscountTypeEnumSchema } from '../../enums/owner-promotion-discount-type.schema.js';

/**
 * HTTP-compatible owner promotion search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const OwnerPromotionSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Relationship filters
    ownerId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),

    // Type filters
    discountType: OwnerPromotionDiscountTypeEnumSchema.optional(),

    // Lifecycle state filter (service defaults to ACTIVE when omitted per AC-005-01)
    lifecycleState: LifecycleStatusEnumSchema.optional().describe(
        'Filter by lifecycle state (DRAFT, ACTIVE, ARCHIVED)'
    ),

    // Date range filters for validFrom with coercion
    validFromAfter: createDateQueryParam('Filter promotions valid from after this date'),
    validFromBefore: createDateQueryParam('Filter promotions valid from before this date'),

    // Date range filters for validUntil with coercion
    validUntilAfter: createDateQueryParam('Filter promotions valid until after this date'),
    validUntilBefore: createDateQueryParam('Filter promotions valid until before this date'),

    // Date range filters for createdAt with coercion
    createdAfter: createDateQueryParam('Filter promotions created after this date'),
    createdBefore: createDateQueryParam('Filter promotions created before this date'),

    // Discount value range filters with coercion
    minDiscountValue: z.coerce.number().min(0).optional(),
    maxDiscountValue: z.coerce.number().min(0).optional(),

    // Redemption filters with coercion
    hasMaxRedemptions: createBooleanQueryParam('Filter promotions with max redemption limits'),
    minCurrentRedemptions: z.coerce.number().int().min(0).optional(),
    maxCurrentRedemptions: z.coerce.number().int().min(0).optional(),

    // Night filters with coercion
    minMinNights: z.coerce.number().int().min(1).optional(),
    maxMinNights: z.coerce.number().int().min(1).optional(),

    // Text pattern filters
    titleContains: z.string().min(1).max(100).optional()
});

export type OwnerPromotionSearchHttp = z.infer<typeof OwnerPromotionSearchHttpSchema>;

/**
 * HTTP-compatible owner promotion creation schema
 * Handles form data and JSON input for creating owner promotions via HTTP
 */
export const OwnerPromotionCreateHttpSchema = z.object({
    ownerId: z.string().uuid(),
    accommodationId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    discountType: OwnerPromotionDiscountTypeEnumSchema,
    discountValue: z.coerce.number().min(0),
    minNights: z.coerce.number().int().min(1).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().optional(),
    maxRedemptions: z.coerce.number().int().min(1).optional(),
    lifecycleState: LifecycleStatusEnumSchema.default(LifecycleStatusEnum.ACTIVE)
});

export type OwnerPromotionCreateHttp = z.infer<typeof OwnerPromotionCreateHttpSchema>;

/**
 * HTTP-compatible owner promotion update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const OwnerPromotionUpdateHttpSchema = OwnerPromotionCreateHttpSchema.partial();

export type OwnerPromotionUpdateHttp = z.infer<typeof OwnerPromotionUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { OwnerPromotionQuerySearchInput } from './owner-promotion.query.schema.js';
import type {
    OwnerPromotionCreateInput,
    OwnerPromotionUpdateInput
} from './owner-promotion.schema.js';

/**
 * Convert HTTP owner promotion search parameters to domain search schema.
 * Handles coercion from HTTP query strings to proper domain types.
 */
export const httpToDomainOwnerPromotionSearch = (
    httpParams: OwnerPromotionSearchHttp
): OwnerPromotionQuerySearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Relationship filters
        ownerId: httpParams.ownerId,
        accommodationId: httpParams.accommodationId,

        // Type filters
        discountType: httpParams.discountType,

        // Lifecycle state filter (pass through — enum string, no coercion)
        lifecycleState: httpParams.lifecycleState,

        // Date range filters
        validFromAfter: httpParams.validFromAfter,
        validFromBefore: httpParams.validFromBefore,
        validUntilAfter: httpParams.validUntilAfter,
        validUntilBefore: httpParams.validUntilBefore,
        createdAfter: httpParams.createdAfter,
        createdBefore: httpParams.createdBefore,

        // Discount value range filters
        minDiscountValue: httpParams.minDiscountValue,
        maxDiscountValue: httpParams.maxDiscountValue,

        // Redemption filters
        hasMaxRedemptions: httpParams.hasMaxRedemptions,
        minCurrentRedemptions: httpParams.minCurrentRedemptions,
        maxCurrentRedemptions: httpParams.maxCurrentRedemptions,

        // Night filters
        minMinNights: httpParams.minMinNights,
        maxMinNights: httpParams.maxMinNights,

        // Text pattern filters
        titleContains: httpParams.titleContains
    };
};

/**
 * Convert HTTP owner promotion create data to domain create input.
 * Handles form data conversion to proper domain types.
 */
export const httpToDomainOwnerPromotionCreate = (
    httpData: OwnerPromotionCreateHttp
): OwnerPromotionCreateInput => {
    return {
        ownerId: httpData.ownerId,
        accommodationId: httpData.accommodationId ?? null,
        title: httpData.title,
        description: httpData.description ?? null,
        discountType: httpData.discountType,
        discountValue: httpData.discountValue,
        minNights: httpData.minNights ?? null,
        validFrom: httpData.validFrom,
        validUntil: httpData.validUntil ?? null,
        maxRedemptions: httpData.maxRedemptions ?? null,
        lifecycleState: httpData.lifecycleState
    };
};

/**
 * Convert HTTP owner promotion update data to domain update input.
 * Handles partial updates from HTTP PATCH requests.
 */
export const httpToDomainOwnerPromotionUpdate = (
    httpData: OwnerPromotionUpdateHttp
): OwnerPromotionUpdateInput => {
    const result: OwnerPromotionUpdateInput = {};

    if (httpData.ownerId !== undefined) result.ownerId = httpData.ownerId;
    if (httpData.accommodationId !== undefined)
        result.accommodationId = httpData.accommodationId ?? null;
    if (httpData.title !== undefined) result.title = httpData.title;
    if (httpData.description !== undefined) result.description = httpData.description ?? null;
    if (httpData.discountType !== undefined) result.discountType = httpData.discountType;
    if (httpData.discountValue !== undefined) result.discountValue = httpData.discountValue;
    if (httpData.minNights !== undefined) result.minNights = httpData.minNights ?? null;
    if (httpData.validFrom !== undefined) result.validFrom = httpData.validFrom;
    if (httpData.validUntil !== undefined) result.validUntil = httpData.validUntil ?? null;
    if (httpData.maxRedemptions !== undefined)
        result.maxRedemptions = httpData.maxRedemptions ?? null;
    if (httpData.lifecycleState !== undefined) result.lifecycleState = httpData.lifecycleState;

    return result;
};
