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
    eq,
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    trials,
    users
} from '@repo/db';
import {
    type Accommodation,
    FLOOR_PLAN_ROLE,
    PermissionEnum,
    PRE_TRIAL_PLAN_ROLE,
    type PublicationStatusEnum,
    RoleEnum,
    TRIAL_PLAN_ROLE,
    VERTICAL_ACTIVATION_KEY,
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

async function ensureVersion(args: {
    readonly role: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly trialDays: number;
    readonly entitlements: readonly string[];
    readonly limit?: number;
}): Promise<void> {
    const db = getDb();
    const role = args.sellable ? null : args.role;
    const [existing] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            and(
                eq(planVersions.vertical, ACCOMMODATION),
                eq(planVersions.current, true),
                args.sellable ? eq(planVersions.sellable, true) : eq(plans.role, args.role)
            )
        )
        .limit(1);
    if (existing) return;
    await db.transaction(async (tx) => {
        const [plan] = await tx
            .insert(plans)
            .values({
                vertical: ACCOMMODATION,
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
                vertical: ACCOMMODATION,
                rank: args.rank,
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
                key: 'max_accommodations',
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
    await ensureVersion({
        role: FLOOR_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 0,
        entitlements: []
    });
    await ensureVersion({
        role: PRE_TRIAL_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 0,
        entitlements: [VERTICAL_ACTIVATION_KEY]
    });
    await ensureVersion({
        role: TRIAL_PLAN_ROLE,
        rank: 0,
        sellable: false,
        trialDays: 30,
        entitlements: [],
        limit: 1
    });
    await ensureVersion({
        role: 'sellable',
        rank: 10,
        sellable: true,
        trialDays: 30,
        entitlements: ['publish_accommodations', 'edit_accommodation_info'],
        limit: 1
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

/** Inserts an accommodation; `complete` adds everything the publish guard asks for. */
export async function createListing(args: {
    readonly ownerId: string;
    readonly destinationId: string;
    readonly status: PublicationStatusEnum;
    readonly complete?: boolean;
}): Promise<string> {
    const published = args.status === 'PUBLISHED';
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
            lifecycleState: published ? 'ACTIVE' : 'INACTIVE',
            visibility: published ? 'PUBLIC' : 'PRIVATE',
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

/** Inserts the trial row T1 would write, with the catalog's floor references. */
export async function createTrial(args: {
    readonly userId: string;
    readonly status: 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED';
    readonly emailPseudonym?: string;
}): Promise<void> {
    const db = getDb();
    const [trialVersion] = await db
        .select({ id: planVersions.id, planId: planVersions.planId })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(
            and(
                eq(plans.vertical, ACCOMMODATION),
                eq(plans.role, TRIAL_PLAN_ROLE),
                eq(planVersions.current, true)
            )
        )
        .limit(1);
    const sellable = and(
        eq(planVersions.vertical, ACCOMMODATION),
        eq(planVersions.sellable, true),
        eq(planVersions.current, true)
    );
    const [highest] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(sellable)
        .orderBy(desc(planVersions.rank))
        .limit(1);
    const [lowest] = await db
        .select({ id: planVersions.id })
        .from(planVersions)
        .where(sellable)
        .orderBy(asc(planVersions.rank))
        .limit(1);
    if (!trialVersion || !highest || !lowest) throw new Error('Trial catalog is missing');
    const active = args.status === 'TRIAL_ACTIVE';
    await db.insert(trials).values({
        userId: args.userId,
        vertical: ACCOMMODATION,
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
        readonly data?: { readonly id?: string };
        readonly error?: {
            readonly code?: string;
            readonly message?: string;
            readonly details?: Record<string, unknown>;
        };
    };
}> {
    return { status: response.status, body: await response.json() };
}
