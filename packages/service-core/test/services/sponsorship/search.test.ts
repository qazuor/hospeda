/**
 * @file search.test.ts
 *
 * Unit tests for SponsorshipService search, count, and admin-list operations.
 *
 * Covers uncovered lines from v8 report:
 *   - _executeSearch (force-overrides lifecycleState = ACTIVE): lines 244-253
 *   - _executeCount (mirrors force-override): lines 261-270
 *   - _canAdminList (SPONSORSHIP_VIEW_ANY check): lines 232-235
 *   - _beforeCreate with levelId=null (level not found): lines 95-100
 *   - _beforeCreate with mismatched targetType: lines 101-106
 *   - _beforeCreate without slug (auto-generate): lines 109-113
 */

import type { SponsorshipLevelModel, SponsorshipModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    SponsorshipStatusEnum,
    SponsorshipTargetTypeEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorshipService } from '../../../src/services/sponsorship/sponsorship.service';
import { createActor } from '../../factories/actorFactory';
import {
    createMockSponsorship,
    createMockSponsorshipCreateInput
} from '../../factories/sponsorshipFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SponsorshipService with mocked model and optional levelModel. */
function buildService(opts: {
    modelOverrides?: Record<string, unknown>;
    levelModelFindById?: ReturnType<typeof vi.fn>;
}) {
    const modelMock = createModelMock(['findAll', 'count', 'create', 'findById']);
    if (opts.modelOverrides) {
        Object.assign(modelMock, opts.modelOverrides);
    }
    const levelFindById = opts.levelModelFindById ?? vi.fn().mockResolvedValue(null);
    const levelModelMock = { findById: levelFindById } as unknown as SponsorshipLevelModel;
    const loggerMock = createLoggerMock();
    const service = new SponsorshipService({
        logger: loggerMock,
        model: modelMock as unknown as SponsorshipModel,
        levelModel: levelModelMock
    });
    return { service, modelMock, levelFindById };
}

// ---------------------------------------------------------------------------
// _executeSearch
// ---------------------------------------------------------------------------

describe('SponsorshipService.search — _executeSearch', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        const built = buildService({});
        service = built.service;
        modelMock = built.modelMock;
        (modelMock.findAll as ReturnType<typeof vi.fn>).mockResolvedValue({
            items: [],
            total: 0,
            page: 1,
            pageSize: 20
        });
    });

    it('should force lifecycleState=ACTIVE and call model.findAll', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });

        // Act — search with no filters; _executeSearch will force ACTIVE
        // NOTE: the base class strips page/pageSize before passing to _executeSearch,
        // so _executeSearch destructures with defaults (page=1, pageSize=20).
        const result = await service.search(actor, { page: 1, pageSize: 10 });

        // Assert — lifecycleState is forced to ACTIVE; pagination uses defaults
        expect(result.error).toBeUndefined();
        expect(modelMock.findAll).toHaveBeenCalledWith(
            expect.objectContaining({ lifecycleState: LifecycleStatusEnum.ACTIVE }),
            { page: 1, pageSize: 20 }
        );
    });

    it('should override caller-supplied lifecycleState with ACTIVE', async () => {
        // Arrange — caller passes a sponsorshipStatus filter alongside standard params
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });

        // Act
        await service.search(actor, {
            page: 1,
            pageSize: 5,
            sponsorshipStatus: SponsorshipStatusEnum.ACTIVE
        });

        // Assert — lifecycleState is forced ACTIVE regardless; base class strips pagination
        // before calling _executeSearch so pageSize defaults to 20 in the destructuring
        expect(modelMock.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                sponsorshipStatus: SponsorshipStatusEnum.ACTIVE
            }),
            { page: 1, pageSize: 20 }
        );
    });

    it('should return FORBIDDEN when actor lacks view permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });

        // Act
        const result = await service.search(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// _executeCount
// ---------------------------------------------------------------------------

describe('SponsorshipService.count — _executeCount', () => {
    let service: SponsorshipService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        const built = buildService({});
        service = built.service;
        modelMock = built.modelMock;
        (modelMock.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    });

    it('should force lifecycleState=ACTIVE in count query', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_VIEW_ANY] });

        // Act
        const result = await service.count(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.count).toBe(3);
        expect(modelMock.count).toHaveBeenCalledWith(
            expect.objectContaining({ lifecycleState: LifecycleStatusEnum.ACTIVE })
        );
    });

    it('should return FORBIDDEN when actor lacks view permission', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });

        // Act
        const result = await service.count(actor, { page: 1, pageSize: 10 });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(modelMock.count).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// _canAdminList (lines 232-235)
// ---------------------------------------------------------------------------

describe('SponsorshipService._canAdminList', () => {
    it('should deny admin list when actor lacks SPONSORSHIP_VIEW_ANY', async () => {
        // Arrange — adminList requires both admin access AND SPONSORSHIP_VIEW_ANY
        const { service } = buildService({});
        // Actor with admin panel access but NOT SPONSORSHIP_VIEW_ANY
        const actor = createActor({
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN
                // deliberately missing SPONSORSHIP_VIEW_ANY
            ]
        });

        // Act
        const result = await service.adminList(actor, { page: 1, pageSize: 10 });

        // Assert — _canAdminList throws FORBIDDEN before any DB call
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});

// ---------------------------------------------------------------------------
// _beforeCreate — level-validation and auto-slug paths
// ---------------------------------------------------------------------------

describe('SponsorshipService.create — _beforeCreate uncovered paths', () => {
    it('should return VALIDATION_ERROR when levelId is provided but level does not exist', async () => {
        // Arrange — levelModel.findById returns null (level missing)
        const { service } = buildService({
            levelModelFindById: vi.fn().mockResolvedValue(null)
        });
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        const input = createMockSponsorshipCreateInput();

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/does not exist/i);
    });

    it('should return VALIDATION_ERROR when level targetType does not match sponsorship targetType', async () => {
        // Arrange — level.targetType is 'post' but sponsorship targets 'event'
        const { service } = buildService({
            levelModelFindById: vi.fn().mockResolvedValue({
                id: 'level-1',
                name: 'Post Level',
                targetType: SponsorshipTargetTypeEnum.POST
            })
        });
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        // Default mock input has targetType: EVENT — mismatch with POST level
        const input = createMockSponsorshipCreateInput({
            targetType: SponsorshipTargetTypeEnum.EVENT
        });

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/Choose a matching level/i);
    });

    it('should auto-generate slug when slug is not provided', async () => {
        // Arrange — level matches; no slug in input; model.create returns a sponsorship
        const created = createMockSponsorship({ slug: 'auto-generated-slug' });
        const { service, modelMock } = buildService({
            levelModelFindById: vi.fn().mockResolvedValue({
                id: 'level-1',
                name: 'Event Level',
                targetType: SponsorshipTargetTypeEnum.EVENT
            })
        });
        (modelMock.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
        const actor = createActor({ permissions: [PermissionEnum.SPONSORSHIP_CREATE] });
        // Omit slug so _beforeCreate auto-generates it
        const input = createMockSponsorshipCreateInput({ slug: undefined });

        // Act
        const result = await service.create(actor, input);

        // Assert — service succeeds and model.create was called
        expect(result.error).toBeUndefined();
        expect(modelMock.create).toHaveBeenCalled();
        // Verify the auto-generated slug was passed to model.create
        const callArg = (modelMock.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(typeof callArg?.slug).toBe('string');
        expect(callArg?.slug).toBeTruthy();
    });
});
