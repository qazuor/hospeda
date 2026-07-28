/**
 * GET /api/v1/public/accommodations/:id/similar
 * Returns accommodations similar to the given one, matched by type or destination.
 */
import { accommodations, getDb } from '@repo/db';
import { AccommodationPublicSchema, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, desc, eq, isNull, ne, or, type SQL } from 'drizzle-orm';
import type { Context } from 'hono';
import { z } from 'zod';
import { resolveOwnerEntitlementsForOwnerIds } from '../../../middlewares/owner-entitlement';
import type { AccommodationData } from '../../../utils/entitlement-filter';
import {
    filterAccommodationListByOwnerEntitlements,
    stripRichDescriptionFields
} from '../../../utils/entitlement-filter';
import { createPublicRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/public/accommodations/:id/similar
 * Public endpoint - no auth required
 */
export const publicGetSimilarRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/similar',
    summary: 'Get similar accommodations',
    description: 'Returns accommodations similar to the given one by type or destination',
    tags: ['Accommodations'],
    requestParams: {
        id: z.string().uuid()
    },
    requestQuery: {
        limit: z.coerce.number().int().min(1).max(12).default(6).optional()
    },
    responseSchema: z.array(AccommodationPublicSchema),
    handler: async (
        _ctx: Context,
        params: Record<string, unknown>,
        _body: unknown,
        query?: Record<string, unknown>
    ) => {
        const id = params.id as string;
        const limit = Math.min(Number(query?.limit) || 6, 12);

        /**
         * @remarks getDb() is used directly here because no service method exposes
         * the two-step similarity pattern: (1) fetch the source accommodation's type
         * and destinationId, then (2) query with OR(same-type, same-destination) plus
         * exclusion of the source record. AccommodationService.search() would require
         * two separate calls and does not support the OR condition between type and
         * destinationId simultaneously.
         */
        const db = getDb();

        // Fetch current accommodation to get type and destinationId.
        // HOS-288: a bare `eq(id)` answered 200 with a full recommendation list for a
        // soft-deleted / DRAFT / PRIVATE id. With these predicates the row is simply not
        // found and the NOT_FOUND throw right below fires.
        //
        // For DRAFT/PRIVATE that closes an enumeration oracle. For soft-deleted it does
        // NOT — `checkCanViewAccommodation` deliberately answers 410 GONE on
        // `/accommodations/:slug` for a formerly-PUBLIC deleted listing so crawlers
        // deindex it (HOS-117 T-022), i.e. existence is disclosed there by design. The
        // same id therefore yields 410 from `getById` and 404 here. That divergence is
        // deliberate — a recommendation sub-resource is not an indexed canonical URL, so
        // it has nothing to deindex — but it IS a divergence, not an anti-enumeration win.
        //
        // The predicates are not merely "the same ones the similarity query uses" — they
        // are forced. This route sits under the `/api/v1/public/accommodations` prefix in
        // `PUBLIC_CACHE_ENDPOINTS`, and `generateCacheKey` builds public keys as
        // `public:${path}${query}` with NO Authorization component, while `cacheMiddleware`
        // is mounted BEFORE `authMiddleware` so a cache HIT never reaches the handler at
        // all. The response is therefore shared across actors and the handler MUST be
        // actor-blind: it may only ever return what an anonymous caller may see. That also
        // rules out making this lookup actor-aware to serve owner previews — doing so
        // would turn the leak into cache poisoning.
        //
        // Accepted cost: a token-bearing owner or VIP asking `/similar` for their own
        // DRAFT/PRIVATE listing now gets 404 instead of recommendations. No first-party
        // regression — `apps/web` issues this SSR call with no cookie header, so it is
        // already anonymous, and the section degrades to empty via `Promise.allSettled`.
        const current = await db
            .select({
                type: accommodations.type,
                destinationId: accommodations.destinationId
            })
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.id, id),
                    isNull(accommodations.deletedAt),
                    eq(accommodations.lifecycleState, 'ACTIVE'),
                    eq(accommodations.visibility, 'PUBLIC')
                )
            )
            .limit(1);

        const source = current[0];
        if (!source) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        const { type, destinationId } = source;

        // Build OR condition: same type OR same destination
        const similarityConditions = [];
        if (type) {
            similarityConditions.push(eq(accommodations.type, type));
        }
        if (destinationId) {
            similarityConditions.push(eq(accommodations.destinationId, destinationId));
        }

        if (similarityConditions.length === 0) {
            return [];
        }

        // Use the relational query builder so the `destination` relation is
        // eager-loaded in the same round trip. Without this the consumer cards
        // (Web app) cannot show the destination name and fall back to "—".
        const orCondition = or(...similarityConditions) as SQL<unknown>;
        const where = and(
            orCondition,
            ne(accommodations.id, id),
            eq(accommodations.lifecycleState, 'ACTIVE'),
            eq(accommodations.visibility, 'PUBLIC'),
            // HOS-288: soft-deleted rows must never reach a public response.
            // `AccommodationModel` defaults to excluding them on findAll/count/
            // findAllWithRelations, but this handler is a RAW relational query on
            // `getDb()` (see the @remarks above on why no model method fits the
            // two-step OR-similarity pattern), so the model default cannot reach
            // it and the predicate has to be written out here.
            isNull(accommodations.deletedAt)
        ) as SQL<unknown>;

        const rows = await db.query.accommodations.findMany({
            where,
            // SPEC-187 data-level omission: richDescription is a PREMIUM field
            // gated per-owner by the entitlement system. Similar-card listings do
            // NOT render it, so we exclude it at the query layer (fail-closed —
            // independent of any schema-level change). Also exclude internal admin
            // and audit columns that are never part of a public card payload.
            columns: {
                id: true,
                slug: true,
                name: true,
                summary: true,
                description: true,
                type: true,
                isFeatured: true,
                // SPEC-291 Phase 3b: select isVerified so the badge gate can read the
                // real DB value. Previously omitted → defaulted to false by stripWithSchema
                // regardless of the actual DB value. Now selected so the gate can surface
                // true for entitled owners and force false for non-entitled owners.
                isVerified: true,
                averageRating: true,
                reviewsCount: true,
                media: true,
                price: true,
                location: true,
                seo: true,
                extraInfo: true,
                destinationId: true,
                ownerId: true,
                visibility: true,
                lifecycleState: true,
                createdAt: true,
                updatedAt: true,
                ownerSuspended: true,
                planRestricted: true,
                contactInfo: true,
                socialNetworks: true,
                // richDescription and its SPEC-212 i18n sibling intentionally excluded —
                // PREMIUM fields, not used in cards. Both listed explicitly even though
                // this is an inclusion-mode allowlist (so unlisted columns are never
                // selected anyway): an explicit opt-out for one and silence for the other
                // is the exact asymmetry that let the sibling go ungated everywhere else.
                richDescription: false,
                richDescriptionI18n: false,
                // Internal admin/audit columns excluded from public card payload
                adminInfo: false,
                deletedAt: false,
                deletedById: false,
                createdById: false,
                updatedById: false,
                lastWarnedAt: false,
                moderationState: false,
                schedule: false,
                rating: false
            },
            with: {
                destination: {
                    columns: {
                        id: true,
                        name: true,
                        slug: true,
                        summary: true,
                        destinationType: true,
                        level: true,
                        path: true,
                        pathIds: true
                    }
                }
            },
            orderBy: desc(accommodations.averageRating),
            limit
        });

        // Project the loaded `destination` relation as `cityDestination` to
        // match the public API response shape used by listByOwner / list.
        // The Web transform's `deriveCityFields()` reads `cityDestination`
        // (preferred) before falling back to legacy `destination`.
        //
        // SPEC-187 / SPEC-212 data-level omission: richDescription and its i18n sibling
        // are PREMIUM fields gated per-owner by the entitlement system. Similar-card
        // listings never render them. We strip BOTH explicitly here as a second layer of
        // defense (the DB projection above is the first layer — this ensures the fields
        // are absent even if the query layer changes or is mocked in tests). Using the
        // shared helper keeps this layer complete: the previous hand-rolled destructure
        // dropped only the plain field, so the "survives a query-layer change" guarantee
        // this block advertises did not actually hold for richDescriptionI18n.
        const mappedRows = rows.map((row) => {
            const { destination, ...rest } = stripRichDescriptionFields(
                row as Record<string, unknown> & { destination?: unknown }
            );
            return destination ? { ...rest, cityDestination: destination } : rest;
        });

        // SPEC-291 Phase 3b: gate isVerified by the owner's billing entitlement.
        // Collect unique ownerIds for this page, resolve entitlements in ONE batch
        // query, then apply the gate synchronously. Fail-closed: owners absent from
        // the map (e.g. billing lookup failed) have isVerified forced to false.
        const uniqueOwnerIds = [
            ...new Set(
                mappedRows
                    .map((r) => (r as { ownerId?: string }).ownerId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];
        const ownerEntitlementsMap = await resolveOwnerEntitlementsForOwnerIds(uniqueOwnerIds);
        return filterAccommodationListByOwnerEntitlements(
            mappedRows as AccommodationData[],
            ownerEntitlementsMap
        );
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
