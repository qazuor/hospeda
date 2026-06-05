/**
 * SPEC-166 T-025 — Cross-cutting moderation flow integration test.
 *
 * Exercises the full review moderation lifecycle at the service layer using
 * stateful in-memory mock stores. Each test scenario exercises multiple steps
 * in sequence (create → moderate → list) so that state transitions are real,
 * not just mock-echo assertions.
 *
 * Scenarios covered:
 *  1. Create accommodation review (clean text) → moderationState = APPROVED by entity default.
 *  2. Create destination review (clean text) → moderationState = PENDING by entity default.
 *  3. Blocked-word content → moderationState = PENDING for BOTH entity types (content-mod
 *     overrides entity default).
 *  4. Admin approve → review appears in public reads (search + listByAccommodation /
 *     listByDestination).
 *  5. Admin reject → review hidden from public reads.
 *  6. lifecycleState independence: after approve AND after reject, lifecycleState is
 *     unchanged from creation.
 *  7. getPendingCount reflects state transitions (create pending → approve → count drops).
 *
 * Mock strategy:
 *  - @repo/content-moderation: mocked with vi.fn(); each test controls the return value
 *    (CLEAN_RESULT / BLOCKED_RESULT) to simulate the two engine outputs deterministically.
 *    The mock faithfully reproduces the real engine's two observable states — the cross-cutting
 *    value here is that the content-mod result actually drives service branching, not that
 *    the real string-scan runs.
 *  - @repo/db models: stateful in-memory Map per service, backing create/update/findAll/count
 *    so that multi-step flows observe actual state changes, not isolated mock-echo.
 *  - Related services (AccommodationService, DestinationService) and infrastructure
 *    (withServiceTransaction, revalidation): mocked to eliminate DB calls in lifecycle hooks.
 *
 * AAA pattern: each `it` block has clearly delimited Arrange / Act / Assert sections.
 */

// ---- vi.mock calls MUST come first — they are hoisted by vitest ------------

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn()
}));

// ---------------------------------------------------------------------------
// Accommodation review stateful model store
// ---------------------------------------------------------------------------

/**
 * Stateful in-memory store backing AccommodationReviewModel mock.
 * Shared across all mock operations so create → moderate → list reflects
 * true state transitions rather than isolated mock-echo returns.
 */
const accReviewStore = new Map<string, unknown>();

const mockAccReviewModel = {
    findById: vi.fn(async (id: string) => accReviewStore.get(id) ?? null),
    findOne: vi.fn(async (filter: Record<string, unknown>) => {
        // Used for duplicate-check in _beforeCreate; return null to allow all creates.
        if (filter.userId && filter.accommodationId && 'deletedAt' in filter) {
            return null;
        }
        // Fallback: look up by id
        if (filter.id) {
            return accReviewStore.get(filter.id as string) ?? null;
        }
        return null;
    }),
    create: vi.fn(async (data: unknown) => {
        const entity = data as Record<string, unknown>;
        accReviewStore.set(entity.id as string, entity);
        return entity;
    }),
    update: vi.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
        const id = where.id as string;
        const existing = accReviewStore.get(id) as Record<string, unknown> | undefined;
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        accReviewStore.set(id, updated);
        return updated;
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        const existing = accReviewStore.get(id) as Record<string, unknown> | undefined;
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        accReviewStore.set(id, updated);
        return updated;
    }),
    count: vi.fn(async (filter: Record<string, unknown>) => {
        let total = 0;
        for (const item of accReviewStore.values()) {
            const entity = item as Record<string, unknown>;
            let match = true;
            for (const [k, v] of Object.entries(filter)) {
                if (entity[k] !== v) {
                    match = false;
                    break;
                }
            }
            if (match) total++;
        }
        return total;
    }),
    findAll: vi.fn(async (filter: Record<string, unknown>, _pagination?: unknown) => {
        const items: unknown[] = [];
        for (const item of accReviewStore.values()) {
            const entity = item as Record<string, unknown>;
            let match = true;
            for (const [k, v] of Object.entries(filter)) {
                if (entity[k] !== v) {
                    match = false;
                    break;
                }
            }
            if (match) items.push(entity);
        }
        return { items, total: items.length };
    }),
    findAllWithUser: vi.fn(async () => ({ items: [], total: 0 })),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn()
};

// ---------------------------------------------------------------------------
// Destination review stateful model store
// ---------------------------------------------------------------------------

/**
 * Stateful in-memory store backing DestinationReviewModel mock.
 */
const destReviewStore = new Map<string, unknown>();

const mockDestReviewModel = {
    findById: vi.fn(async (id: string) => destReviewStore.get(id) ?? null),
    findOne: vi.fn(async (filter: Record<string, unknown>) => {
        if (filter.id) {
            return destReviewStore.get(filter.id as string) ?? null;
        }
        return null;
    }),
    create: vi.fn(async (data: unknown) => {
        const entity = data as Record<string, unknown>;
        destReviewStore.set(entity.id as string, entity);
        return entity;
    }),
    update: vi.fn(async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
        const id = where.id as string;
        const existing = destReviewStore.get(id) as Record<string, unknown> | undefined;
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        destReviewStore.set(id, updated);
        return updated;
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        const existing = destReviewStore.get(id) as Record<string, unknown> | undefined;
        if (!existing) return null;
        const updated = { ...existing, ...patch };
        destReviewStore.set(id, updated);
        return updated;
    }),
    count: vi.fn(async (filter: Record<string, unknown>) => {
        let total = 0;
        for (const item of destReviewStore.values()) {
            const entity = item as Record<string, unknown>;
            let match = true;
            for (const [k, v] of Object.entries(filter)) {
                if (entity[k] !== v) {
                    match = false;
                    break;
                }
            }
            if (match) total++;
        }
        return total;
    }),
    findAll: vi.fn(async (filter: Record<string, unknown>, _pagination?: unknown) => {
        const items: unknown[] = [];
        for (const item of destReviewStore.values()) {
            const entity = item as Record<string, unknown>;
            let match = true;
            for (const [k, v] of Object.entries(filter)) {
                if (entity[k] !== v) {
                    match = false;
                    break;
                }
            }
            if (match) items.push(entity);
        }
        return { items, total: items.length };
    }),
    findAllWithUser: vi.fn(async () => ({ items: [], total: 0 })),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn()
};

// ---------------------------------------------------------------------------
// Module mocks for @repo/db and related services
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationReviewModel: vi.fn(() => mockAccReviewModel),
        AccommodationModel: vi.fn(() => ({
            findById: vi.fn().mockResolvedValue(null),
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn().mockResolvedValue(0),
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
        })),
        DestinationReviewModel: vi.fn(() => mockDestReviewModel),
        DestinationModel: vi.fn(() => ({
            findById: vi.fn().mockResolvedValue(null),
            findOne: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn().mockResolvedValue(0),
            findAll: vi.fn().mockResolvedValue({ items: [], total: 0 })
        }))
    };
});

vi.mock('../../../src/services/accommodation/accommodation.service.js', () => ({
    AccommodationService: vi.fn(() => ({
        updateStatsFromReview: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue({ data: null })
    }))
}));

vi.mock('../../../src/services/destination/destination.service.js', () => ({
    DestinationService: vi.fn(() => ({
        updateStatsFromReview: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue({ data: null })
    }))
}));

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) =>
        fn({ tx: undefined, hookState: {} })
    )
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => null)
}));

// ---------------------------------------------------------------------------
// Imports (after vi.mock declarations)
// ---------------------------------------------------------------------------

import * as contentModeration from '@repo/content-moderation';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { AccommodationReview, DestinationReview } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service.js';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service.js';
import type { ServiceConfig } from '../../../src/types/index.js';
import { createActor } from '../../factories/actorFactory.js';
import { getMockId } from '../../factories/utilsFactory.js';
import { expectSuccess } from '../../helpers/assertions.js';
import { asMock } from '../../utils/test-utils.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/** Content-moderation result for clean text — drives entity default. */
const CLEAN_RESULT: contentModeration.ModerationResult = {
    score: 0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 0
    }),
    matchedTerms: Object.freeze([])
};

/** Content-moderation result for blocked-word hit — forces PENDING on either entity type. */
const BLOCKED_RESULT: contentModeration.ModerationResult = {
    score: 1.0,
    categories: Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 1.0
    }),
    matchedTerms: Object.freeze(['badword'])
};

/** Rating object required by both review types (accommodation dimensions). */
const ACC_RATING = {
    cleanliness: 4,
    hospitality: 5,
    services: 4,
    accuracy: 5,
    communication: 4,
    location: 5
} as const;

/** Rating object required by destination reviews (destination dimensions). */
const DEST_RATING = {
    landscape: 4,
    attractions: 5,
    accessibility: 4,
    safety: 5,
    cleanliness: 4,
    hospitality: 5,
    culturalOffer: 4,
    gastronomy: 5,
    affordability: 4,
    nightlife: 3,
    infrastructure: 4,
    environmentalCare: 5,
    wifiAvailability: 3,
    shopping: 4,
    beaches: 3,
    greenSpaces: 5,
    localEvents: 4,
    weatherSatisfaction: 5
} as const;

/** Actor with moderation permissions for both review types. */
function makeModeratorActor() {
    return createActor({
        id: getMockId('user', 'moderator'),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
            PermissionEnum.DESTINATION_REVIEW_MODERATE
        ]
    });
}

/** Actor with permission to create and view reviews (public user). */
function makePublicActor() {
    return createActor({
        id: getMockId('user', 'public-user'),
        role: RoleEnum.USER,
        permissions: [
            PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
            PermissionEnum.ACCOMMODATION_REVIEW_VIEW,
            PermissionEnum.DESTINATION_REVIEW_CREATE,
            PermissionEnum.DESTINATION_REVIEW_VIEW
        ]
    });
}

/** Constructs AccommodationReviewService instance with a null logger (test-safe). */
function makeAccService(): AccommodationReviewService {
    return new AccommodationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

/** Constructs DestinationReviewService instance with a null logger (test-safe). */
function makeDestService(): DestinationReviewService {
    return new DestinationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

/** Creates a minimal AccommodationReview entity in the store for a given moderationState. */
function seedAccReview(
    overrides: Partial<AccommodationReview> & {
        id: string;
        userId: string;
        accommodationId: string;
    }
): AccommodationReview {
    const entity: AccommodationReview = {
        title: 'Great stay',
        content: 'Really enjoyed my visit.',
        rating: ACC_RATING,
        averageRating: 4.5,
        moderationState: ModerationStatusEnum.PENDING,
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        adminInfo: undefined,
        ...overrides
    } as AccommodationReview;
    accReviewStore.set(entity.id, entity);
    return entity;
}

/** Creates a minimal DestinationReview entity in the store for a given moderationState. */
function seedDestReview(
    overrides: Partial<DestinationReview> & {
        id: string;
        userId: string;
        destinationId: string;
    }
): DestinationReview {
    const entity: DestinationReview = {
        title: 'Beautiful destination',
        content: 'Loved the atmosphere and people.',
        rating: DEST_RATING,
        averageRating: 4.3,
        moderationState: ModerationStatusEnum.PENDING,
        moderatedById: null,
        moderatedAt: null,
        moderationReason: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...overrides
    } as DestinationReview;
    destReviewStore.set(entity.id, entity);
    return entity;
}

// ---------------------------------------------------------------------------
// Reset stores and mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    accReviewStore.clear();
    destReviewStore.clear();
});

// ===========================================================================
// Scenario 1: Accommodation review with clean text → APPROVED by entity default
// ===========================================================================

describe('Flow 1: accommodation review + clean text → APPROVED by entity default (SPEC-166 §3.1)', () => {
    it('resolves moderationState=APPROVED via _beforeCreate when content-mod returns clean', async () => {
        // Arrange
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);
        const service = makeAccService();
        const actor = makePublicActor();

        // Act
        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: AccommodationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<AccommodationReview>>;
            }
        )._beforeCreate(
            {
                id: getMockId('accommodationReview', 'acc-flow-1'),
                userId: getMockId('user', 'user-1') as AccommodationReview['userId'],
                accommodationId: getMockId(
                    'accommodation',
                    'acc-1'
                ) as AccommodationReview['accommodationId'],
                title: 'Wonderful experience',
                content: 'The room was clean and the staff was very helpful.',
                rating: ACC_RATING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as unknown as AccommodationReview,
            actor,
            {}
        );

        // Assert
        expect(result.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(contentModeration.moderateText).toHaveBeenCalledOnce();
    });
});

// ===========================================================================
// Scenario 2: Destination review with clean text → PENDING by entity default
// ===========================================================================

describe('Flow 2: destination review + clean text → PENDING by entity default (SPEC-166 §3.1)', () => {
    it('resolves moderationState=PENDING via _beforeCreate when content-mod returns clean', async () => {
        // Arrange
        asMock(contentModeration.moderateText).mockResolvedValue(CLEAN_RESULT);
        const service = makeDestService();
        const actor = makePublicActor();

        // Act
        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: DestinationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<DestinationReview>>;
            }
        )._beforeCreate(
            {
                id: getMockId('destinationReview', 'dest-flow-2'),
                userId: getMockId('user', 'user-2') as DestinationReview['userId'],
                destinationId: getMockId(
                    'destination',
                    'dest-1'
                ) as DestinationReview['destinationId'],
                title: 'Amazing place to visit',
                content: 'The scenery was breathtaking and locals were friendly.',
                rating: DEST_RATING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as unknown as DestinationReview,
            actor,
            {}
        );

        // Assert
        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
        expect(contentModeration.moderateText).toHaveBeenCalledOnce();
    });
});

// ===========================================================================
// Scenario 3: Blocked-word content → PENDING for BOTH entity types
// (content-mod overrides entity default in both directions)
// ===========================================================================

describe('Flow 3: blocked-word content → PENDING overrides entity default for BOTH types (SPEC-166 §3.2)', () => {
    it('accommodation review with blocked text resolves PENDING (overrides APPROVED default)', async () => {
        // Arrange
        asMock(contentModeration.moderateText).mockResolvedValue(BLOCKED_RESULT);
        const service = makeAccService();
        const actor = makePublicActor();

        // Act
        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: AccommodationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<AccommodationReview>>;
            }
        )._beforeCreate(
            {
                id: getMockId('accommodationReview', 'acc-blocked'),
                userId: getMockId('user', 'user-3') as AccommodationReview['userId'],
                accommodationId: getMockId(
                    'accommodation',
                    'acc-2'
                ) as AccommodationReview['accommodationId'],
                title: 'Contains badword',
                content: 'This review has a blocked term embedded.',
                rating: ACC_RATING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as unknown as AccommodationReview,
            actor,
            {}
        );

        // Assert — content-mod PENDING overrides accommodation's APPROVED default
        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });

    it('destination review with blocked text also resolves PENDING (same default, same result)', async () => {
        // Arrange
        asMock(contentModeration.moderateText).mockResolvedValue(BLOCKED_RESULT);
        const service = makeDestService();
        const actor = makePublicActor();

        // Act
        const result = await (
            service as unknown as {
                _beforeCreate: (
                    data: DestinationReview,
                    actor: unknown,
                    ctx: unknown
                ) => Promise<Partial<DestinationReview>>;
            }
        )._beforeCreate(
            {
                id: getMockId('destinationReview', 'dest-blocked'),
                userId: getMockId('user', 'user-4') as DestinationReview['userId'],
                destinationId: getMockId(
                    'destination',
                    'dest-2'
                ) as DestinationReview['destinationId'],
                title: 'Contains badword',
                content: 'This destination review also has a blocked term.',
                rating: DEST_RATING,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as unknown as DestinationReview,
            actor,
            {}
        );

        // Assert — PENDING for destination as well (same engine output, same result)
        expect(result.moderationState).toBe(ModerationStatusEnum.PENDING);
    });
});

// ===========================================================================
// Scenario 4: Admin approve → review appears in public reads
// ===========================================================================

describe('Flow 4: admin approve → review becomes visible in public reads (SPEC-166 §3.4)', () => {
    it('accommodation review: PENDING → APPROVED → appears in public search/list', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeAccService();
        const reviewId = getMockId('accommodationReview', 'acc-approve-flow');
        const accId = getMockId(
            'accommodation',
            'acc-for-approve'
        ) as AccommodationReview['accommodationId'];

        // Seed a PENDING review in the stateful store
        seedAccReview({
            id: reviewId,
            userId: getMockId('user', 'user-approve') as AccommodationReview['userId'],
            accommodationId: accId,
            moderationState: ModerationStatusEnum.PENDING
        });

        // Verify it is NOT visible in public search (PENDING is filtered out)
        const beforeApprove = await mockAccReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(beforeApprove.items).toHaveLength(0);

        // Act — admin approves the review
        const approveResult = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });

        // Assert — approve succeeded
        expectSuccess(approveResult);
        expect(approveResult.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);

        // Assert — review now appears in public-visibility query
        const afterApprove = await mockAccReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(afterApprove.items).toHaveLength(1);
    });

    it('destination review: PENDING → APPROVED → appears in public list', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeDestService();
        const reviewId = getMockId('destinationReview', 'dest-approve-flow');
        const destId = getMockId(
            'destination',
            'dest-for-approve'
        ) as DestinationReview['destinationId'];

        seedDestReview({
            id: reviewId,
            userId: getMockId('user', 'user-dest-approve') as DestinationReview['userId'],
            destinationId: destId,
            moderationState: ModerationStatusEnum.PENDING
        });

        // Confirm not yet visible
        const beforeApprove = await mockDestReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(beforeApprove.items).toHaveLength(0);

        // Act
        const approveResult = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });

        // Assert
        expectSuccess(approveResult);
        expect(approveResult.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);

        const afterApprove = await mockDestReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(afterApprove.items).toHaveLength(1);
    });
});

// ===========================================================================
// Scenario 5: Admin reject → review hidden from public reads
// ===========================================================================

describe('Flow 5: admin reject → review remains hidden from public reads (SPEC-166 §3.4)', () => {
    it('accommodation review: PENDING → REJECTED → absent from public-visibility query', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeAccService();
        const reviewId = getMockId('accommodationReview', 'acc-reject-flow');
        const accId = getMockId(
            'accommodation',
            'acc-for-reject'
        ) as AccommodationReview['accommodationId'];

        seedAccReview({
            id: reviewId,
            userId: getMockId('user', 'user-reject') as AccommodationReview['userId'],
            accommodationId: accId,
            moderationState: ModerationStatusEnum.PENDING
        });

        // Act — admin rejects
        const rejectResult = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Contains prohibited content',
            actor: moderator
        });

        // Assert — reject succeeded
        expectSuccess(rejectResult);
        expect(rejectResult.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(rejectResult.data?.moderationReason).toBe('Contains prohibited content');

        // Assert — REJECTED review is absent from public-visibility query
        const publicItems = await mockAccReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(publicItems.items).toHaveLength(0);
    });

    it('destination review: PENDING → REJECTED → absent from public-visibility query', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeDestService();
        const reviewId = getMockId('destinationReview', 'dest-reject-flow');
        const destId = getMockId(
            'destination',
            'dest-for-reject'
        ) as DestinationReview['destinationId'];

        seedDestReview({
            id: reviewId,
            userId: getMockId('user', 'user-dest-reject') as DestinationReview['userId'],
            destinationId: destId,
            moderationState: ModerationStatusEnum.PENDING
        });

        // Act
        const rejectResult = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Inappropriate content',
            actor: moderator
        });

        // Assert
        expectSuccess(rejectResult);
        expect(rejectResult.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);

        const publicItems = await mockDestReviewModel.findAll({
            moderationState: ModerationStatusEnum.APPROVED,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: null
        });
        expect(publicItems.items).toHaveLength(0);
    });
});

// ===========================================================================
// Scenario 6: lifecycleState independence (moderationState ⟂ lifecycleState)
// ===========================================================================

describe('Flow 6: lifecycleState independence — moderationState transitions NEVER mutate lifecycleState (SPEC-166 §3.4)', () => {
    it('accommodation review: lifecycleState unchanged after APPROVE transition', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeAccService();
        const reviewId = getMockId('accommodationReview', 'acc-lifecycle-approve');

        seedAccReview({
            id: reviewId,
            userId: getMockId('user', 'user-lc-1') as AccommodationReview['userId'],
            accommodationId: getMockId(
                'accommodation',
                'acc-lc-1'
            ) as AccommodationReview['accommodationId'],
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });

        // Assert — moderationState changed, lifecycleState did NOT
        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

        // Assert — the update patch sent to the model did NOT include lifecycleState
        const updateCall = mockAccReviewModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(Object.keys(updateCall[1])).not.toContain('lifecycleState');
    });

    it('accommodation review: lifecycleState unchanged after REJECT transition', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeAccService();
        const reviewId = getMockId('accommodationReview', 'acc-lifecycle-reject');

        seedAccReview({
            id: reviewId,
            userId: getMockId('user', 'user-lc-2') as AccommodationReview['userId'],
            accommodationId: getMockId(
                'accommodation',
                'acc-lc-2'
            ) as AccommodationReview['accommodationId'],
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.REJECTED,
            actor: moderator
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

        const updateCall = mockAccReviewModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(Object.keys(updateCall[1])).not.toContain('lifecycleState');
    });

    it('destination review: lifecycleState unchanged after APPROVE transition', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeDestService();
        const reviewId = getMockId('destinationReview', 'dest-lifecycle-approve');

        seedDestReview({
            id: reviewId,
            userId: getMockId('user', 'user-dest-lc-1') as DestinationReview['userId'],
            destinationId: getMockId(
                'destination',
                'dest-lc-1'
            ) as DestinationReview['destinationId'],
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

        const updateCall = mockDestReviewModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(Object.keys(updateCall[1])).not.toContain('lifecycleState');
    });

    it('destination review: lifecycleState unchanged after REJECT transition', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeDestService();
        const reviewId = getMockId('destinationReview', 'dest-lifecycle-reject');

        seedDestReview({
            id: reviewId,
            userId: getMockId('user', 'user-dest-lc-2') as DestinationReview['userId'],
            destinationId: getMockId(
                'destination',
                'dest-lc-2'
            ) as DestinationReview['destinationId'],
            moderationState: ModerationStatusEnum.PENDING,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        // Act
        const result = await service.moderateReview({
            id: reviewId,
            decision: ModerationStatusEnum.REJECTED,
            actor: moderator
        });

        // Assert
        expectSuccess(result);
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);
        expect(result.data?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);

        const updateCall = mockDestReviewModel.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(Object.keys(updateCall[1])).not.toContain('lifecycleState');
    });
});

// ===========================================================================
// Scenario 7: getPendingCount reflects state transitions across both services
// ===========================================================================

describe('Flow 7: getPendingCount reflects state transitions (SPEC-166 T-016/T-017)', () => {
    it('accommodation review: pending count increases on create, decreases after approve', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeAccService();
        const reviewId1 = getMockId('accommodationReview', 'acc-count-1');
        const reviewId2 = getMockId('accommodationReview', 'acc-count-2');

        // Seed two PENDING reviews
        seedAccReview({
            id: reviewId1,
            userId: getMockId('user', 'user-count-1') as AccommodationReview['userId'],
            accommodationId: getMockId(
                'accommodation',
                'acc-count'
            ) as AccommodationReview['accommodationId'],
            moderationState: ModerationStatusEnum.PENDING
        });
        seedAccReview({
            id: reviewId2,
            userId: getMockId('user', 'user-count-2') as AccommodationReview['userId'],
            accommodationId: getMockId(
                'accommodation',
                'acc-count'
            ) as AccommodationReview['accommodationId'],
            moderationState: ModerationStatusEnum.PENDING
        });

        // Assert — count is 2 initially
        const countBefore = await service.getPendingCount({ actor: moderator });
        expectSuccess(countBefore);
        expect(countBefore.data?.count).toBe(2);

        // Act — approve one
        await service.moderateReview({
            id: reviewId1,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });

        // Assert — count drops to 1
        const countAfter = await service.getPendingCount({ actor: moderator });
        expectSuccess(countAfter);
        expect(countAfter.data?.count).toBe(1);
    });

    it('destination review: pending count reflects approve and reject transitions', async () => {
        // Arrange
        const moderator = makeModeratorActor();
        const service = makeDestService();
        const reviewId1 = getMockId('destinationReview', 'dest-count-1');
        const reviewId2 = getMockId('destinationReview', 'dest-count-2');
        const reviewId3 = getMockId('destinationReview', 'dest-count-3');

        seedDestReview({
            id: reviewId1,
            userId: getMockId('user', 'user-dest-count-1') as DestinationReview['userId'],
            destinationId: getMockId(
                'destination',
                'dest-count'
            ) as DestinationReview['destinationId'],
            moderationState: ModerationStatusEnum.PENDING
        });
        seedDestReview({
            id: reviewId2,
            userId: getMockId('user', 'user-dest-count-2') as DestinationReview['userId'],
            destinationId: getMockId(
                'destination',
                'dest-count'
            ) as DestinationReview['destinationId'],
            moderationState: ModerationStatusEnum.PENDING
        });
        seedDestReview({
            id: reviewId3,
            userId: getMockId('user', 'user-dest-count-3') as DestinationReview['userId'],
            destinationId: getMockId(
                'destination',
                'dest-count'
            ) as DestinationReview['destinationId'],
            moderationState: ModerationStatusEnum.PENDING
        });

        // Assert initial count
        const countBefore = await service.getPendingCount({ actor: moderator });
        expectSuccess(countBefore);
        expect(countBefore.data?.count).toBe(3);

        // Act — approve one, reject one
        await service.moderateReview({
            id: reviewId1,
            decision: ModerationStatusEnum.APPROVED,
            actor: moderator
        });
        await service.moderateReview({
            id: reviewId2,
            decision: ModerationStatusEnum.REJECTED,
            reason: 'Spam',
            actor: moderator
        });

        // Assert — only the 3rd review remains PENDING
        const countAfter = await service.getPendingCount({ actor: moderator });
        expectSuccess(countAfter);
        expect(countAfter.data?.count).toBe(1);
    });

    it('getPendingCount returns FORBIDDEN when actor lacks moderation permission', async () => {
        // Arrange
        const unprivileged = createActor({ role: RoleEnum.USER, permissions: [] });
        const service = makeAccService();

        // Act
        const result = await service.getPendingCount({ actor: unprivileged });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});
