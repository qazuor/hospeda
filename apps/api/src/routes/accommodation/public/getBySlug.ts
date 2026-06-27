/**
 * Public get accommodation by slug endpoint.
 * Returns a single accommodation enriched with owner, amenities, features, and active FAQs.
 */
import {
    accommodationFaqs,
    amenities,
    features,
    getDb,
    rAccommodationAmenity,
    rAccommodationFeature,
    users
} from '@repo/db';
import { AccommodationPublicSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveOwnerEntitlementsForOwnerId } from '../../../middlewares/owner-entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { filterAccommodationByEntitlements } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * Fetches safe public owner data. Never exposes contactInfo, email, or phone.
 * @remarks Uses getDb() directly because UserService._canView() requires the actor
 * to be the same user or have USER_READ_ALL permission, which is incompatible with
 * anonymous public access. Only a narrow set of non-sensitive fields is selected.
 */
async function fetchOwner(ownerId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: users.id,
            displayName: users.displayName,
            firstName: users.firstName,
            lastName: users.lastName,
            image: users.image,
            profile: users.profile,
            createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);

    const row = rows[0];
    if (!row) return null;
    const name =
        row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown');
    // Resolve avatar from `users.image` (social login / upload) with a
    // fallback to `users.profile.avatar` (seed fixtures and legacy profile
    // editors). Treat empty strings as null so the UI falls back to
    // initials instead of rendering an empty <img src="">.
    const profileAvatar = (row.profile as { avatar?: string | null } | null)?.avatar ?? null;
    const image = row.image || profileAvatar || null;
    return { id: row.id, name, image, createdAt: row.createdAt.toISOString() };
}

/**
 * Fetches amenities with junction data for an accommodation.
 * @remarks Uses getDb() directly because AmenityService.getAmenitiesForAccommodation()
 * does not return junction-table fields (isOptional, additionalCost) required by the
 * public detail response shape. No service method covers this join projection.
 */
async function fetchAmenities(accommodationId: string) {
    const db = getDb();
    const rows = await db
        .select({
            amenityId: rAccommodationAmenity.amenityId,
            slug: amenities.slug,
            icon: amenities.icon,
            isOptional: rAccommodationAmenity.isOptional,
            additionalCost: rAccommodationAmenity.additionalCost
        })
        .from(rAccommodationAmenity)
        .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
        .where(eq(rAccommodationAmenity.accommodationId, accommodationId));

    return rows.map((r) => ({
        amenityId: r.amenityId,
        slug: r.slug,
        icon: r.icon ?? null,
        isOptional: r.isOptional,
        additionalCost:
            r.additionalCost != null && typeof r.additionalCost === 'object'
                ? null
                : (r.additionalCost as number | null)
    }));
}

/**
 * Fetches features with junction data for an accommodation.
 * @remarks Uses getDb() directly because FeatureService.getFeaturesForAccommodation()
 * does not return junction-table fields (hostReWriteName, comments) required by the
 * public detail response shape. No service method covers this join projection.
 */
async function fetchFeatures(accommodationId: string) {
    const db = getDb();
    const rows = await db
        .select({
            featureId: rAccommodationFeature.featureId,
            slug: features.slug,
            icon: features.icon,
            hostReWriteName: rAccommodationFeature.hostReWriteName,
            comments: rAccommodationFeature.comments
        })
        .from(rAccommodationFeature)
        .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
        .where(eq(rAccommodationFeature.accommodationId, accommodationId));

    return rows.map((r) => ({
        featureId: r.featureId,
        slug: r.slug,
        icon: r.icon ?? null,
        hostReWriteName: r.hostReWriteName ?? null,
        comments: r.comments ?? null
    }));
}

/**
 * Fetches active FAQs (lifecycleState=ACTIVE, not soft-deleted).
 * @remarks Uses getDb() directly because AccommodationService.getFaqs() loads all
 * FAQs via findWithRelations without filtering by lifecycleState=ACTIVE, which would
 * expose draft or archived FAQs to public consumers.
 */
async function fetchFaqs(accommodationId: string) {
    const db = getDb();
    const rows = await db
        .select({
            id: accommodationFaqs.id,
            question: accommodationFaqs.question,
            answer: accommodationFaqs.answer,
            category: accommodationFaqs.category
        })
        .from(accommodationFaqs)
        .where(
            and(
                eq(accommodationFaqs.accommodationId, accommodationId),
                eq(accommodationFaqs.lifecycleState, 'ACTIVE'),
                isNull(accommodationFaqs.deletedAt)
            )
        );

    return rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        category: r.category ?? null
    }));
}

/**
 * GET /api/v1/public/accommodations/slug/:slug
 * Get accommodation by slug - Public endpoint
 */
export const publicGetAccommodationBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/slug/{slug}',
    summary: 'Get accommodation by slug',
    description:
        'Retrieves an accommodation by its URL-friendly slug, enriched with owner, amenities, features, and FAQs',
    tags: ['Accommodations'],
    requestParams: {
        slug: z.string().min(1).max(255)
    },
    responseSchema: AccommodationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getBySlug(actor, params.slug as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            return null;
        }

        const accommodation = result.data;
        const ownerEntitlements = accommodation.ownerId
            ? await resolveOwnerEntitlementsForOwnerId(accommodation.ownerId)
            : [];
        const filteredAccommodation = filterAccommodationByEntitlements(
            ctx,
            accommodation,
            ownerEntitlements
        );

        // Fetch related data in parallel
        const [owner, amenitiesData, featuresData, faqsData] = await Promise.all([
            filteredAccommodation.ownerId
                ? fetchOwner(filteredAccommodation.ownerId)
                : Promise.resolve(null),
            fetchAmenities(filteredAccommodation.id),
            fetchFeatures(filteredAccommodation.id),
            fetchFaqs(filteredAccommodation.id)
        ]);

        return {
            ...filteredAccommodation,
            createdAt:
                filteredAccommodation.createdAt instanceof Date
                    ? filteredAccommodation.createdAt.toISOString()
                    : filteredAccommodation.createdAt,
            owner: owner ?? undefined,
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            faqs: faqsData.length > 0 ? faqsData : undefined
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
