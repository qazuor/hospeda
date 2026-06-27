/**
 * Real-DB integration test helpers for `packages/service-core` (SPEC-080).
 *
 * Mirrors the SPEC-061 pattern in `packages/db/test/integration/helpers.ts`
 * but lives inside service-core so the suite can be installed as a peer to
 * the existing mocked tests under `test/integration/`.
 */
import {
    events,
    type DrizzleClient,
    accommodationReviews,
    accommodations,
    commerceLeads,
    commerceListingSubscriptions,
    destinationReviews,
    destinations,
    eq,
    eventLocations,
    eventOrganizers,
    gastronomies,
    gastronomyReviews,
    ownerPromotions,
    postSponsors,
    postSponsorships,
    posts,
    rEntityTag,
    schema,
    setDb,
    sponsorshipLevels,
    sponsorshipPackages,
    sponsorships,
    sql,
    tags,
    userBookmarks,
    users
} from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

let pool: Pool | null = null;
let cachedDb: DrizzleClient | null = null;

class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

function getTestConnectionString(): string {
    const url = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!url) {
        throw new Error(
            'HOSPEDA_TEST_DATABASE_URL is not set. ' +
                'Run service-core integration tests via "pnpm test:integration" so the global-setup creates the ephemeral DB.'
        );
    }
    return url;
}

/** Returns true when the integration DB env var is wired up. */
export function isServiceTestDbAvailable(): boolean {
    return Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);
}

/** Lazy-initialised pg.Pool, scoped to the worker process. */
export function getServiceTestPool(): Pool {
    if (!pool) {
        pool = new Pool({ connectionString: getTestConnectionString(), max: 5 });
    }
    return pool;
}

/** Drizzle client wired to the same pool, cached for the worker lifetime. */
export function getServiceTestDb(): DrizzleClient {
    if (!cachedDb) {
        // Pass the combined schema so relational queries (`db.query.X.findFirst`)
        // can resolve relations the same way `packages/db/src/client.ts` does
        // at runtime.
        cachedDb = drizzle({ client: getServiceTestPool(), schema }) as unknown as DrizzleClient;
        // Wire @repo/db's runtime client so model methods called without an
        // explicit tx target the test DB instead of throwing
        // "Database not initialized".
        setDb(cachedDb);
    }
    return cachedDb;
}

/**
 * Runs a callback inside a Drizzle transaction that is ALWAYS rolled back.
 * Use it as the body of every test so seed inserts disappear at the end.
 */
export async function withServiceTestTransaction(
    fn: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    const db = getServiceTestDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/** Releases the pool. Call from `afterAll()` of each test file. */
export async function closeServiceTestPool(): Promise<void> {
    cachedDb = null;
    if (pool) {
        await pool.end();
        pool = null;
    }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
//
// Each helper inserts the FK chain required by the service it targets and
// returns the IDs so the test can call service.getById() against them. Helpers
// MUST be called inside `withServiceTestTransaction()` so the inserts roll
// back at the end of the test.

interface SeedAccommodationOverrides {
    readonly ownerId?: string;
    readonly destinationId?: string;
    readonly accommodationId?: string;
    readonly visibility?: string;
    readonly ownerSuspended?: boolean;
}

/**
 * Inserts a User (owner), a Destination, and an Accommodation referencing
 * both. Returns the IDs of all three. Used to validate
 * `AccommodationService.getById()` populates the `destination` and `owner`
 * relations.
 */
export async function seedAccommodation(
    tx: DrizzleClient,
    overrides: SeedAccommodationOverrides = {}
): Promise<{
    readonly userId: string;
    readonly destinationId: string;
    readonly accommodationId: string;
}> {
    const userId = overrides.ownerId ?? crypto.randomUUID();
    const destinationId = overrides.destinationId ?? crypto.randomUUID();
    const accommodationId = overrides.accommodationId ?? crypto.randomUUID();

    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-owner-${uid}@example.com`,
        displayName: 'Seed Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `seed-dest-${uid}`,
        name: 'Seed Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/seed/dest-${uid}`,
        summary: 'Seed destination summary',
        description: 'Seed destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(accommodations).values({
        id: accommodationId,
        slug: `seed-acc-${uid}`,
        name: 'Seed Accommodation',
        summary: 'Seed accommodation summary',
        description: 'Seed accommodation description',
        type: 'HOTEL',
        ownerId: userId,
        destinationId,
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-accommodation.jpg'
            }
        },
        lifecycleState: 'ACTIVE',
        visibility: overrides.visibility ?? 'PUBLIC',
        ownerSuspended: overrides.ownerSuspended ?? false
    } as typeof accommodations.$inferInsert);

    return { userId, destinationId, accommodationId };
}

interface SeedUserBookmarkOverrides {
    readonly userId?: string;
    readonly bookmarkId?: string;
}

/**
 * Inserts a User and a UserBookmark referencing that user. Used to validate
 * `UserBookmarkService.getById()` populates the `user` relation.
 */
export async function seedUserBookmark(
    tx: DrizzleClient,
    overrides: SeedUserBookmarkOverrides = {}
): Promise<{ readonly userId: string; readonly bookmarkId: string }> {
    const userId = overrides.userId ?? crypto.randomUUID();
    const bookmarkId = overrides.bookmarkId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-bookmark-${uid}@example.com`,
        displayName: 'Bookmark Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(userBookmarks).values({
        id: bookmarkId,
        userId,
        // Bookmarks reference any entity by (entityType, entityId). For the
        // relation-loading test we only care about the `user` join, so we
        // point at a random UUID with a permissive entityType.
        entityId: crypto.randomUUID(),
        entityType: 'ACCOMMODATION',
        name: 'Seed Bookmark',
        lifecycleState: 'ACTIVE'
    } as typeof userBookmarks.$inferInsert);

    return { userId, bookmarkId };
}

interface SeedPostOverrides {
    readonly authorId?: string;
    readonly postId?: string;
}

/**
 * Inserts a User (author) and a Post referencing that author. Used to validate
 * `PostService.getById()` populates the `author` relation, and as the FK base
 * for `seedPostSponsorship` (PostSponsorshipService) and the nested
 * `sponsorship.sponsor` resolution in PostService.
 */
export async function seedPost(
    tx: DrizzleClient,
    overrides: SeedPostOverrides = {}
): Promise<{ readonly authorId: string; readonly postId: string }> {
    const authorId = overrides.authorId ?? crypto.randomUUID();
    const postId = overrides.postId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: authorId,
        email: `seed-author-${uid}@example.com`,
        displayName: 'Seed Author',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(posts).values({
        id: postId,
        slug: `seed-post-${uid}`,
        category: 'GENERAL',
        title: 'Seed Post',
        summary: 'Seed post summary',
        content: 'Seed post content body — long enough to read.',
        authorId,
        lifecycleState: 'ACTIVE'
    } as typeof posts.$inferInsert);

    return { authorId, postId };
}

interface SeedSponsorshipPackageOverrides {
    readonly levelId?: string;
    readonly packageId?: string;
}

/**
 * Inserts a SponsorshipLevel and a SponsorshipPackage that references it via
 * `eventLevelId`. Used to validate `SponsorshipPackageService.getById()`
 * populates the `eventLevel` relation, and is reused as the FK base for
 * `seedSponsorship` (SponsorshipService). The level uses target_type=`event`,
 * tier=`standard`, which is the most generic combination.
 */
export async function seedSponsorshipPackage(
    tx: DrizzleClient,
    overrides: SeedSponsorshipPackageOverrides = {}
): Promise<{ readonly levelId: string; readonly packageId: string }> {
    const levelId = overrides.levelId ?? crypto.randomUUID();
    const packageId = overrides.packageId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(sponsorshipLevels).values({
        id: levelId,
        slug: `seed-level-${uid}`,
        name: 'Seed Sponsorship Level',
        targetType: 'event',
        tier: 'standard',
        priceAmount: 1000
    } as typeof sponsorshipLevels.$inferInsert);

    await tx.insert(sponsorshipPackages).values({
        id: packageId,
        slug: `seed-pkg-${uid}`,
        name: 'Seed Sponsorship Package',
        priceAmount: 5000,
        includedPosts: 1,
        includedEvents: 1,
        eventLevelId: levelId
    } as typeof sponsorshipPackages.$inferInsert);

    return { levelId, packageId };
}

interface SeedAccommodationReviewOverrides {
    readonly userId?: string;
    readonly destinationId?: string;
    readonly accommodationId?: string;
    readonly reviewId?: string;
}

/**
 * Inserts the seedAccommodation chain (User + Destination + Accommodation)
 * plus an AccommodationReview by the same user. Used to validate
 * `AccommodationReviewService.getById()` populates the `user` and
 * `accommodation` relations.
 */
export async function seedAccommodationReview(
    tx: DrizzleClient,
    overrides: SeedAccommodationReviewOverrides = {}
): Promise<{
    readonly userId: string;
    readonly destinationId: string;
    readonly accommodationId: string;
    readonly reviewId: string;
}> {
    const { userId, destinationId, accommodationId } = await seedAccommodation(tx, {
        ownerId: overrides.userId,
        destinationId: overrides.destinationId,
        accommodationId: overrides.accommodationId
    });
    const reviewId = overrides.reviewId ?? crypto.randomUUID();

    await tx.insert(accommodationReviews).values({
        id: reviewId,
        accommodationId,
        userId,
        title: 'Seed Review',
        content: 'Seed review content',
        rating: {
            cleanliness: 5,
            hospitality: 5,
            services: 4,
            accuracy: 5,
            communication: 5,
            location: 4
        },
        averageRating: 4.67,
        lifecycleState: 'ACTIVE'
    } as typeof accommodationReviews.$inferInsert);

    return { userId, destinationId, accommodationId, reviewId };
}

interface SeedDestinationReviewOverrides {
    readonly userId?: string;
    readonly destinationId?: string;
    readonly reviewId?: string;
}

/**
 * Inserts a User, a Destination, and a DestinationReview tying them together.
 * Used to validate `DestinationReviewService.getById()` populates the `user`
 * and `destination` relations.
 */
export async function seedDestinationReview(
    tx: DrizzleClient,
    overrides: SeedDestinationReviewOverrides = {}
): Promise<{
    readonly userId: string;
    readonly destinationId: string;
    readonly reviewId: string;
}> {
    const userId = overrides.userId ?? crypto.randomUUID();
    const destinationId = overrides.destinationId ?? crypto.randomUUID();
    const reviewId = overrides.reviewId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-dest-reviewer-${uid}@example.com`,
        displayName: 'Destination Reviewer',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `seed-dest-rev-${uid}`,
        name: 'Reviewed Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/seed/dest-rev-${uid}`,
        summary: 'Seed destination summary',
        description: 'Seed destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(destinationReviews).values({
        id: reviewId,
        userId,
        destinationId,
        title: 'Seed Destination Review',
        content: 'Seed destination review content',
        rating: {
            landscape: 5,
            attractions: 4,
            accessibility: 4,
            safety: 4,
            cleanliness: 5,
            hospitality: 5,
            culturalOffer: 4,
            gastronomy: 5,
            affordability: 4,
            nightlife: 3,
            infrastructure: 4,
            environmentalCare: 4,
            wifiAvailability: 5,
            shopping: 4,
            beaches: 5,
            greenSpaces: 5,
            localEvents: 4,
            weatherSatisfaction: 5
        },
        averageRating: 4.39,
        lifecycleState: 'ACTIVE'
    } as typeof destinationReviews.$inferInsert);

    return { userId, destinationId, reviewId };
}

interface SeedOwnerPromotionOverrides {
    readonly ownerId?: string;
    readonly destinationId?: string;
    readonly accommodationId?: string;
    readonly promotionId?: string;
}

/**
 * Inserts the seedAccommodation chain (owner User + Destination + Accommodation)
 * plus an OwnerPromotion authored by the owner targeting the accommodation.
 * Used to validate `OwnerPromotionService.getById()` populates the `owner` and
 * `accommodation` relations.
 */
export async function seedOwnerPromotion(
    tx: DrizzleClient,
    overrides: SeedOwnerPromotionOverrides = {}
): Promise<{
    readonly ownerId: string;
    readonly destinationId: string;
    readonly accommodationId: string;
    readonly promotionId: string;
}> {
    const {
        userId: ownerId,
        destinationId,
        accommodationId
    } = await seedAccommodation(tx, {
        ownerId: overrides.ownerId,
        destinationId: overrides.destinationId,
        accommodationId: overrides.accommodationId
    });
    const promotionId = overrides.promotionId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(ownerPromotions).values({
        id: promotionId,
        slug: `seed-promo-${uid}`,
        ownerId,
        accommodationId,
        title: 'Seed Owner Promotion',
        description: 'Seed promotion description',
        discountType: 'percentage',
        discountValue: 15,
        validFrom: new Date(),
        lifecycleState: 'ACTIVE'
    } as typeof ownerPromotions.$inferInsert);

    return { ownerId, destinationId, accommodationId, promotionId };
}

interface SeedSponsorshipOverrides {
    readonly sponsorId?: string;
    readonly levelId?: string;
    readonly packageId?: string;
    readonly sponsorshipId?: string;
}

/**
 * Inserts the seedSponsorshipPackage chain (Level + Package), a sponsor User,
 * and a Sponsorship referencing all three. Used to validate
 * `SponsorshipService.getById()` populates the `sponsorUser`, `level`, and
 * `package` relations. The targetId is a random UUID with no FK constraint —
 * the relation we care about is the level/package/user trio.
 */
export async function seedSponsorship(
    tx: DrizzleClient,
    overrides: SeedSponsorshipOverrides = {}
): Promise<{
    readonly sponsorId: string;
    readonly levelId: string;
    readonly packageId: string;
    readonly sponsorshipId: string;
}> {
    const { levelId, packageId } = await seedSponsorshipPackage(tx, {
        levelId: overrides.levelId,
        packageId: overrides.packageId
    });
    const sponsorId = overrides.sponsorId ?? crypto.randomUUID();
    const sponsorshipId = overrides.sponsorshipId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: sponsorId,
        email: `seed-sponsor-${uid}@example.com`,
        displayName: 'Seed Sponsor',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(sponsorships).values({
        id: sponsorshipId,
        slug: `seed-sponsorship-${uid}`,
        sponsorUserId: sponsorId,
        targetType: 'event',
        targetId: crypto.randomUUID(),
        levelId,
        packageId,
        sponsorshipStatus: 'pending',
        lifecycleState: 'ACTIVE',
        startsAt: new Date()
    } as typeof sponsorships.$inferInsert);

    return { sponsorId, levelId, packageId, sponsorshipId };
}

interface SeedPostSponsorshipOverrides {
    readonly authorId?: string;
    readonly postId?: string;
    readonly sponsorId?: string;
    readonly sponsorshipId?: string;
    readonly linkPostToSponsorship?: boolean;
}

/**
 * Inserts the seedPost chain (author User + Post), a PostSponsor entity, and a
 * PostSponsorship row tying the post to the sponsor.
 *
 * NOTE: PostSponsorship.sponsor points at the `post_sponsors` table — a
 * brand/advertiser entity with name, logo, and contact info — NOT a user. This
 * differs from the SPEC-080 original wording ("sponsor User"), which was
 * inferred before the schema was inspected. The relation that PostService and
 * PostSponsorshipService load is the PostSponsor record, so seedPostSponsorship
 * inserts a PostSponsor rather than a second User.
 *
 * If `linkPostToSponsorship` is true (default), the inserted Post's
 * `sponsorshipId` column is updated to point at the new PostSponsorship so
 * PostService.getById can resolve the nested `sponsorship.sponsor` chain.
 */
export async function seedPostSponsorship(
    tx: DrizzleClient,
    overrides: SeedPostSponsorshipOverrides = {}
): Promise<{
    readonly authorId: string;
    readonly postId: string;
    readonly sponsorId: string;
    readonly sponsorshipId: string;
}> {
    const { authorId, postId } = await seedPost(tx, {
        authorId: overrides.authorId,
        postId: overrides.postId
    });
    const sponsorId = overrides.sponsorId ?? crypto.randomUUID();
    const sponsorshipId = overrides.sponsorshipId ?? crypto.randomUUID();

    await tx.insert(postSponsors).values({
        id: sponsorId,
        name: 'Seed Post Sponsor',
        type: 'POST_SPONSOR',
        description: 'Seed sponsor description',
        lifecycleState: 'ACTIVE'
    } as typeof postSponsors.$inferInsert);

    await tx.insert(postSponsorships).values({
        id: sponsorshipId,
        sponsorId,
        postId,
        description: 'Seed post sponsorship',
        paid: { price: 1000, currency: 'ARS' },
        lifecycleState: 'ACTIVE'
    } as typeof postSponsorships.$inferInsert);

    if (overrides.linkPostToSponsorship !== false) {
        await tx.update(posts).set({ sponsorshipId }).where(eq(posts.id, postId));
    }

    return { authorId, postId, sponsorId, sponsorshipId };
}

interface SeedEventOverrides {
    readonly authorId?: string;
    readonly destinationId?: string;
    readonly locationId?: string;
    readonly organizerId?: string;
    readonly eventId?: string;
    readonly tagId?: string;
}

/**
 * Inserts the full FK chain to validate `EventService.getById()` populates
 * `author`, `location`, `organizer`, and `tags` (many-to-many via r_entity_tag).
 *
 * Inserts: User (author) + Destination (required by EventLocation.destinationId)
 * + EventLocation + EventOrganizer + Event + Tag + r_entity_tag link row.
 */
export async function seedEvent(
    tx: DrizzleClient,
    overrides: SeedEventOverrides = {}
): Promise<{
    readonly authorId: string;
    readonly destinationId: string;
    readonly locationId: string;
    readonly organizerId: string;
    readonly eventId: string;
    readonly tagId: string;
}> {
    const authorId = overrides.authorId ?? crypto.randomUUID();
    const destinationId = overrides.destinationId ?? crypto.randomUUID();
    const locationId = overrides.locationId ?? crypto.randomUUID();
    const organizerId = overrides.organizerId ?? crypto.randomUUID();
    const eventId = overrides.eventId ?? crypto.randomUUID();
    const tagId = overrides.tagId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: authorId,
        email: `seed-event-author-${uid}@example.com`,
        displayName: 'Event Author',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `seed-event-dest-${uid}`,
        name: 'Event Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/seed/event-dest-${uid}`,
        summary: 'Event destination summary',
        description: 'Event destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(eventLocations).values({
        id: locationId,
        slug: `seed-event-loc-${uid}`,
        destinationId,
        placeName: 'Seed Event Venue',
        lifecycleState: 'ACTIVE'
    } as typeof eventLocations.$inferInsert);

    await tx.insert(eventOrganizers).values({
        id: organizerId,
        slug: `seed-event-org-${uid}`,
        name: 'Seed Event Organizer',
        description: 'Seed organizer description',
        lifecycleState: 'ACTIVE'
    } as typeof eventOrganizers.$inferInsert);

    await tx.insert(events).values({
        id: eventId,
        slug: `seed-event-${uid}`,
        name: 'Seed Event',
        summary: 'Seed event summary',
        description: 'Seed event description',
        category: 'OTHER',
        date: { start: new Date(), isAllDay: false },
        authorId,
        locationId,
        organizerId,
        destinationId,
        lifecycleState: 'ACTIVE'
    } as typeof events.$inferInsert);

    await tx.insert(tags).values({
        id: tagId,
        name: 'Seed Tag',
        type: 'SYSTEM',
        color: 'BLUE',
        lifecycleState: 'ACTIVE'
    } as typeof tags.$inferInsert);

    await tx.insert(rEntityTag).values({
        tagId,
        entityId: eventId,
        entityType: 'EVENT',
        // SPEC-086 made `assigned_by_id` NOT NULL with attribution semantics;
        // reuse the seeded author as the assigning actor.
        assignedById: authorId
    } as typeof rEntityTag.$inferInsert);

    return { authorId, destinationId, locationId, organizerId, eventId, tagId };
}

// ---------------------------------------------------------------------------
// SPEC-239 seed helpers — gastronomy commerce lifecycle
// ---------------------------------------------------------------------------

interface SeedGastronomyOverrides {
    readonly ownerId?: string;
    readonly destinationId?: string;
    readonly gastronomyId?: string;
    readonly visibility?: string;
    readonly lifecycleState?: string;
    readonly moderationState?: string;
}

/**
 * Inserts a User (owner), a Destination (CITY), and a Gastronomy listing
 * referencing both. Returns all three IDs.
 *
 * The gastronomy is created with `visibility=PRIVATE` and
 * `lifecycleState=INACTIVE` so reconciliation tests can assert the
 * PUBLIC/ACTIVE flip.
 *
 * @param tx - Drizzle transaction client (always rolled back after the test).
 * @param overrides - Optional ID / field overrides.
 * @returns Object containing `{ ownerId, destinationId, gastronomyId }`.
 */
export async function seedGastronomy(
    tx: DrizzleClient,
    overrides: SeedGastronomyOverrides = {}
): Promise<{
    readonly ownerId: string;
    readonly destinationId: string;
    readonly gastronomyId: string;
}> {
    const ownerId = overrides.ownerId ?? crypto.randomUUID();
    const destinationId = overrides.destinationId ?? crypto.randomUUID();
    const gastronomyId = overrides.gastronomyId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: ownerId,
        email: `seed-gastro-owner-${uid}@example.com`,
        displayName: 'Gastronomy Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `seed-gastro-dest-${uid}`,
        name: 'Gastronomy Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/seed/gastro-dest-${uid}`,
        summary: 'Seed gastronomy destination summary',
        description: 'Seed gastronomy destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-gastro-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(gastronomies).values({
        id: gastronomyId,
        slug: `seed-gastronomy-${uid}`,
        name: 'La Parrilla de Prueba',
        summary: 'A seed gastronomy listing summary',
        description: 'A seed gastronomy listing description for integration tests.',
        type: 'RESTAURANT',
        ownerId,
        destinationId,
        visibility: overrides.visibility ?? 'PRIVATE',
        lifecycleState: overrides.lifecycleState ?? 'INACTIVE',
        moderationState: overrides.moderationState ?? 'PENDING'
    } as typeof gastronomies.$inferInsert);

    return { ownerId, destinationId, gastronomyId };
}

interface SeedCommerceLeadOverrides {
    readonly leadId?: string;
    readonly email?: string;
    readonly contactName?: string;
    readonly businessName?: string;
    readonly domain?: string;
}

/**
 * Inserts a `commerce_leads` row (no FK dependencies beyond optional
 * destinationId). Returns the lead ID, email, and contact name so the
 * provisioning test can build the `CommerceLead` object.
 *
 * @param tx - Drizzle transaction client.
 * @param overrides - Optional field overrides.
 * @returns Object containing `{ leadId, email, contactName }`.
 */
export async function seedCommerceLead(
    tx: DrizzleClient,
    overrides: SeedCommerceLeadOverrides = {}
): Promise<{
    readonly leadId: string;
    readonly email: string;
    readonly contactName: string;
}> {
    const leadId = overrides.leadId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    const email = overrides.email ?? `lead-${uid}@example.com`;
    const contactName = overrides.contactName ?? `Lead Contact ${uid}`;
    const businessName = overrides.businessName ?? `Lead Business ${uid}`;
    const domain = overrides.domain ?? 'gastronomy';

    await tx.insert(commerceLeads).values({
        id: leadId,
        domain,
        businessName,
        contactName,
        email,
        status: 'new'
    } as typeof commerceLeads.$inferInsert);

    return { leadId, email, contactName };
}

interface SeedCommerceListingSubscriptionOverrides {
    readonly linkId?: string;
    readonly gastronomyId: string;
    readonly status: string;
}

/**
 * Seeds a `commerce_listing_subscriptions` link row tying a gastronomy
 * listing to a stub billing subscription row.
 *
 * Because the billing subscription table (`billing_subscriptions`) is managed
 * by `@qazuor/qzpay-drizzle`, we insert a minimal stub billing subscription
 * row first so the FK constraint is satisfied.
 *
 * @param tx - Drizzle transaction client.
 * @param options - Required `gastronomyId` and `status`; optional `linkId`.
 * @returns Object containing `{ linkId, subscriptionId }`.
 */
export async function seedCommerceListingSubscription(
    tx: DrizzleClient,
    options: SeedCommerceListingSubscriptionOverrides
): Promise<{
    readonly linkId: string;
    readonly subscriptionId: string;
}> {
    const linkId = options.linkId ?? crypto.randomUUID();
    const subscriptionId = crypto.randomUUID();

    // Insert a minimal billing_customers stub row first (billing_subscriptions
    // has a FK to billing_customers.id ON DELETE RESTRICT).
    const customerId = crypto.randomUUID();
    const uid = customerId.slice(0, 8);
    await tx.execute(sql`
        INSERT INTO billing_customers (
            id, external_id, email, livemode
        ) VALUES (
            ${customerId},
            ${`ext-${uid}`},
            ${`billing-stub-${uid}@test.local`},
            false
        )
    `);

    // Insert a minimal billing_subscriptions stub row to satisfy the FK from
    // commerce_listing_subscriptions.  Uses raw SQL to ensure billing_interval
    // (NOT NULL in the qzpay-drizzle schema) is provided without relying on
    // Drizzle client-side $defaultFn which does not fire inside raw tx contexts.
    await tx.execute(sql`
        INSERT INTO billing_subscriptions (
            id, customer_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, livemode
        ) VALUES (
            ${subscriptionId},
            ${customerId},
            ${crypto.randomUUID()},
            ${options.status},
            'month',
            now(),
            now() + interval '30 days',
            false
        )
    `);

    await tx.insert(commerceListingSubscriptions).values({
        id: linkId,
        subscriptionId,
        entityType: 'gastronomy',
        entityId: options.gastronomyId,
        status: options.status,
        productDomain: 'commerce'
    } as typeof commerceListingSubscriptions.$inferInsert);

    return { linkId, subscriptionId };
}

interface SeedGastronomyReviewOverrides {
    readonly reviewId?: string;
    readonly gastronomyId: string;
    readonly userId: string;
    readonly overallRating?: number;
    readonly moderationState?: string;
}

/**
 * Inserts a `gastronomy_reviews` row directly (bypassing the service layer)
 * for tests that need a pre-existing review to moderate.
 *
 * @param tx - Drizzle transaction client.
 * @param options - Required `gastronomyId` and `userId`.
 * @returns Object containing `{ reviewId }`.
 */
export async function seedGastronomyReview(
    tx: DrizzleClient,
    options: SeedGastronomyReviewOverrides
): Promise<{ readonly reviewId: string }> {
    const reviewId = options.reviewId ?? crypto.randomUUID();

    await tx.insert(gastronomyReviews).values({
        id: reviewId,
        gastronomyId: options.gastronomyId,
        userId: options.userId,
        rating: { food: 4, service: 4, ambiance: 3, value: 4 },
        averageRating: 3.75,
        overallRating: options.overallRating ?? 4,
        lifecycleState: 'ACTIVE',
        moderationState: options.moderationState ?? 'PENDING'
    } as typeof gastronomyReviews.$inferInsert);

    return { reviewId };
}
