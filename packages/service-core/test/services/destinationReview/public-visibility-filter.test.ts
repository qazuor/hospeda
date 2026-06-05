/**
 * Tests for SPEC-166 T-023 — public-visibility filter on all destination
 * review read paths.
 *
 * Verifies that PENDING and REJECTED reviews are excluded from every public
 * read surface:
 *   - _executeSearch  (via service.search())
 *   - _executeCount   (via service.count())
 *   - listByDestination  (public per-destination endpoint)
 *   - listWithUser       (testimonials endpoint)
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
        DestinationReviewModel: vi.fn(() => mockModel),
        DestinationModel: vi.fn(() => ({
            findById: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            count: vi.fn(),
            findAll: vi.fn()
        }))
    };
});

vi.mock('../../../src/services/destination/destination.service.js', () => ({
    DestinationService: vi.fn(() => ({
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
    type DestinationIdType,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    type UserIdType
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';
import type { ServiceConfig } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { expectSuccess } from '../../helpers/assertions';

// ---------------------------------------------------------------------------

function makeService(): DestinationReviewService {
    return new DestinationReviewService({
        logger: undefined as unknown as ServiceConfig['logger']
    });
}

function makeActor() {
    return createActor({
        id: getMockId('user') as UserIdType,
        permissions: [PermissionEnum.DESTINATION_REVIEW_CREATE]
    });
}

// ---------------------------------------------------------------------------
// T-023 — _executeSearch / service.search()
// ---------------------------------------------------------------------------

describe('DestinationReviewService — search() public-visibility filter (SPEC-166 T-023)', () => {
    let service: DestinationReviewService;

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
// T-023 — _executeCount / service.count()
// ---------------------------------------------------------------------------

describe('DestinationReviewService — count() public-visibility filter (SPEC-166 T-023)', () => {
    let service: DestinationReviewService;

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
// T-023 — listByDestination (public per-destination endpoint)
// ---------------------------------------------------------------------------

describe('DestinationReviewService.listByDestination — public-visibility filter (SPEC-166 T-023)', () => {
    let service: DestinationReviewService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel.findAll.mockResolvedValue({ items: [], total: 0 });
        service = makeService();
    });

    it('includes moderationState=APPROVED when opts.includeAllStates is unset', async () => {
        const actor = makeActor();
        const destinationId = getMockId('destination') as DestinationIdType;

        const result = await service.listByDestination(actor, {
            destinationId,
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
        const destinationId = getMockId('destination') as DestinationIdType;

        await service.listByDestination(
            actor,
            {
                destinationId,
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
        const destinationId = getMockId('destination') as DestinationIdType;

        await service.listByDestination(
            actor,
            {
                destinationId,
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
// T-023 — listWithUser (testimonials public endpoint)
// ---------------------------------------------------------------------------

describe('DestinationReviewService.listWithUser — public-visibility filter (SPEC-166 T-023)', () => {
    let service: DestinationReviewService;

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
});
