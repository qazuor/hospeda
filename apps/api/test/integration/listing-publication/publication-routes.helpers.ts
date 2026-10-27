/**
 * Shared fixtures for the HTTP publication matrix (HOS-1471, TEST:V6:2/3).
 *
 * The matrix drives `POST /protected/accommodations/:id/publish|unpublish`
 * through the REAL app: mock-actor authentication, the protected tier, shape
 * validation, the ownership middleware and the V5 listing chain (with its
 * production coverage reader and effective set against the migrated catalog).
 *
 * Only the publication ports of `src/utils/listing-publication/ports.ts` are
 * replaced, and only partially: the unit of work is still the production
 * transaction with the advisory lock, but its `readPublishLimit` answers from
 * {@link publicationControls}; PB1's coverage, the clock and the post-commit
 * effects are controllable too.
 */
import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodationMedia,
    and,
    asc,
    desc,
    destinations,
    ExperienceModel,
    eq,
    experienceMedia,
    experiences,
    gastronomies,
    gastronomyMedia,
    getDb,
    inArray,
    max,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    trials,
    users,
    VenueModel
} from '@repo/db';
import {
    type Accommodation,
    type Experience,
    FLOOR_PLAN_ROLE,
    PermissionEnum,
    PRE_TRIAL_PLAN_ROLE,
    type PublicationStatusEnum,
    RoleEnum,
    TRIAL_PLAN_ROLE,
    VERTICAL_ACTIVATION_KEY,
    type Venue,
    VerticalEnum
} from '@repo/schemas';
import { vi } from 'vitest';

type PortsModule = typeof import('../../../src/utils/listing-publication/ports');
type PublicationPorts = ReturnType<PortsModule['getListingPublicationPorts']>;
type CoverageResponse = Awaited<ReturnType<PublicationPorts['billing']['coverage']>>;
type AfterCommit = PublicationPorts['afterCommit'];

/** The instant every layer of the matrix reads. */
export const MATRIX_NOW = new Date('2026-10-10T12:00:00.000Z');
const DAY = 86_400_000;
const ACCOMMODATION = VerticalEnum.ACCOMMODATION;

const LIMIT_KEY_BY_VERTICAL = {
    accommodation: 'max_accommodations',
    gastronomy: 'max_venues',
    experience: 'max_experiences'
} as const;

const PUBLISH_KEY_BY_VERTICAL = {
    accommodation: 'publish_accommodations',
    gastronomy: 'publish_venue',
    experience: 'publish_experience'
} as const;

const EDIT_KEY_BY_VERTICAL = {
    accommodation: 'edit_accommodation_info',
    gastronomy: 'edit_venue_info',
    experience: 'edit_experience_info'
} as const;

/** Mutable answers of the replaced publication ports; reset per test. */
export const publicationControls = {
    covered: false,
    limit: 1,
    emitCoverageChanged: vi.fn<AfterCommit['emitCoverageChanged']>(async () => undefined),
    revalidate: vi.fn<AfterCommit['revalidate']>(async () => undefined),
    invalidateUser: vi.fn<AfterCommit['invalidateUser']>(async () => undefined)
};

/** Restores the default port answers: uncovered, one slot, fresh spies. */
export function resetPublicationControls(): void {
    publicationControls.covered = false;
    publicationControls.limit = 1;
    publicationControls.emitCoverageChanged.mockClear();
    publicationControls.revalidate.mockClear();
    publicationControls.invalidateUser.mockClear();
}

/**
 * Wraps the production publication ports, replacing only coverage, limit,
 * clock and post-commit effects. Used as the `vi.mock` factory of `ports.ts`.
 */
export function buildMatrixPublicationPorts(actual: PortsModule): PortsModule {
    return {
        ...actual,
        getListingPublicationPorts: () => {
            const real = actual.getListingPublicationPorts();
            return {
                unitOfWork: {
                    runLocked: (args, work) =>
                        real.unitOfWork.runLocked(args, (tx) =>
                            work({ ...tx, readPublishLimit: async () => publicationControls.limit })
                        )
                },
                billing: {
                    ...real.billing,
                    coverage: async (): Promise<CoverageResponse> => ({
                        covered: publicationControls.covered,
                        sources: []
                    })
                },
                clock: { now: () => MATRIX_NOW },
                afterCommit: {
                    emitCoverageChanged: (event) => publicationControls.emitCoverageChanged(event),
                    revalidate: (input) => publicationControls.revalidate(input),
                    async invalidateUser(input) {
                        await publicationControls.invalidateUser(input);
                        await real.afterCommit.invalidateUser(input);
                    }
                }
            };
        }
    };
}

/** Mock-actor headers; `HOSPEDA_ALLOW_MOCK_ACTOR` must be on. */
export function actorHeaders(args: {
    readonly id: string;
    readonly role?: RoleEnum;
    readonly permissions?: readonly PermissionEnum[];
}): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': args.id,
        'x-mock-actor-role': args.role ?? RoleEnum.HOST,
        'x-mock-actor-permissions': JSON.stringify(
            args.permissions ?? [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        )
    };
}

/** Ids of the plan versions that grant `key`, as a subquery. */
function versionsHolding(key: string) {
    return getDb()
        .select({ id: planVersionEntitlements.planVersionId })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.key, key));
}

/** Ids of the plan versions that carry a `key` limit row, as a subquery. */
function versionsLimiting(key: string) {
    return getDb()
        .select({ id: planVersionLimits.planVersionId })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.key, key));
}

async function ensureVersion(args: {
    readonly vertical:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.VENUE
        | typeof VerticalEnum.EXPERIENCE;
    readonly role: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly trialDays: number;
    readonly entitlements: readonly string[];
    readonly limit?: number;
    /**
     * An entitlement the reused version must hold. Other suites sharing this
     * database leave current sellable versions with no entitlements at all, so
     * "some current sellable version exists" does not mean the matrix's does.
     */
    readonly requiredKey?: string;
}): Promise<void> {
    const db = getDb();
    const role = args.sellable ? null : args.role;
    const [existing] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            and(
                eq(planVersions.vertical, args.vertical),
                eq(planVersions.current, true),
                args.sellable ? eq(planVersions.sellable, true) : eq(plans.role, args.role),
                args.requiredKey === undefined
                    ? undefined
                    : inArray(planVersions.id, versionsHolding(args.requiredKey))
            )
        )
        .limit(1);
    if (existing) return;
    await db.transaction(async (tx) => {
        // `uq_plan_version_sellable_current_rank`: a sellable version takes the
        // next free rank above whatever current sellable versions are left behind.
        const [top] = args.sellable
            ? await tx
                  .select({ rank: max(planVersions.rank) })
                  .from(planVersions)
                  .where(
                      and(
                          eq(planVersions.vertical, args.vertical),
                          eq(planVersions.sellable, true),
                          eq(planVersions.current, true)
                      )
                  )
            : [];
        const rank = Math.max(args.rank, (top?.rank ?? -1) + 1);
        // A non-sellable role is unique per vertical (`uq_plan_vertical_role`), and other
        // suites sharing this database can leave that plan behind without a current
        // version: reuse it instead of inserting a second one.
        const [rolePlan] =
            role === null
                ? []
                : await tx
                      .select({ id: plans.id })
                      .from(plans)
                      .where(and(eq(plans.vertical, args.vertical), eq(plans.role, role)))
                      .limit(1);
        const [plan] = rolePlan
            ? [rolePlan]
            : await tx
                  .insert(plans)
                  .values({
                      vertical: args.vertical,
                      slug: `matrix-${args.role}-${randomUUID()}`,
                      name: `Matrix ${args.role}`,
                      role
                  })
                  .returning({ id: plans.id });
        if (!plan) throw new Error('Catalog plan insert failed');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: args.vertical,
                rank,
                sellable: args.sellable,
                current: true,
                trialDays: args.trialDays,
                graceDays: 10,
                allowsPause: false,
                inheritsTouristVip: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Catalog version insert failed');
        if (args.entitlements.length > 0) {
            await tx.insert(planVersionEntitlements).values(
                args.entitlements.map((key) => ({
                    planVersionId: version.id,
                    key,
                    planQuota: null,
                    trialQuota: null
                }))
            );
        }
        if (args.limit !== undefined) {
            await tx.insert(planVersionLimits).values({
                planVersionId: version.id,
                key: LIMIT_KEY_BY_VERTICAL[args.vertical],
                value: args.limit
            });
        }
    });
}

/**
 * Makes sure the accommodation catalog the V5 chain and T1 read exists.
 * Migration 0144 provides it, but the plan-publication suites TRUNCATE the
 * catalog and all `hospeda-api` integration files share one database.
 */
export async function ensureAccommodationCatalog(): Promise<void> {
    return ensurePublicationCatalog(ACCOMMODATION);
}

/** Makes sure the V5 and T1 plan catalog exists for one listing vertical. */
export async function ensurePublicationCatalog(
    vertical:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.VENUE
        | typeof VerticalEnum.EXPERIENCE
): Promise<void> {
    const publishKey = PUBLISH_KEY_BY_VERTICAL[vertical];
    const editKey = EDIT_KEY_BY_VERTICAL[vertical];
    await ensureVersion({
        vertical,
        role: FLOOR_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 0,
        entitlements: []
    });
    await ensureVersion({
        vertical,
        role: PRE_TRIAL_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 0,
        entitlements: [VERTICAL_ACTIVATION_KEY]
    });
    await ensureVersion({
        vertical,
        role: TRIAL_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 30,
        entitlements: [],
        limit: 1
    });
    await ensureVersion({
        vertical,
        role: 'sellable',
        rank: 10,
        sellable: true,
        trialDays: 30,
        entitlements: [publishKey, editKey],
        limit: 1,
        requiredKey: editKey
    });
}

/** Inserts an owner account; an unusable mailbox when `email` says so. */
export async function createOwner(args: { readonly email?: string } = {}): Promise<{
    readonly id: string;
    readonly email: string;
}> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: args.email ?? `matrix-${randomUUID()}@example.test`,
            displayName: 'Matrix owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id, email: users.email });
    if (!user) throw new Error('Owner insert failed');
    return user;
}

/** Inserts a destination for listing fixtures. */
export async function createDestination(): Promise<string> {
    const [destination] = await getDb()
        .insert(destinations)
        .values({
            name: `Matrix ${randomUUID()}`,
            slug: `matrix-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path: '/matrix',
            pathIds: randomUUID(),
            summary: 'Matrix fixture',
            description: 'Matrix fixture destination',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Destination insert failed');
    return destination.id;
}

/** Inserts a destination with a unique path for multi-listing vertical fixtures. */
export async function createVerticalDestination(): Promise<string> {
    const path = `/matrix-${randomUUID()}`;
    const [destination] = await getDb()
        .insert(destinations)
        .values({
            name: `Matrix ${randomUUID()}`,
            slug: `matrix-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path,
            pathIds: randomUUID(),
            summary: 'Matrix fixture',
            description: 'Matrix fixture destination',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!destination) throw new Error('Destination insert failed');
    return destination.id;
}

/** Inserts an accommodation; `complete` adds everything the publish guard asks for. */
export async function createListing(args: {
    readonly ownerId: string;
    readonly destinationId: string;
    readonly status: PublicationStatusEnum;
    readonly complete?: boolean;
}): Promise<string> {
    const listing = await new AccommodationModel().create(
        {
            name: 'Matrix listing',
            slug: `matrix-${randomUUID()}`,
            summary: 'Matrix fixture',
            description: 'Matrix fixture listing description',
            ownerId: args.ownerId,
            createdById: args.ownerId,
            destinationId: args.destinationId,
            type: 'CABIN',
            publicationStatus: args.status,
            ...(args.complete === false
                ? {}
                : { extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 } })
        } as Partial<Accommodation>,
        getDb()
    );
    if (args.complete !== false) {
        await getDb().insert(accommodationMedia).values({
            accommodationId: listing.id,
            url: 'https://example.test/matrix.jpg',
            moderationState: 'APPROVED',
            state: 'visible',
            isFeatured: true,
            sortOrder: 0
        });
    }
    return listing.id;
}

/** Creates a gastronomy or experience listing for TEST:V6:2/3. */
export async function createVerticalListing(args: {
    readonly vertical: typeof VerticalEnum.VENUE | typeof VerticalEnum.EXPERIENCE;
    readonly ownerId: string;
    readonly destinationId: string;
    readonly status: PublicationStatusEnum;
    readonly complete?: boolean;
}): Promise<string> {
    const common = {
        name: 'Matrix listing',
        slug: `matrix-${randomUUID()}`,
        summary: 'A complete listing summary',
        description: 'A complete listing description for publication tests.',
        ownerId: args.ownerId,
        createdById: args.ownerId,
        destinationId: args.destinationId,
        publicationStatus: args.status,
        contactInfo: { workPhone: '+541100000000' }
    };
    if (args.vertical === VerticalEnum.VENUE) {
        const listing = await new VenueModel().create(
            {
                ...common,
                type: 'RESTAURANT',
                priceRange: 'MID',
                openingHours: {
                    timezone: 'America/Argentina/Buenos_Aires',
                    days: {
                        mon: { closed: false, shifts: [{ open: '09:00', close: '17:00' }] },
                        tue: { closed: true, shifts: [] },
                        wed: { closed: true, shifts: [] },
                        thu: { closed: true, shifts: [] },
                        fri: { closed: true, shifts: [] },
                        sat: { closed: true, shifts: [] },
                        sun: { closed: true, shifts: [] }
                    }
                }
            } as unknown as Partial<Venue>,
            getDb()
        );
        if (args.complete !== false) {
            await getDb().insert(gastronomyMedia).values({
                gastronomyId: listing.id,
                url: 'https://example.test/matrix.jpg',
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: true,
                sortOrder: 0
            });
        }
        return listing.id;
    }
    const listing = await new ExperienceModel().create(
        { ...common, type: 'EXCURSION', priceFrom: 1000 } as Partial<Experience>,
        getDb()
    );
    if (args.complete !== false) {
        await getDb().insert(experienceMedia).values({
            experienceId: listing.id,
            url: 'https://example.test/matrix.jpg',
            moderationState: 'APPROVED',
            state: 'visible',
            isFeatured: true,
            sortOrder: 0
        });
    }
    return listing.id;
}

/** Reads a listing's publication status from its vertical table. */
export async function readVerticalStatus(
    vertical: typeof VerticalEnum.VENUE | typeof VerticalEnum.EXPERIENCE,
    id: string
) {
    if (vertical === VerticalEnum.VENUE) {
        const [row] = await getDb()
            .select({ status: gastronomies.publicationStatus })
            .from(gastronomies)
            .where(eq(gastronomies.id, id));
        return row?.status;
    }
    const [row] = await getDb()
        .select({ status: experiences.publicationStatus })
        .from(experiences)
        .where(eq(experiences.id, id));
    return row?.status;
}

/** Inserts the trial row T1 would write, with the catalog's floor references. */
export async function createTrial(args: {
    readonly userId: string;
    readonly vertical?:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.VENUE
        | typeof VerticalEnum.EXPERIENCE;
    readonly status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED';
    readonly emailPseudonym?: string;
}): Promise<void> {
    const db = getDb();
    const vertical = args.vertical ?? ACCOMMODATION;
    const [trialVersion] = await db
        .select({ id: planVersions.id, planId: planVersions.planId })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            and(
                eq(plans.vertical, vertical),
                eq(plans.role, TRIAL_PLAN_ROLE),
                eq(planVersions.current, true)
            )
        )
        .limit(1);
    // The floors are anchored on versions that carry what the matrix needs, not
    // on the catalog's extremes: other suites sharing this database leave current
    // sellable versions with no entitlements and no limits at the top rank, and a
    // trial floored on one of those has no EDIT capability at all.
    const sellable = and(
        eq(planVersions.vertical, vertical),
        eq(planVersions.sellable, true),
        eq(planVersions.current, true)
    );
    const [highest] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
            and(sellable, inArray(planVersions.id, versionsHolding(EDIT_KEY_BY_VERTICAL[vertical])))
        )
        .orderBy(desc(planVersions.rank))
        .limit(1);
    const [lowest] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(
            and(
                sellable,
                inArray(planVersions.id, versionsLimiting(LIMIT_KEY_BY_VERTICAL[vertical]))
            )
        )
        .orderBy(asc(planVersions.rank))
        .limit(1);
    if (!trialVersion || !highest || !lowest) throw new Error('Trial catalog is missing');
    const active = args.status === 'TRIAL_ACTIVE';
    await db.insert(trials).values({
        userId: args.userId,
        vertical,
        status: args.status,
        trialPlanId: trialVersion.planId,
        floorEntitlementsVersionId: highest.id,
        floorLimitsVersionId: lowest.id,
        floorTrialPlanVersionId: trialVersion.id,
        startedAt: new Date(MATRIX_NOW.getTime() - (active ? 5 : 40) * DAY),
        endsAt: new Date(MATRIX_NOW.getTime() + (active ? 25 : -10) * DAY),
        emailPseudonym:
            args.emailPseudonym ??
            randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', ''),
        deadlinesVersion: 1
    });
}

/** Parses an API response into status, data and error code. */
export async function readResponse(response: Response): Promise<{
    readonly status: number;
    readonly body: {
        readonly data?: {
            readonly id?: string;
            readonly amenityIds?: readonly string[];
            readonly featureIds?: readonly string[];
            readonly meetingPointDirectionsEnabled?: boolean;
        };
        readonly error?: {
            readonly code?: string;
            readonly message?: string;
            readonly details?: Record<string, unknown>;
        };
    };
}> {
    return { status: response.status, body: await response.json() };
}
