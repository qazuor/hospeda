/**
 * Unit tests for `handleCommerceStartSubscription` (HOS-166 §6.3, §7.1),
 * the owner self-checkout route.
 *
 * Mirrors the mocking style of `test/routes/start-paid.test.ts`: the handler
 * is exported standalone and exercised against a mocked `Context`, with
 * `@repo/db`, billing, and the checkout service mocked at module boundaries.
 *
 * Covers:
 * - AC-2: ownership check — 403 for a non-owner, no MP call.
 * - AC-5: completeness gate — 422 with `missing`.
 * - AC-16: already-subscribed guard — 409 (active/trialing/past_due — HOS-166 W1).
 * - AC-4: missing billing customer self-heals instead of 400.
 * - D-7: plan-slug resolution — 503 when unset.
 * - 503 when billing is not configured.
 * - 404 when the listing does not exist.
 * - Happy path — 201-shaped result, correct customerId/entityType/entityId forwarded.
 *
 * @module test/routes/commerce/protected/start-subscription
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the route under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// resolveCommercePlanSlug reads HOSPEDA_COMMERCE_PLAN_ID from this module —
// mocked (not the resolver itself) so the REAL resolver logic runs, mirroring
// commerce-plan-resolver.test.ts's own convention.
const mockEnv = vi.hoisted<{
    HOSPEDA_COMMERCE_PLAN_ID?: string;
    HOSPEDA_SITE_URL: string;
    HOSPEDA_API_URL: string;
}>(() => ({
    HOSPEDA_COMMERCE_PLAN_ID: 'commerce-listing',
    HOSPEDA_SITE_URL: 'https://hospeda.test',
    HOSPEDA_API_URL: 'https://api.hospeda.test'
}));
vi.mock('../../../../src/utils/env', () => ({
    env: mockEnv,
    validateApiEnv: vi.fn()
}));

// Avoids pulling in the real create-app.ts (which eagerly calls
// validateApiEnv() and wires the full middleware stack) — this test exercises
// `handleCommerceStartSubscription` directly, never via a real HTTP request,
// so the router/route-factory scaffolding only needs to not throw on import.
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../../src/middlewares/authorization', () => ({
    protectedAuthMiddleware: vi.fn(() => (_c: unknown, next: () => Promise<void>) => next())
}));

const {
    mockGastronomyFindById,
    mockExperienceFindById,
    mockFindByGastronomies,
    mockFindByExperiences
} = vi.hoisted(() => ({
    mockGastronomyFindById: vi.fn(),
    mockExperienceFindById: vi.fn(),
    mockFindByGastronomies: vi.fn(),
    mockFindByExperiences: vi.fn()
}));
vi.mock('@repo/db', () => ({
    gastronomyModel: { findById: mockGastronomyFindById },
    experienceModel: { findById: mockExperienceFindById },
    // HOS-494: the featured image reaches the completeness gate through the
    // relational media tables, never off the raw listing row (HOS-372).
    gastronomyMediaModel: { findByGastronomies: mockFindByGastronomies },
    experienceMediaModel: { findByExperiences: mockFindByExperiences },
    // Required by role-permissions-cache.ts (loaded via the actor middleware
    // chain pulled in by the route module at module load — same fix as
    // test/routes/start-paid.test.ts). This test never resolves permissions
    // through it (the actor is injected directly via the mocked
    // getActorFromContext below), so empty findAll stubs suffice.
    RRolePermissionModel: class MockRRolePermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    },
    RUserPermissionModel: class MockRUserPermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    }
}));

const { mockGetQZPayBilling } = vi.hoisted(() => ({ mockGetQZPayBilling: vi.fn() }));
vi.mock('../../../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

const { mockGetCommerceListingSubscriptionStatus } = vi.hoisted(() => ({
    mockGetCommerceListingSubscriptionStatus: vi.fn()
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getCommerceListingSubscriptionStatus: mockGetCommerceListingSubscriptionStatus
    };
});

const { mockInitiateCommerceMonthlySubscription } = vi.hoisted(() => ({
    mockInitiateCommerceMonthlySubscription: vi.fn()
}));
vi.mock('../../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../../src/services/subscription-checkout.service')
        >();
    return {
        ...actual,
        initiateCommerceMonthlySubscription: mockInitiateCommerceMonthlySubscription
    };
});

const { mockEnsureCustomerExists } = vi.hoisted(() => ({ mockEnsureCustomerExists: vi.fn() }));
vi.mock('../../../../src/services/billing-customer-sync', () => ({
    BillingCustomerSyncService: class MockBillingCustomerSyncService {
        ensureCustomerExists = mockEnsureCustomerExists;
    }
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks).
// ──────────────────────────────────────────────────────────────────────────

import { CommerceEntityTypeEnum } from '@repo/schemas';
import { handleCommerceStartSubscription } from '../../../../src/routes/commerce/protected/start-subscription';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_ID = 'cust_owner';

/**
 * A fully-complete gastronomy listing row, shaped as the DB ACTUALLY returns it
 * since HOS-372 (see commerce-completeness.test.ts fixture for the composed
 * shape).
 *
 * REGRESSION ANCHOR (H-154 / HOS-494): this fixture deliberately carries NO
 * `media` key. HOS-372 dropped the `media` JSONB column from `gastronomies` /
 * `experiences`; the featured image now lives only in the relational
 * `gastronomy_media` / `experience_media` tables and is composed at read time.
 * The previous version of this fixture set `media.featuredImage` directly on the
 * raw row — a shape that has not existed in the database since that migration.
 * That fabricated key is the reason the suite stayed green while every commerce
 * checkout in production 422'd on `missing: ["media.featuredImage"]`. Do NOT add
 * a `media` key back here: the featured image must arrive through the mocked
 * media model, exactly as it does in production.
 */
function makeCompleteGastronomyRow(ownerId: string) {
    return {
        id: ENTITY_ID,
        ownerId,
        name: 'La Parrilla del Puerto',
        summary: 'A riverside parrilla with fresh grilled fish and steak.',
        description:
            'La Parrilla del Puerto has served the waterfront for over a decade, specializing in grilled fish and classic asado.',
        destinationId: '00000000-0000-4000-a000-000000000002',
        type: 'RESTAURANT',
        contactInfo: { personalEmail: 'owner@example.com' },
        openingHours: {
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                tue: { closed: true, shifts: [] },
                wed: { closed: true, shifts: [] },
                thu: { closed: true, shifts: [] },
                fri: { closed: true, shifts: [] },
                sat: { closed: true, shifts: [] },
                sun: { closed: true, shifts: [] }
            }
        },
        priceRange: 'MODERATE'
    };
}

/**
 * A relational commerce-media row, shaped as `gastronomy_media` /
 * `experience_media` store it (HOS-372). Only the columns
 * `composeCommerceMedia` reads are set.
 *
 * Defaults to the row that makes a listing publishable: `state: 'visible'` AND
 * `isFeatured: true`. Both conditions matter — see the archived/non-featured
 * regression tests below.
 */
function makeMediaRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        url: 'https://example.com/img.jpg',
        moderationState: 'APPROVED',
        state: 'visible',
        isFeatured: true,
        sortOrder: 0,
        ...overrides
    };
}

/** Builds the `Map<entityId, rows>` shape the batch media finders return. */
function mediaMap(rows: readonly unknown[]) {
    return new Map<string, unknown[]>([[ENTITY_ID, [...rows]]]);
}

interface ContextOptions {
    billingCustomerId?: string | null;
    actorId?: string;
    actorEmail?: string;
}

function createMockContext(opts: ContextOptions = {}) {
    const {
        billingCustomerId = CUSTOMER_ID,
        actorId = OWNER_ID,
        actorEmail = 'owner@example.com'
    } = opts;
    const store = new Map<string, unknown>([
        ['billingCustomerId', billingCustomerId],
        ['user', null],
        [
            'actor',
            {
                id: actorId,
                email: actorEmail,
                name: 'Owner',
                roles: ['COMMERCE_OWNER'],
                permissions: []
            }
        ]
    ]);
    return {
        get: vi.fn((key: string) => store.get(key)),
        json: vi.fn(
            (body: unknown, status: number) =>
                new Response(JSON.stringify(body), {
                    status,
                    headers: { 'content-type': 'application/json' }
                })
        )
    };
}

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: (ctx: { get: (key: string) => unknown }) => ctx.get('actor')
}));

const DEFAULT_BILLING = {
    plans: { list: vi.fn() },
    subscriptions: { create: vi.fn() }
};

describe('handleCommerceStartSubscription (HOS-166 §6.3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = 'commerce-listing';
        mockGetQZPayBilling.mockReturnValue(DEFAULT_BILLING);
        mockGetCommerceListingSubscriptionStatus.mockResolvedValue(null);
        mockGastronomyFindById.mockResolvedValue(makeCompleteGastronomyRow(OWNER_ID));
        mockFindByGastronomies.mockResolvedValue(mediaMap([makeMediaRow()]));
        mockFindByExperiences.mockResolvedValue(mediaMap([makeMediaRow()]));
        mockInitiateCommerceMonthlySubscription.mockResolvedValue({
            checkoutUrl: 'https://mp.test/checkout',
            localSubscriptionId: 'sub-local-1',
            expiresAt: new Date().toISOString()
        });
    });

    // ── AC-2: ownership check ────────────────────────────────────────────

    it('returns 403 when the caller does not own the listing (AC-2)', async () => {
        mockGastronomyFindById.mockResolvedValue(makeCompleteGastronomyRow(OTHER_USER_ID));
        const ctx = createMockContext({ actorId: OWNER_ID });

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 403 });

        expect(mockInitiateCommerceMonthlySubscription).not.toHaveBeenCalled();
    });

    it('returns 404 when the listing does not exist', async () => {
        mockGastronomyFindById.mockResolvedValue(null);
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 404 });
    });

    it('proceeds when actor.id === listing.ownerId', async () => {
        const ctx = createMockContext({ actorId: OWNER_ID });

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
        expect(mockInitiateCommerceMonthlySubscription).toHaveBeenCalledTimes(1);
    });

    // ── AC-5: completeness gate ──────────────────────────────────────────

    it('returns a 422 Response with `missing` when the listing is incomplete (AC-5)', async () => {
        mockGastronomyFindById.mockResolvedValue({
            id: ENTITY_ID,
            ownerId: OWNER_ID,
            name: 'Draft'
        });
        // A bare draft has uploaded no photos either, so the relational media
        // table is empty for it — that is what makes `media.featuredImage`
        // legitimately missing here.
        mockFindByGastronomies.mockResolvedValue(new Map());
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).toBeInstanceOf(Response);
        const response = result as Response;
        expect(response.status).toBe(422);
        const body = (await response.json()) as { error: { missing: string[] } };
        expect(body.error.missing.length).toBeGreaterThan(0);
        expect(body.error.missing).toContain('media.featuredImage');
        expect(mockInitiateCommerceMonthlySubscription).not.toHaveBeenCalled();
    });

    // ── H-154 / HOS-494: the featured image lives in the relational table ─
    //
    // HOS-372 dropped the `media` JSONB column. The gate must therefore compose
    // `media` from `gastronomy_media` / `experience_media` instead of reading it
    // off the raw row, where it can no longer exist. Before the fix every one of
    // these listings 422'd on `media.featuredImage`, blocking commerce checkout
    // in production for BOTH verticals.

    it('passes the completeness gate when the featured image exists only in gastronomy_media (H-154)', async () => {
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
        expect(mockFindByGastronomies).toHaveBeenCalledWith(
            expect.objectContaining({ gastronomyIds: [ENTITY_ID] })
        );
        expect(mockInitiateCommerceMonthlySubscription).toHaveBeenCalledTimes(1);
    });

    it('passes the completeness gate when the featured image exists only in experience_media (H-154)', async () => {
        mockExperienceFindById.mockResolvedValue({
            ...makeCompleteGastronomyRow(OWNER_ID),
            priceFrom: 1_500_000,
            isPriceOnRequest: false
        });
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
        expect(mockFindByExperiences).toHaveBeenCalledWith(
            expect.objectContaining({ experienceIds: [ENTITY_ID] })
        );
        expect(mockInitiateCommerceMonthlySubscription).toHaveBeenCalledTimes(1);
    });

    it('still 422s when the listing has no media rows at all', async () => {
        mockFindByGastronomies.mockResolvedValue(new Map());
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(422);
        const body = (await (result as Response).json()) as { error: { missing: string[] } };
        expect(body.error.missing).toContain('media.featuredImage');
        expect(mockInitiateCommerceMonthlySubscription).not.toHaveBeenCalled();
    });

    it('still 422s when media rows exist but none is featured', async () => {
        mockFindByGastronomies.mockResolvedValue(mediaMap([makeMediaRow({ isFeatured: false })]));
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(422);
        const body = (await (result as Response).json()) as { error: { missing: string[] } };
        expect(body.error.missing).toContain('media.featuredImage');
    });

    // Pins the COMPOSITION semantics, not a reachable production state: a CHECK
    // constraint on both media tables
    // (`chk_{gastronomy,experience}_media_featured_not_archived`) already makes an
    // archived featured row impossible to write. The assertion is that the gate
    // decides via `composeCommerceMedia`'s `state === 'visible'` rule rather than a
    // looser read such as `findFeatured` — so the gate keeps matching what the
    // public listing renders even if that constraint is ever relaxed.
    it('still 422s when the only featured row is archived rather than visible', async () => {
        mockFindByGastronomies.mockResolvedValue(
            mediaMap([makeMediaRow({ state: 'archived', isFeatured: true })])
        );
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(422);
        const body = (await (result as Response).json()) as { error: { missing: string[] } };
        expect(body.error.missing).toContain('media.featuredImage');
    });

    // ── AC-16: already-subscribed guard ──────────────────────────────────

    it('returns 409 when an active subscription already exists (AC-16)', async () => {
        mockGetCommerceListingSubscriptionStatus.mockResolvedValue('active');
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 409 });

        expect(mockInitiateCommerceMonthlySubscription).not.toHaveBeenCalled();
    });

    it('returns 409 when a trialing subscription already exists', async () => {
        mockGetCommerceListingSubscriptionStatus.mockResolvedValue('trialing');
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 409 });
    });

    it('returns 409 when a past_due (dunning) subscription already exists (HOS-166 W1)', async () => {
        mockGetCommerceListingSubscriptionStatus.mockResolvedValue('past_due');
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 409 });

        expect(mockInitiateCommerceMonthlySubscription).not.toHaveBeenCalled();
    });

    it('does NOT 409 for a cancelled prior subscription', async () => {
        mockGetCommerceListingSubscriptionStatus.mockResolvedValue('cancelled');
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
    });

    // ── D-7: plan slug / billing configuration ───────────────────────────

    it('returns 503 when HOSPEDA_COMMERCE_PLAN_ID is unset', async () => {
        mockEnv.HOSPEDA_COMMERCE_PLAN_ID = undefined;
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    it('returns 503 when billing is not configured', async () => {
        mockGetQZPayBilling.mockReturnValue(null);
        const ctx = createMockContext();

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 503 });
    });

    // ── AC-4: missing billing customer self-heals ────────────────────────

    it('self-heals a missing billing customer instead of 400ing (AC-4)', async () => {
        mockEnsureCustomerExists.mockResolvedValue('cust_healed');
        const ctx = createMockContext({ billingCustomerId: null });

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
        expect(mockEnsureCustomerExists).toHaveBeenCalledWith(
            expect.objectContaining({ userId: OWNER_ID })
        );
        expect(mockInitiateCommerceMonthlySubscription).toHaveBeenCalledWith(
            expect.objectContaining({ customerId: 'cust_healed' })
        );
    });

    it('returns 400 when the customer cannot be resolved even after self-heal', async () => {
        mockEnsureCustomerExists.mockResolvedValue(null);
        const ctx = createMockContext({ billingCustomerId: null });

        await expect(
            handleCommerceStartSubscription(ctx as never, {
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        ).rejects.toMatchObject({ status: 400 });
    });

    // ── Happy path ────────────────────────────────────────────────────────

    it('forwards customerId, planSlug, entityType, entityId to initiateCommerceMonthlySubscription', async () => {
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.GASTRONOMY,
            entityId: ENTITY_ID
        });

        expect(result).toMatchObject({ localSubscriptionId: 'sub-local-1' });
        expect(mockInitiateCommerceMonthlySubscription).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: CUSTOMER_ID,
                planSlug: 'commerce-listing',
                entityType: CommerceEntityTypeEnum.GASTRONOMY,
                entityId: ENTITY_ID
            })
        );
    });

    it('dispatches to experienceModel for entityType=experience', async () => {
        mockExperienceFindById.mockResolvedValue({
            ...makeCompleteGastronomyRow(OWNER_ID),
            priceFrom: 1_500_000,
            isPriceOnRequest: false
        });
        const ctx = createMockContext();

        const result = await handleCommerceStartSubscription(ctx as never, {
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            entityId: ENTITY_ID
        });

        expect(result).not.toBeInstanceOf(Response);
        expect(mockGastronomyFindById).not.toHaveBeenCalled();
        expect(mockExperienceFindById).toHaveBeenCalledWith(ENTITY_ID);
    });
});
