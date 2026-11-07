/** TEST:2051:1 — HOS-2051: the admin review moderation list filters by listing. */
import { randomUUID } from 'node:crypto';
import { experienceReviews, getDb, venueReviews } from '@repo/db';
import {
    ModerationStatusEnum,
    PermissionEnum,
    PublicationStatusEnum,
    RoleEnum,
    VerticalEnum
} from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    createOwner,
    createVerticalDestination,
    createVerticalListing
} from '../listing-publication/publication-routes.helpers';

/**
 * The bug (HOS-2051): the admin reviews panel of a listing sent its own
 * listing id, but neither the venue route/service nor the experience route
 * accepted it, so `GET /api/v1/admin/<vertical>/reviews/?status=PENDING`
 * returned the pending reviews of EVERY listing. A moderator opening venue A
 * saw reviews of B, C and the rest as if they belonged to A.
 *
 * These tests run over the real HTTP stack with a real PostgreSQL database
 * (no service mocks): two listings (A and B) are seeded per vertical, each
 * with one PENDING and one APPROVED review, and the response body is read
 * directly (`res.status` + `res.json()`).
 */

const app = initApp();

type ListingVertical = typeof VerticalEnum.VENUE | typeof VerticalEnum.EXPERIENCE;

const verticals: ReadonlyArray<{
    readonly vertical: ListingVertical;
    readonly label: string;
    readonly basePath: string;
    readonly idParam: string;
}> = [
    {
        vertical: VerticalEnum.VENUE,
        label: 'venue',
        // Trailing slash: the admin router mounts reviews at `/reviews` with an
        // inner `path: '/'`, so the full path resolves as `/reviews/`.
        basePath: '/api/v1/admin/venues/reviews/',
        idParam: 'venueId'
    },
    {
        vertical: VerticalEnum.EXPERIENCE,
        label: 'experience',
        basePath: '/api/v1/admin/experiences/reviews/',
        idParam: 'experienceId'
    }
];

// One moderator actor covers both verticals: the route middleware pipeline
// shares the admin router across sibling routes, so the full admin access set
// plus both verticals' moderate permission keeps the request reaching the
// handler under test.
const moderatorActor = {
    id: randomUUID(),
    roles: [RoleEnum.ADMIN],
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.ACCESS_API_ADMIN,
        PermissionEnum.MANAGE_CONTENT,
        PermissionEnum.VENUE_VIEW_ALL,
        PermissionEnum.VENUE_MODERATE_REVIEW,
        PermissionEnum.EXPERIENCE_VIEW_ALL,
        PermissionEnum.EXPERIENCE_MODERATE_REVIEW
    ]
};

/** Mock-actor headers with the moderation permission set of both verticals. */
function moderatorHeaders(): Record<string, string> {
    return {
        ...actorHeaders({
            id: moderatorActor.id,
            role: RoleEnum.ADMIN,
            permissions: moderatorActor.permissions
        }),
        'x-mock-actor-role': moderatorActor.roles.join(',')
    };
}

/** Inserts one listing fixture and returns its id. */
async function seedListing(vertical: ListingVertical): Promise<string> {
    const owner = await createOwner();
    return createVerticalListing({
        vertical,
        ownerId: owner.id,
        destinationId: await createVerticalDestination(),
        status: PublicationStatusEnum.PUBLISHED
    });
}

/**
 * Inserts one review row for a listing and returns its id.
 *
 * A dedicated reviewer per review: `venue_reviews` and `experience_reviews`
 * both carry UNIQUE(userId, listingId), so reusing a reviewer across rows of
 * the same listing would fail the insert.
 */
async function seedReview(args: {
    readonly vertical: ListingVertical;
    readonly listingId: string;
    readonly reviewerId: string;
    readonly moderationState: ModerationStatusEnum;
}): Promise<string> {
    if (args.vertical === VerticalEnum.VENUE) {
        const [row] = await getDb()
            .insert(venueReviews)
            .values({
                venueId: args.listingId,
                userId: args.reviewerId,
                title: 'Venue review title',
                content: 'A venue review body long enough for the response schema.',
                rating: { food: 5, service: 4 },
                averageRating: 4.5,
                overallRating: 4,
                moderationState: args.moderationState
            })
            .returning({ id: venueReviews.id });
        if (!row) throw new Error('Venue review insert failed');
        return row.id;
    }
    const [row] = await getDb()
        .insert(experienceReviews)
        .values({
            experienceId: args.listingId,
            userId: args.reviewerId,
            title: 'Experience review title',
            content: 'An experience review body long enough for the response schema.',
            rating: { food: 5, service: 4, ambiance: 5, value: 4 },
            averageRating: 4.5,
            overallRating: 4,
            moderationState: args.moderationState
        })
        .returning({ id: experienceReviews.id });
    if (!row) throw new Error('Experience review insert failed');
    return row.id;
}

interface ListResponseBody {
    readonly data?: {
        readonly items?: ReadonlyArray<{ readonly id: string }>;
        readonly pagination?: { readonly total?: number };
    };
    readonly error?: { readonly code?: string };
}

describe.each(verticals)('$label admin reviews list filtered by listing', ({
    vertical,
    basePath,
    idParam
}) => {
    let listingA: string;
    let listingB: string;
    let pendingA: string;
    let pendingB: string;

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
    });
    beforeEach(async () => {
        await testDb.clean();
        listingA = await seedListing(vertical);
        listingB = await seedListing(vertical);
        pendingA = await seedReview({
            vertical,
            listingId: listingA,
            reviewerId: (await createOwner()).id,
            moderationState: ModerationStatusEnum.PENDING
        });
        await seedReview({
            vertical,
            listingId: listingA,
            reviewerId: (await createOwner()).id,
            moderationState: ModerationStatusEnum.APPROVED
        });
        pendingB = await seedReview({
            vertical,
            listingId: listingB,
            reviewerId: (await createOwner()).id,
            moderationState: ModerationStatusEnum.PENDING
        });
        await seedReview({
            vertical,
            listingId: listingB,
            reviewerId: (await createOwner()).id,
            moderationState: ModerationStatusEnum.APPROVED
        });
    });
    afterAll(async () => testDb.teardown());

    it('lists only the pending reviews of the requested listing (AC:G:7 / AC:G:8)', async () => {
        const res = await app.request(`${basePath}?status=PENDING&${idParam}=${listingA}`, {
            headers: moderatorHeaders()
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as ListResponseBody;
        const items = body.data?.items ?? [];
        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe(pendingA);
        expect(body.data?.pagination?.total).toBe(1);
    });

    it('returns only listing B pending review when filtered by B (AC:G:7 / AC:G:8)', async () => {
        const res = await app.request(`${basePath}?status=PENDING&${idParam}=${listingB}`, {
            headers: moderatorHeaders()
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as ListResponseBody;
        const items = body.data?.items ?? [];
        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe(pendingB);
        expect(items[0]?.id).not.toBe(pendingA);
        expect(body.data?.pagination?.total).toBe(1);
    });

    it('without the listing id, still lists both listings pending reviews (AC:G:9 control)', async () => {
        const res = await app.request(`${basePath}?status=PENDING`, {
            headers: moderatorHeaders()
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as ListResponseBody;
        const ids = (body.data?.items ?? []).map((item) => item.id).sort();
        expect(ids).toEqual([pendingA, pendingB].sort());
        expect(body.data?.pagination?.total).toBe(2);
    });

    it('rejects a non-UUID listing id with 400 VALIDATION_ERROR (AC:G:9)', async () => {
        const res = await app.request(`${basePath}?status=PENDING&${idParam}=not-a-uuid`, {
            headers: moderatorHeaders()
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as ListResponseBody;
        expect(body.error?.code).toBe('VALIDATION_ERROR');
    });

    it('answers 200 with an empty list for an unknown listing UUID (filter, not 404)', async () => {
        const res = await app.request(`${basePath}?status=PENDING&${idParam}=${randomUUID()}`, {
            headers: moderatorHeaders()
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as ListResponseBody;
        expect(body.data?.items).toEqual([]);
        expect(body.data?.pagination?.total).toBe(0);
    });
});
