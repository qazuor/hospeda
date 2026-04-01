/**
 * Sponsorship HTTP Schemas
 *
 * HTTP-compatible schemas for sponsorship operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createBooleanQueryParam,
    createDateQueryParam
} from '../../api/http/base-http.schema.js';
import { SponsorshipStatusEnumSchema } from '../../enums/sponsorship-status.schema.js';
import { SponsorshipTargetTypeEnumSchema } from '../../enums/sponsorship-target-type.schema.js';

/**
 * HTTP-compatible sponsorship search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const SponsorshipSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Relationship filters
    sponsorUserId: z.string().uuid().optional(),
    targetType: SponsorshipTargetTypeEnumSchema.optional(),
    targetId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),

    // Status filters
    status: SponsorshipStatusEnumSchema.optional(),

    // Date range filters for startsAt with coercion
    startsAtAfter: createDateQueryParam('Filter sponsorships starting after this date'),
    startsAtBefore: createDateQueryParam('Filter sponsorships starting before this date'),

    // Date range filters for endsAt with coercion
    endsAtAfter: createDateQueryParam('Filter sponsorships ending after this date'),
    endsAtBefore: createDateQueryParam('Filter sponsorships ending before this date'),

    // Date range filters for createdAt with coercion
    createdAfter: createDateQueryParam('Filter sponsorships created after this date'),
    createdBefore: createDateQueryParam('Filter sponsorships created before this date'),

    // Coupon filters with HTTP coercion
    hasCouponCode: createBooleanQueryParam('Filter sponsorships with coupon codes'),
    minCouponDiscountPercent: z.coerce.number().int().min(0).max(100).optional(),
    maxCouponDiscountPercent: z.coerce.number().int().min(0).max(100).optional(),

    // Analytics filters with HTTP coercion
    minImpressions: z.coerce.number().int().min(0).optional(),
    maxImpressions: z.coerce.number().int().min(0).optional(),
    minClicks: z.coerce.number().int().min(0).optional(),
    maxClicks: z.coerce.number().int().min(0).optional(),

    // Presence filters with HTTP coercion
    hasLogoUrl: createBooleanQueryParam('Filter sponsorships with logo URLs'),
    hasLinkUrl: createBooleanQueryParam('Filter sponsorships with link URLs'),
    hasPaymentId: createBooleanQueryParam('Filter sponsorships with payment IDs')
});

export type SponsorshipSearchHttp = z.infer<typeof SponsorshipSearchHttpSchema>;

/**
 * HTTP-compatible sponsorship creation schema
 * Handles form data and JSON input for creating sponsorships via HTTP
 */
export const SponsorshipCreateHttpSchema = z.object({
    sponsorUserId: z.string().uuid(),
    targetType: SponsorshipTargetTypeEnumSchema,
    targetId: z.string().uuid(),
    levelId: z.string().uuid(),
    packageId: z.string().uuid().optional(),
    status: SponsorshipStatusEnumSchema.optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    paymentId: z.string().optional(),
    logoUrl: z.string().url().optional(),
    linkUrl: z.string().url().optional(),
    couponCode: z.string().optional(),
    couponDiscountPercent: z.coerce.number().int().min(0).max(100).optional()
});

export type SponsorshipCreateHttp = z.infer<typeof SponsorshipCreateHttpSchema>;

/**
 * HTTP-compatible sponsorship update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const SponsorshipUpdateHttpSchema = SponsorshipCreateHttpSchema.partial();

export type SponsorshipUpdateHttp = z.infer<typeof SponsorshipUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { SponsorshipQuerySearchInput } from './sponsorship.query.schema.js';
import type { SponsorshipCreateInput, SponsorshipUpdateInput } from './sponsorship.schema.js';

import { SponsorshipStatusEnum } from '../../enums/sponsorship-status.enum.js';

/**
 * Convert HTTP sponsorship search parameters to domain search schema.
 * Handles coercion from HTTP query strings to proper domain types.
 */
export const httpToDomainSponsorshipSearch = (
    httpParams: SponsorshipSearchHttp
): SponsorshipQuerySearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Relationship filters
        sponsorUserId: httpParams.sponsorUserId,
        targetType: httpParams.targetType,
        targetId: httpParams.targetId,
        levelId: httpParams.levelId,
        packageId: httpParams.packageId,

        // Status filters
        status: httpParams.status,

        // Date range filters
        startsAtAfter: httpParams.startsAtAfter,
        startsAtBefore: httpParams.startsAtBefore,
        endsAtAfter: httpParams.endsAtAfter,
        endsAtBefore: httpParams.endsAtBefore,
        createdAfter: httpParams.createdAfter,
        createdBefore: httpParams.createdBefore,

        // Coupon filters
        hasCouponCode: httpParams.hasCouponCode,
        minCouponDiscountPercent: httpParams.minCouponDiscountPercent,
        maxCouponDiscountPercent: httpParams.maxCouponDiscountPercent,

        // Analytics filters
        minImpressions: httpParams.minImpressions,
        maxImpressions: httpParams.maxImpressions,
        minClicks: httpParams.minClicks,
        maxClicks: httpParams.maxClicks,

        // Presence filters
        hasLogoUrl: httpParams.hasLogoUrl,
        hasLinkUrl: httpParams.hasLinkUrl,
        hasPaymentId: httpParams.hasPaymentId
    };
};

/**
 * Convert HTTP sponsorship create data to domain create input.
 * Handles form data conversion to proper domain types.
 * Sets default status to PENDING if not provided.
 */
export const httpToDomainSponsorshipCreate = (
    httpData: SponsorshipCreateHttp
): SponsorshipCreateInput => {
    return {
        sponsorUserId: httpData.sponsorUserId,
        targetType: httpData.targetType,
        targetId: httpData.targetId,
        levelId: httpData.levelId,
        packageId: httpData.packageId ?? null,
        status: httpData.status ?? SponsorshipStatusEnum.PENDING,
        startsAt: httpData.startsAt,
        endsAt: httpData.endsAt ?? null,
        paymentId: httpData.paymentId ?? null,
        logoUrl: httpData.logoUrl ?? null,
        linkUrl: httpData.linkUrl ?? null,
        couponCode: httpData.couponCode ?? null,
        couponDiscountPercent: httpData.couponDiscountPercent ?? null
    };
};

/**
 * Convert HTTP sponsorship update data to domain update input.
 * Handles partial updates from HTTP PATCH requests.
 */
export const httpToDomainSponsorshipUpdate = (
    httpData: SponsorshipUpdateHttp
): SponsorshipUpdateInput => {
    const result: SponsorshipUpdateInput = {};

    if (httpData.sponsorUserId !== undefined) result.sponsorUserId = httpData.sponsorUserId;
    if (httpData.targetType !== undefined) result.targetType = httpData.targetType;
    if (httpData.targetId !== undefined) result.targetId = httpData.targetId;
    if (httpData.levelId !== undefined) result.levelId = httpData.levelId;
    if (httpData.packageId !== undefined) result.packageId = httpData.packageId ?? null;
    if (httpData.status !== undefined) result.status = httpData.status;
    if (httpData.startsAt !== undefined) result.startsAt = httpData.startsAt;
    if (httpData.endsAt !== undefined) result.endsAt = httpData.endsAt ?? null;
    if (httpData.paymentId !== undefined) result.paymentId = httpData.paymentId ?? null;
    if (httpData.logoUrl !== undefined) result.logoUrl = httpData.logoUrl ?? null;
    if (httpData.linkUrl !== undefined) result.linkUrl = httpData.linkUrl ?? null;
    if (httpData.couponCode !== undefined) result.couponCode = httpData.couponCode ?? null;
    if (httpData.couponDiscountPercent !== undefined)
        result.couponDiscountPercent = httpData.couponDiscountPercent ?? null;

    return result;
};
