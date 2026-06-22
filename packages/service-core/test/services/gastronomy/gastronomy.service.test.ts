/**
 * gastronomy.service.test.ts
 *
 * Unit tests for GastronomyService (SPEC-239 T-035 / T-036).
 *
 * Coverage:
 * - updateOwn: schema validation, ownership gate, per-section permission gates,
 *   staff bypass, delegation to base update.
 * - _executeSearch: scalar filters forwarded to model.findAll.
 * - _executeCount: scalar filters forwarded to model.count.
 * - Permission hook delegation via _canCreate / _canUpdate / _canSoftDelete.
 * - Public projection: _projectPublicEntity strips adminInfo + ownerId.
 *
 * DB interactions are fully mocked — no real DB is touched.
 */

import {
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    PriceRangeEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import type { Gastronomy } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000002';
const DEST_ID = '00000000-0000-4000-a000-000000000003';
const OTHER_USER = '00000000-0000-4000-a000-000000000099';

function makeGastronomyEntity(overrides: Partial<Record<string, unknown>> = {}): Gastronomy {
    return {
        id: ENTITY_ID,
        name: 'La Parrilla del Sur',
        slug: 'la-parrilla-del-sur',
        type: GastronomyTypeEnum.PARRILLA,
        destinationId: DEST_ID,
        ownerId: OWNER_ID,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        visibility: VisibilityEnum.PUBLIC,
        isFeatured: false,
        averageRating: 0,
        reviewsCount: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as Gastronomy;
}

const ownerActor: Actor = {
    id: OWNER_ID,
    role: RoleEnum.COMMERCE_OWNER,
    permissions: [
        PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN,
        PermissionEnum.COMMERCE_CONTACT_EDIT_OWN,
        PermissionEnum.COMMERCE_SOCIAL_EDIT_OWN,
        PermissionEnum.COMMERCE_MEDIA_EDIT_OWN,
        PermissionEnum.COMMERCE_MENU_EDIT_OWN,
        PermissionEnum.COMMERCE_PRICE_RANGE_EDIT_OWN,
        PermissionEnum.COMMERCE_RICH_DESCRIPTION_EDIT_OWN,
        PermissionEnum.COMMERCE_AMENITIES_EDIT_OWN,
        PermissionEnum.COMMERCE_FEATURES_EDIT_OWN
    ]
};

const staffActor: Actor = {
    id: 'staff-uuid-1',
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.COMMERCE_CREATE,
        PermissionEnum.COMMERCE_EDIT_ALL,
        PermissionEnum.COMMERCE_DELETE,
        PermissionEnum.COMMERCE_VIEW_ALL
    ]
};

const otherUserActor: Actor = {
    id: OTHER_USER,
    role: RoleEnum.COMMERCE_OWNER,
    permissions: [PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN]
};

// ---------------------------------------------------------------------------
// Mock model factory
// ---------------------------------------------------------------------------

function makeGastronomyModel(entity: Gastronomy | null = null) {
    return {
        entityName: 'gastronomy',
        findById: vi.fn().mockResolvedValue(entity),
        findByIds: vi.fn().mockResolvedValue(entity ? [entity] : []),
        findOne: vi.fn().mockResolvedValue(entity),
        findAll: vi
            .fn()
            .mockResolvedValue({ items: entity ? [entity] : [], total: entity ? 1 : 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn().mockImplementation(async (data: Partial<Gastronomy>) => ({
            id: ENTITY_ID,
            ...data
        })),
        update: vi.fn().mockImplementation(async (_where: unknown, data: Partial<Gastronomy>) => ({
            id: ENTITY_ID,
            ...data
        })),
        updateById: vi.fn().mockImplementation(async (_id: string, data: Partial<Gastronomy>) => ({
            id: ENTITY_ID,
            ...data
        })),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        findWithRelations: vi.fn().mockResolvedValue(entity),
        findOneWithRelations: vi.fn().mockResolvedValue(entity),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

function makeJunctionModel() {
    return {
        findAll: vi.fn().mockResolvedValue({ items: [] }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

function makeCatalogModel(validIds: string[] = []) {
    return {
        findById: vi
            .fn()
            .mockImplementation((id: string) =>
                Promise.resolve(validIds.includes(id) ? { id } : null)
            )
    };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

type AnyService = any;

function makeService(entity: Gastronomy | null = null): GastronomyService {
    const service: AnyService = new GastronomyService({});
    const model = makeGastronomyModel(entity);
    service.model = model;
    service._amenityJunctionModelInstance = makeJunctionModel();
    service._featureJunctionModelInstance = makeJunctionModel();
    service._amenityModelInstance = makeCatalogModel();
    service._featureModelInstance = makeCatalogModel();
    return service as GastronomyService;
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
});

// ---------------------------------------------------------------------------
// updateOwn
// ---------------------------------------------------------------------------

describe('GastronomyService.updateOwn', () => {
    it('should return NOT_FOUND when gastronomy does not exist', async () => {
        const service = makeService(null);
        const result = await service.updateOwn(ENTITY_ID, {}, ownerActor);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND for non-owner actor (existence leak prevention)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(ENTITY_ID, {}, otherUserActor);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should allow staff with COMMERCE_EDIT_ALL to update any listing', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(
            ENTITY_ID,
            { priceRange: PriceRangeEnum.MID },
            staffActor
        );
        expect(result.error).toBeUndefined();
    });

    it('should allow an owner with the section editOwn permission to update operational fields (US-5)', async () => {
        // The owner holds COMMERCE_PRICE_RANGE_EDIT_OWN (an operational section
        // permission) and owns the listing. updateOwn enforces per-section gating,
        // then the base update()'s owner-aware _canUpdate (checkCanEditOwnOrAll)
        // accepts the owner — no COMMERCE_EDIT_ALL is required. This is the core
        // US-5 behavior: owners can edit operational fields on their own listing.
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(
            ENTITY_ID,
            { priceRange: PriceRangeEnum.MID },
            ownerActor
        );
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when owner lacks the specific section permission (per-section gate)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        // Actor is the owner but has NO permissions (not COMMERCE_PRICE_RANGE_EDIT_OWN, not COMMERCE_EDIT_ALL)
        const actorNoPerm: Actor = {
            id: OWNER_ID,
            role: RoleEnum.COMMERCE_OWNER,
            permissions: []
        };
        const result = await service.updateOwn(
            ENTITY_ID,
            { priceRange: PriceRangeEnum.MID }, // valid schema; per-section check fires before base update
            actorNoPerm
        );
        // Per-section gate fires first and rejects with FORBIDDEN
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return VALIDATION_ERROR for invalid payload (extra unknown key does not cause error — stripped by schema)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        // menuUrl must be an HTTPS URL when provided
        const result = await service.updateOwn(
            ENTITY_ID,
            { menuUrl: 'not-a-valid-url' },
            ownerActor
        );
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should call model.update when staff actor performs updateOwn', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        await service.updateOwn(ENTITY_ID, { priceRange: PriceRangeEnum.MID }, staffActor);

        expect(mockUpdate).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// updateOwn — AC-3 identity-field regression (SPEC-249 T-022)
// ---------------------------------------------------------------------------

describe('GastronomyService.updateOwn — AC-3 identity-field regression (SPEC-249 T-022)', () => {
    it('strips ALL forged identity/core fields while persisting the operational change', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        // Full forged identity/core set alongside one valid operational field.
        // biome-ignore lint/suspicious/noExplicitAny: simulating a forged HTTP body
        const forgedPayload: any = {
            priceRange: PriceRangeEnum.MID, // valid operational field — must persist
            name: 'FORGED_NAME',
            slug: 'forged-slug',
            type: GastronomyTypeEnum.CAFE,
            destinationId: '00000000-0000-4000-a000-0000000000ff',
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            visibility: VisibilityEnum.PRIVATE,
            moderationState: ModerationStatusEnum.REJECTED,
            isFeatured: true,
            ownerId: '00000000-0000-4000-a000-0000000000fe'
        };

        const result = await service.updateOwn(ENTITY_ID, forgedPayload, ownerActor);

        expect(result.error).toBeUndefined();
        // The base update MUST have been invoked (no silent skip).
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;

        // The valid operational field persisted.
        expect(updatePayload.priceRange).toBe(PriceRangeEnum.MID);
        // Every forged identity/core field was stripped by the owner-update schema.
        for (const forbidden of [
            'name',
            'slug',
            'type',
            'destinationId',
            'lifecycleState',
            'visibility',
            'moderationState',
            'isFeatured',
            'ownerId'
        ]) {
            expect(updatePayload).not.toHaveProperty(forbidden);
        }
    });
});

// ---------------------------------------------------------------------------
// _executeSearch (indirect — through search() public API with mocked model)
// ---------------------------------------------------------------------------

describe('GastronomyService search filter forwarding', () => {
    it('should call model.findAll with deletedAt: null filter', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAll = (service as AnyService).model.findAll;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {});

        expect(mockFindAll).toHaveBeenCalledWith(
            expect.objectContaining({ deletedAt: null }),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('should call model.count with deletedAt: null filter', async () => {
        const service = makeService();
        const mockCount = (service as AnyService).model.count;

        await (
            service as unknown as { _executeCount: (...args: unknown[]) => unknown }
        )._executeCount({ page: 1, pageSize: 10 }, staffActor, {});

        expect(mockCount).toHaveBeenCalledWith(
            expect.objectContaining({ deletedAt: null }),
            expect.anything()
        );
    });
});

// ---------------------------------------------------------------------------
// _projectPublicEntity
// ---------------------------------------------------------------------------

describe('GastronomyService._projectPublicEntity', () => {
    it('should strip adminInfo from the projected entity', () => {
        const entity = makeGastronomyEntity({ adminInfo: { notes: 'internal' } });
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).not.toHaveProperty('adminInfo');
    });

    it('should strip ownerId from the projected entity', () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).not.toHaveProperty('ownerId');
    });
});

// ---------------------------------------------------------------------------
// ENTITY_NAME
// ---------------------------------------------------------------------------

describe('GastronomyService.ENTITY_NAME', () => {
    it('should be "gastronomy"', () => {
        expect(GastronomyService.ENTITY_NAME).toBe('gastronomy');
    });
});

// ---------------------------------------------------------------------------
// Public search/count visibility filter (AC-6.2 / AC-4.3 regression)
// A hidden (PRIVATE/non-ACTIVE) listing must never surface on the public list.
// ---------------------------------------------------------------------------

describe('GastronomyService public search visibility filter (AC-6.2)', () => {
    it('forces visibility=PUBLIC + lifecycleState=ACTIVE on public search (no hidden-listing leak)', async () => {
        const service = makeService(makeGastronomyEntity());
        const model = (service as AnyService).model;
        await service.search(otherUserActor, { page: 1, pageSize: 10 });
        expect(model.findAll).toHaveBeenCalled();
        expect(model.findAll.mock.calls[0][0]).toMatchObject({
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('forces the same visibility filter on the public count', async () => {
        const service = makeService(makeGastronomyEntity());
        const model = (service as AnyService).model;
        await service.count(otherUserActor, { page: 1, pageSize: 10 });
        expect(model.count).toHaveBeenCalled();
        expect(model.count.mock.calls[0][0]).toMatchObject({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });
});

// ---------------------------------------------------------------------------
// assignOwner — dedicated ownership action (regression: SPEC-239 assign-owner
// was routed through update(), which omits ownerId, so it silently no-op'd)
// ---------------------------------------------------------------------------

describe('GastronomyService.assignOwner', () => {
    it('writes the new ownerId via model.update for a staff actor', async () => {
        const service = makeService(makeGastronomyEntity());
        const model = (service as AnyService).model;

        const result = await service.assignOwner(staffActor, ENTITY_ID, OTHER_USER);

        expect(result.error).toBeUndefined();
        expect(model.update).toHaveBeenCalledTimes(1);
        // The update payload MUST carry ownerId (the bug was that it never did).
        expect(model.update.mock.calls[0][1]).toMatchObject({ ownerId: OTHER_USER });
        expect(result.data?.ownerId).toBe(OTHER_USER);
    });

    it('returns FORBIDDEN when the actor lacks COMMERCE_EDIT_ALL', async () => {
        const service = makeService(makeGastronomyEntity());
        const model = (service as AnyService).model;

        const result = await service.assignOwner(ownerActor, ENTITY_ID, OTHER_USER);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when the listing does not exist', async () => {
        const service = makeService(null);
        const model = (service as AnyService).model;

        const result = await service.assignOwner(staffActor, ENTITY_ID, OTHER_USER);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// listOwn — owner-tier read inherited from BaseCommerceListingService (SPEC-249 T-004)
// ---------------------------------------------------------------------------

describe('GastronomyService.listOwn', () => {
    it("lists the owner's own non-deleted gastronomy listings (hard-scoped to ownerId)", async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAll = (service as AnyService).model.findAll;

        const result = await service.listOwn(ownerActor);

        expect(result.error).toBeUndefined();
        expect(result.data?.listings).toHaveLength(1);
        expect(mockFindAll).toHaveBeenCalledWith(
            { ownerId: OWNER_ID, deletedAt: null },
            { page: 1, pageSize: 100 },
            undefined,
            undefined
        );
    });
});
