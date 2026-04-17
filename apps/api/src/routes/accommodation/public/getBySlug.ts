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
import { getActorFromContext } from '../../../utils/actor';
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
            createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, ownerId))
        .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    const name =
        row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown');
    return { id: row.id, name, image: row.image, createdAt: row.createdAt.toISOString() };
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
            name: amenities.name,
            icon: amenities.icon,
            isOptional: rAccommodationAmenity.isOptional,
            additionalCost: rAccommodationAmenity.additionalCost
        })
        .from(rAccommodationAmenity)
        .innerJoin(amenities, eq(rAccommodationAmenity.amenityId, amenities.id))
        .where(eq(rAccommodationAmenity.accommodationId, accommodationId));

    return rows.map((r) => ({
        amenityId: r.amenityId,
        name: r.name,
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
            name: features.name,
            icon: features.icon,
            hostReWriteName: rAccommodationFeature.hostReWriteName,
            comments: rAccommodationFeature.comments
        })
        .from(rAccommodationFeature)
        .innerJoin(features, eq(rAccommodationFeature.featureId, features.id))
        .where(eq(rAccommodationFeature.accommodationId, accommodationId));

    return rows.map((r) => ({
        featureId: r.featureId,
        name: r.name,
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

        // Fetch related data in parallel
        const [owner, amenitiesData, featuresData, faqsData] = await Promise.all([
            accommodation.ownerId ? fetchOwner(accommodation.ownerId) : Promise.resolve(null),
            fetchAmenities(accommodation.id),
            fetchFeatures(accommodation.id),
            fetchFaqs(accommodation.id)
        ]);

        return {
            ...accommodation,
            createdAt:
                accommodation.createdAt instanceof Date
                    ? accommodation.createdAt.toISOString()
                    : accommodation.createdAt,
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
