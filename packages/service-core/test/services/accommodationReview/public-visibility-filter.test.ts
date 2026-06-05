/**
 * Tests for SPEC-166 T-022 — public-visibility filter on all accommodation
 * review read paths.
 *
 * Verifies that PENDING and REJECTED reviews are excluded from every public
 * read surface:
 *   - _executeSearch  (via service.search())
 *   - _executeCount   (via service.count())
 *   - listByAccommodation  (public per-accommodation endpoint)
 *   - listWithUser    (testimonials endpoint)
 *
 * Public visibility rule (spec §3.4):
 *   moderationState = 'APPROVED' AND lifecycleState = 'ACTIVE'
 *
 * All model and related-service interactions are mocked so the suite runs
 * without a live database connection.
 */

// ---- vi.mock calls must be first — they are hoisted by vitest ---------------

vi.mock('@repo/content-moderation', () => ({
    moderateText: vi.fn()
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationReviewModel: vi.fn(() => mockModel),
        AccommodationModel: vi.fn(() => ({
            findById: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            findAll: vi.fn()
        }))
    };
});

vi.mock('../../../src/services/accommodation/accommodation.service.js', () => ({
    AccommodationService: vi.fn(() => ({
        updateStatsFromReview: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn()
    }))
}));

vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(
        async (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => {
            return fn({ tx: undefined, hookState: {} });
        }
    )
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn(() => null)
}));

// ---------------------------------------------------------------------------

const mockModel = {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateById: vi.fn(),
    count: vi.fn(),
    findAll: vi.fn(),
    findAllWithUser: vi.fn(),
    findAllWithRelations: vi.fn(),
    softDelete: vi.fn(),
    hardDelete: vi.fn(),
    restore: vi.fn()
};

import {
    type AccommodationIdType,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    type UserIdType
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';

// ---------------------------------------------------------------------------

function makeService(): AccommodationReviewService {
    return new AccommodationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

function makeActor() {
    return createActor({
        id: getMockId('user') as UserIdType,
        permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE]
    });
}

// ---------------------------------------------------------------------------
// T-022 — _executeSearch / service.search()
// ---------------------------------------------------------------------------

describe('AccommodationReviewService — search() public-visibility filter (SPEC-166 T-022)', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel.findAll.mockResolvedValue({ items: [], total: 0 });
        service = makeService();
    });

    it('forces moderationState=APPROVED on the model call', async () => {
        const actor = makeActor();

        await service.search(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('forces lifecycleState=ACTIVE on the model call', async () => {
        const actor = makeActor();

        await service.search(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('still forces APPROVED even when no additional filters are supplied', async () => {
        const actor = makeActor();

        // Confirm that even with a bare call (no extra params), the filter
        // lands on the model. The public search schema intentionally does NOT
        // expose moderationState as a query param — the server-side override is
        // the only path to set it.
        await service.search(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});

// ---------------------------------------------------------------------------
// T-022 — _executeCount / service.count()
// ---------------------------------------------------------------------------

describe('AccommodationReviewService — count() public-visibility filter (SPEC-166 T-022)', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel.count.mockResolvedValue(0);
        service = makeService();
    });

    it('forces moderationState=APPROVED on the model call', async () => {
        const actor = makeActor();

        await service.count(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('forces lifecycleState=ACTIVE on the model call', async () => {
        const actor = makeActor();

        await service.count(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});

// ---------------------------------------------------------------------------
// T-022 — listByAccommodation (public per-accommodation endpoint)
// ---------------------------------------------------------------------------

describe('AccommodationReviewService.listByAccommodation — public-visibility filter (SPEC-166 T-022)', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel.findAll.mockResolvedValue({ items: [], total: 0 });
        service = makeService();
    });

    it('includes moderationState=APPROVED when opts.includeAllStates is unset', async () => {
        const actor = makeActor();
        const accommodationId = getMockId('accommodation') as AccommodationIdType;

        const result = await service.listByAccommodation(actor, {
            accommodationId,
            page: 1,
            pageSize: 10,
            sortBy: 'createdAt' as const,
            sortOrder: 'desc' as const
        });

        expectSuccess(result);
        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('includes moderationState=APPROVED when opts.includeAllStates is false', async () => {
        const actor = makeActor();
        const accommodationId = getMockId('accommodation') as AccommodationIdType;

        await service.listByAccommodation(
            actor,
            {
                accommodationId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            },
            { includeAllStates: false }
        );

        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    it('omits the moderationState filter when opts.includeAllStates=true (admin/owner path)', async () => {
        const actor = makeActor();
        const accommodationId = getMockId('accommodation') as AccommodationIdType;

        await service.listByAccommodation(
            actor,
            {
                accommodationId,
                page: 1,
                pageSize: 10,
                sortBy: 'createdAt' as const,
                sortOrder: 'desc' as const
            },
            { includeAllStates: true }
        );

        const whereArg = mockModel.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
        expect('moderationState' in whereArg).toBe(false);
        expect('lifecycleState' in whereArg).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// T-022 — listWithUser (testimonials public endpoint)
// ---------------------------------------------------------------------------

describe('AccommodationReviewService.listWithUser — public-visibility filter (SPEC-166 T-022)', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel.findAllWithUser.mockResolvedValue({ items: [], total: 0 });
        service = makeService();
    });

    it('forces moderationState=APPROVED on the model call', async () => {
        const actor = makeActor();

        await service.listWithUser(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.findAllWithUser.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('forces lifecycleState=ACTIVE on the model call', async () => {
        const actor = makeActor();

        await service.listWithUser(actor, { page: 1, pageSize: 10 });

        const whereArg = mockModel.findAllWithUser.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });

    // FIX 2 regression: caller-supplied filter overrides must NOT win over
    // the post-spread force-assignments. Previously `{ ...filterParams }` came
    // AFTER the forced values, so a caller passing lifecycleState='ARCHIVED'
    // or moderationState='PENDING' would silently override the public gate.
    it('ignores caller-supplied lifecycleState=ARCHIVED and still passes ACTIVE to the model', async () => {
        const actor = makeActor();

        await service.listWithUser(actor, {
            page: 1,
            pageSize: 10,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        } as Parameters<typeof service.listWithUser>[1]);

        const whereArg = mockModel.findAllWithUser.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
    });

    it('ignores caller-supplied moderationState=PENDING and still passes APPROVED to the model', async () => {
        const actor = makeActor();

        await service.listWithUser(actor, {
            page: 1,
            pageSize: 10,
            moderationState: ModerationStatusEnum.PENDING
        } as Parameters<typeof service.listWithUser>[1]);

        const whereArg = mockModel.findAllWithUser.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(whereArg.moderationState).toBe(ModerationStatusEnum.APPROVED);
        expect(whereArg.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
    });
});
