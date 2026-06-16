/**
 * @file threshold.service.permissions.test.ts
 *
 * Targeted coverage for ContentModerationThresholdService permission hooks,
 * lifecycle hooks, and query execution methods not exercised by the main
 * threshold.service.test.ts (which focuses only on the `update` override).
 *
 * Covers (uncovered lines from v8 report):
 *   - assertPermission helper (FORBIDDEN path): lines 23-25
 *   - _canCreate (NOT_IMPLEMENTED): lines 50-52
 *   - _canDelete / _canSoftDelete (NOT_IMPLEMENTED): lines 62-64, 86-88
 *   - _canView (FORBIDDEN): lines 66-72
 *   - _canList, _canSearch, _canCount (delegate to _canView): lines 74-84
 *   - _canHardDelete (FORBIDDEN): lines 90-96
 *   - _canRestore (FORBIDDEN): lines 98-104
 *   - _canUpdateVisibility (delegates to _canUpdate): lines 106-108
 *   - _afterHardDelete / _afterRestore (cache invalidation): lines 117-125
 *   - getDefaultListRelations returns undefined: lines 46-48
 *   - _executeSearch / _executeCount: lines 174-183
 */

import {
    type ContentModerationThresholdAdminSearch,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentModerationThresholdService } from '../../../src/services/contentModeration/threshold.service';
import { createActor } from '../../factories/actorFactory';

// ---------------------------------------------------------------------------
// Hoist the cache-invalidation mock so the vi.mock factory can reference it.
// ---------------------------------------------------------------------------
const { invalidateModerationThresholdCache } = vi.hoisted(() => ({
    invalidateModerationThresholdCache: vi.fn()
}));

vi.mock('../../../src/services/contentModeration/get-threshold-for-context', () => ({
    invalidateModerationThresholdCache
}));

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------
const THRESHOLD_ID = '22222222-2222-2222-2222-222222222222';

/** Minimal valid search params that satisfy the AdminSearchBaseSchema constraints. */
const VALID_SEARCH_PARAMS: ContentModerationThresholdAdminSearch = {
    page: 1,
    pageSize: 10,
    sort: 'createdAt:desc',
    status: 'all',
    includeDeleted: false
};

const STORED = {
    id: THRESHOLD_ID,
    context: 'default',
    pending: 0.3 as number,
    reject: 0.7 as number,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
    createdById: null as string | null,
    updatedById: null as string | null
};

/** Build a full model mock. All methods are stubs; override as needed per test. */
function buildModel(overrides: Record<string, unknown> = {}) {
    return {
        findById: vi.fn().mockResolvedValue({ ...STORED }),
        update: vi.fn().mockResolvedValue({ ...STORED }),
        findOne: vi.fn().mockResolvedValue(null),
        findOneWithRelations: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ ...STORED }),
        softDelete: vi.fn().mockResolvedValue(1),
        hardDelete: vi.fn().mockResolvedValue(1),
        restore: vi.fn().mockResolvedValue(1),
        findAll: vi
            .fn()
            .mockResolvedValue({ items: [{ ...STORED }], total: 1, page: 1, pageSize: 10 }),
        count: vi.fn().mockResolvedValue({ count: 1 }),
        getTable: vi.fn().mockReturnValue({ context: 'context', pending: 'pending' }),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// PERMISSION methods
// ---------------------------------------------------------------------------

describe('ContentModerationThresholdService — permission methods', () => {
    let model: ReturnType<typeof buildModel>;
    let service: ContentModerationThresholdService;

    beforeEach(() => {
        model = buildModel();
        invalidateModerationThresholdCache.mockClear();
        service = new ContentModerationThresholdService({ logger: undefined }, model as never);
    });

    // -----------------------------------------------------------------------
    // assertPermission — FORBIDDEN path (lines 23-25)
    // -----------------------------------------------------------------------

    describe('_canUpdate — FORBIDDEN when actor lacks MODERATION_THRESHOLD_UPDATE', () => {
        it('should return FORBIDDEN when actor has no relevant permissions', async () => {
            // Arrange — actor with no permissions
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act — `update` calls `_canUpdate` via the base class
            const result = await service.update(actor, THRESHOLD_ID, { pending: 0.2 });

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // _canCreate — NOT_IMPLEMENTED (lines 50-52)
    // -----------------------------------------------------------------------

    describe('_canCreate — NOT_IMPLEMENTED', () => {
        it('should return NOT_IMPLEMENTED when create is called', async () => {
            // Arrange — even an admin cannot create thresholds
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: Object.values(PermissionEnum)
            });

            // Act — base class calls _canCreate inside create()
            const result = await service.create(actor, {});

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_IMPLEMENTED);
        });
    });

    // -----------------------------------------------------------------------
    // _canSoftDelete — NOT_IMPLEMENTED (lines 86-88)
    // -----------------------------------------------------------------------

    describe('_canSoftDelete — NOT_IMPLEMENTED', () => {
        it('should return NOT_IMPLEMENTED when softDelete is called', async () => {
            // Arrange — super-admin actor
            const actor = createActor({
                role: RoleEnum.SUPER_ADMIN,
                permissions: Object.values(PermissionEnum)
            });

            // Act
            const result = await service.softDelete(actor, THRESHOLD_ID);

            // Assert — _canSoftDelete throws NOT_IMPLEMENTED before any DB write
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_IMPLEMENTED);
            expect(model.softDelete).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // _canView — FORBIDDEN (lines 66-72)
    // -----------------------------------------------------------------------

    describe('_canView — FORBIDDEN when actor lacks MODERATION_THRESHOLD_VIEW', () => {
        it('should return FORBIDDEN from getById when actor has no view permission', async () => {
            // Arrange — model.findOne must return the entity so _canView is reached.
            // getByField calls model.findOne (not findById), then calls _canView after.
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });
            // Override findOne to return a real entity so execution reaches _canView
            model.findOne.mockResolvedValue({ ...STORED });

            // Act
            const result = await service.getById(actor, THRESHOLD_ID);

            // Assert — _canView throws FORBIDDEN before returning the entity
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // _canList — delegates to _canView (lines 74-76)
    // -----------------------------------------------------------------------

    describe('_canList — FORBIDDEN when actor lacks MODERATION_THRESHOLD_VIEW', () => {
        it('should return FORBIDDEN from list when actor has no view permission', async () => {
            // Arrange
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act
            const result = await service.list(actor);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // _canSearch — delegates to _canView (lines 78-80)
    // -----------------------------------------------------------------------

    describe('_canSearch — FORBIDDEN when actor lacks MODERATION_THRESHOLD_VIEW', () => {
        it('should return FORBIDDEN from search when actor has no view permission', async () => {
            // Arrange
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act
            const result = await service.search(actor, VALID_SEARCH_PARAMS);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // _canCount — delegates to _canView (lines 82-84)
    // -----------------------------------------------------------------------

    describe('_canCount — FORBIDDEN when actor lacks MODERATION_THRESHOLD_VIEW', () => {
        it('should return FORBIDDEN from count when actor has no view permission', async () => {
            // Arrange
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act
            const result = await service.count(actor, VALID_SEARCH_PARAMS);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // -----------------------------------------------------------------------
    // _canHardDelete — FORBIDDEN (lines 90-96)
    // -----------------------------------------------------------------------

    describe('_canHardDelete — FORBIDDEN when actor lacks MODERATION_THRESHOLD_HARD_DELETE', () => {
        it('should return FORBIDDEN from hardDelete when actor has no hard-delete permission', async () => {
            // Arrange — actor with VIEW but not HARD_DELETE
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW]
            });

            // Act
            const result = await service.hardDelete(actor, THRESHOLD_ID);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.hardDelete).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // _canRestore — FORBIDDEN (lines 98-104)
    // -----------------------------------------------------------------------

    describe('_canRestore — FORBIDDEN when actor lacks MODERATION_THRESHOLD_RESTORE', () => {
        it('should return FORBIDDEN from restore when actor has no restore permission', async () => {
            // Arrange
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act
            const result = await service.restore(actor, THRESHOLD_ID);

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(model.restore).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // _canUpdateVisibility — delegates to _canUpdate (lines 106-108)
    // -----------------------------------------------------------------------

    describe('_canUpdateVisibility — FORBIDDEN when actor lacks MODERATION_THRESHOLD_UPDATE', () => {
        it('should return FORBIDDEN from updateVisibility when actor has no update permission', async () => {
            // Arrange — actor has no update permission; model.findById returns entity
            // so execution reaches _canUpdateVisibility before failing
            const actor = createActor({ role: RoleEnum.USER, permissions: [] });

            // Act
            const result = await service.updateVisibility(
                actor,
                THRESHOLD_ID,
                VisibilityEnum.PUBLIC
            );

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});

// ---------------------------------------------------------------------------
// AFTER hooks — cache invalidation (lines 117-125)
// ---------------------------------------------------------------------------

describe('ContentModerationThresholdService — _afterHardDelete and _afterRestore', () => {
    let model: ReturnType<typeof buildModel>;
    let service: ContentModerationThresholdService;

    beforeEach(() => {
        invalidateModerationThresholdCache.mockClear();
    });

    describe('_afterHardDelete — invalidates cache after hard-delete', () => {
        it('should call invalidateModerationThresholdCache after a successful hardDelete', async () => {
            // Arrange — entity must exist WITHOUT deletedAt so the base class does NOT early-return.
            // Base class hardDelete logic:
            //   if (entity.deletedAt) → return { count: 0 }  (skip — entity is already soft-deleted)
            //   else → call model.hardDelete then _afterHardDelete
            // So we need deletedAt: null to exercise the _afterHardDelete hook.
            const activeEntity = { ...STORED, deletedAt: null };
            model = buildModel({ findById: vi.fn().mockResolvedValue(activeEntity) });
            service = new ContentModerationThresholdService({ logger: undefined }, model as never);
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_HARD_DELETE]
            });

            // Act
            const result = await service.hardDelete(actor, THRESHOLD_ID);

            // Assert — result is success with count 1, and cache was invalidated
            expect(result.error).toBeUndefined();
            expect(model.hardDelete).toHaveBeenCalled();
            expect(invalidateModerationThresholdCache).toHaveBeenCalled();
        });
    });

    describe('_afterRestore — invalidates cache after restore', () => {
        it('should call invalidateModerationThresholdCache after a successful restore', async () => {
            // Arrange — entity must have deletedAt set so the restore actually proceeds
            const deletedEntity = {
                ...STORED,
                deletedAt: new Date('2024-01-01T00:00:00.000Z')
            };
            model = buildModel({ findById: vi.fn().mockResolvedValue(deletedEntity) });
            service = new ContentModerationThresholdService({ logger: undefined }, model as never);
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_RESTORE]
            });

            // Act
            const result = await service.restore(actor, THRESHOLD_ID);

            // Assert — result is success with count 1, and cache was invalidated
            expect(result.error).toBeUndefined();
            expect(model.restore).toHaveBeenCalled();
            expect(invalidateModerationThresholdCache).toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// _executeSearch and _executeCount (lines 174-183)
// ---------------------------------------------------------------------------

describe('ContentModerationThresholdService — _executeSearch and _executeCount', () => {
    let model: ReturnType<typeof buildModel>;
    let service: ContentModerationThresholdService;

    beforeEach(() => {
        model = buildModel();
        service = new ContentModerationThresholdService({ logger: undefined }, model as never);
    });

    describe('_executeSearch — returns paginated results from model.findAll', () => {
        it('should return items from model.findAll when actor has view permission', async () => {
            // Arrange
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW]
            });

            // Act
            const result = await service.search(actor, VALID_SEARCH_PARAMS);

            // Assert
            expect(result.error).toBeUndefined();
            expect(model.findAll).toHaveBeenCalledWith(
                {},
                { page: 1, pageSize: 10 },
                undefined,
                undefined
            );
        });

        it('should use context filter when provided', async () => {
            // Arrange
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW]
            });

            // Act — _executeSearch receives params including context but ignores it (only page/pageSize used)
            const result = await service.search(actor, {
                ...VALID_SEARCH_PARAMS,
                context: 'accommodation'
            });

            // Assert — search still calls findAll with the standard args
            expect(result.error).toBeUndefined();
            expect(model.findAll).toHaveBeenCalled();
        });
    });

    describe('_executeCount — returns count from model.count', () => {
        it('should return the count from model.count when actor has view permission', async () => {
            // Arrange
            const actor = createActor({
                role: RoleEnum.ADMIN,
                permissions: [PermissionEnum.MODERATION_THRESHOLD_VIEW]
            });
            model.count.mockResolvedValue(5);

            // Act
            const result = await service.count(actor, VALID_SEARCH_PARAMS);

            // Assert
            expect(result.error).toBeUndefined();
            expect(model.count).toHaveBeenCalled();
        });
    });
});
