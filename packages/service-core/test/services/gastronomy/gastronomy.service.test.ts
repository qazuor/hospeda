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

import type { Gastronomy } from '@repo/schemas';
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
    // SPEC-253 D2=b: single COMMERCE_EDIT_OWN replaces 10 per-section perms
    permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
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
    // SPEC-253 D2=b: COMMERCE_EDIT_OWN gives owner rights but entity.ownerId != OTHER_USER
    permissions: [PermissionEnum.COMMERCE_EDIT_OWN]
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
    // HOS-166 D-1: destinationId is now owner-editable, so `_beforeUpdate`'s
    // CITY-type validation (`_assertDestinationIsCity`) can run in these unit
    // tests too — stub `_destinationModel` (real `DestinationModel` by
    // default, per the base class's constructor) so it never touches a real DB.
    service._destinationModel = {
        findById: vi.fn().mockResolvedValue({ destinationType: 'CITY' })
    };
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

    it('should allow an owner with COMMERCE_EDIT_OWN to update operational fields (US-5)', async () => {
        // SPEC-253 D2=b: single COMMERCE_EDIT_OWN gate replaces per-section gating.
        // The owner holds COMMERCE_EDIT_OWN and owns the listing. updateOwn enforces
        // the single gate, then the base update()'s _canUpdate (checkCanEditOwnOrAll)
        // accepts the owner — no COMMERCE_EDIT_ALL is required. Core US-5 behavior.
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(
            ENTITY_ID,
            { priceRange: PriceRangeEnum.MID },
            ownerActor
        );
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when owner lacks COMMERCE_EDIT_OWN (single gate)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        // Actor is the owner but has NO permissions (not COMMERCE_EDIT_OWN, not COMMERCE_EDIT_ALL)
        const actorNoPerm: Actor = {
            id: OWNER_ID,
            role: RoleEnum.COMMERCE_OWNER,
            permissions: []
        };
        const result = await service.updateOwn(
            ENTITY_ID,
            { priceRange: PriceRangeEnum.MID }, // valid schema; single perm check fires before base update
            actorNoPerm
        );
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    // SPEC-253 T-010 Block B: new owner-editable fields persist correctly
    it('should persist type when owner updates it (SPEC-253 AC-1/AC-5)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        const result = await service.updateOwn(
            ENTITY_ID,
            { type: GastronomyTypeEnum.CAFE },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        // type is now owner-editable (SPEC-253 AC-5 — removed from identity-strip set)
        expect(updatePayload.type).toBe(GastronomyTypeEnum.CAFE);
    });

    it('should persist summary when owner updates it (SPEC-253 AC-1)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        const result = await service.updateOwn(
            ENTITY_ID,
            { summary: 'Un resumen actualizado con más de diez caracteres.' },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        expect(updatePayload.summary).toBe('Un resumen actualizado con más de diez caracteres.');
    });

    it('should persist nameI18n/summaryI18n/descriptionI18n/richDescriptionI18n (SPEC-253 AC-1)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        const i18nValue = { es: 'Texto ES', en: 'Text EN', pt: 'Texto PT' };

        const result = await service.updateOwn(
            ENTITY_ID,
            {
                nameI18n: i18nValue,
                summaryI18n: i18nValue,
                descriptionI18n: i18nValue,
                richDescriptionI18n: i18nValue
            },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        expect(updatePayload.nameI18n).toEqual(i18nValue);
        expect(updatePayload.summaryI18n).toEqual(i18nValue);
        expect(updatePayload.descriptionI18n).toEqual(i18nValue);
        expect(updatePayload.richDescriptionI18n).toEqual(i18nValue);
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

// SPEC-249 AC-3 regression, updated per SPEC-253 AC-5 and then HOS-166 D-1:
// `type` is NO LONGER stripped (SPEC-253) — owners can now edit the listing
// sub-category. `summary` is also owner-editable. HOS-166 D-1 REVERSES
// SPEC-239 decision #5 further: `name`, `description`, `destinationId` are
// now owner-editable identity fields too (the admin no longer creates every
// listing, so the owner has to own their own identity). `slug` stays
// admin-only post-create (HOS-166 OQ-3 — derived server-side from `name` at
// create, staff-only rename after). Only true control fields
// (lifecycle/visibility/moderation/isFeatured/ownerId) remain stripped.
describe('GastronomyService.updateOwn — identity-field regression (SPEC-249 T-022, SPEC-253, HOS-166 D-1)', () => {
    it('persists name/description/destinationId/type/summary/i18n; strips control fields + slug', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        // biome-ignore lint/suspicious/noExplicitAny: simulating a forged HTTP body
        const payload: any = {
            priceRange: PriceRangeEnum.MID, // operational — must persist
            type: GastronomyTypeEnum.CAFE, // owner-editable (SPEC-253 D1) — must persist
            summary: 'Un nuevo resumen válido de diez caracteres o más.', // owner-editable
            name: 'Nuevo nombre del local', // HOS-166 D-1: owner-editable identity — must persist
            description:
                'Una descripción base actualizada por el propio dueño del comercio para su ficha.', // HOS-166 D-1 — must persist
            destinationId: '00000000-0000-4000-a000-0000000000ff', // HOS-166 D-1 — must persist
            slug: 'forged-slug', // immutable post-create (OQ-3) — stripped
            lifecycleState: LifecycleStatusEnum.ARCHIVED, // control field — stripped
            visibility: VisibilityEnum.PRIVATE, // control field — stripped
            moderationState: ModerationStatusEnum.REJECTED, // control field — stripped
            isFeatured: true, // control field — stripped
            ownerId: '00000000-0000-4000-a000-0000000000fe' // control field — stripped
        };

        const result = await service.updateOwn(ENTITY_ID, payload, ownerActor);

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;

        // Operational and owner-editable identity fields persist.
        expect(updatePayload.priceRange).toBe(PriceRangeEnum.MID);
        expect(updatePayload.type).toBe(GastronomyTypeEnum.CAFE);
        expect(updatePayload.summary).toBeDefined();
        expect(updatePayload.name).toBe('Nuevo nombre del local');
        expect(updatePayload.description).toBe(payload.description);
        expect(updatePayload.destinationId).toBe(payload.destinationId);

        // Control fields + immutable slug are still stripped by the owner-update schema.
        for (const forbidden of [
            'slug',
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
    it('should call model.findAllWithRelations with deletedAt: null filter (Bug B7a: relations loaded for destinationName)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {});

        // After B7a fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destination: true, owner: true }),
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
// _canView (visibility gate) — HOS-117 T-022
// ---------------------------------------------------------------------------

describe('GastronomyService._canView', () => {
    it('should throw GONE for a deleted PUBLIC entity when actor lacks COMMERCE_VIEW_ALL', () => {
        // The deleted-at gate fires first (before the owner check), so both owner
        // and non-owner actors without COMMERCE_VIEW_ALL receive GONE (410,
        // deindex) instead of NOT_FOUND (404, never existed) — but only because
        // this listing was PUBLIC (indexable) before deletion.
        const entity = makeGastronomyEntity({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        expect(() => (service as AnyService)._canView(ownerActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.GONE })
        );
        expect(() => (service as AnyService)._canView(otherUserActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.GONE })
        );
    });

    it('should throw NOT_FOUND (not GONE) for a deleted PRIVATE entity — anti-enumeration (SPEC-092 T-087)', () => {
        // A PRIVATE listing was never publicly discoverable, so its deletion
        // must stay a uniform 404 (never distinguishable from never-existed).
        const entity = makeGastronomyEntity({
            visibility: VisibilityEnum.PRIVATE,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        expect(() => (service as AnyService)._canView(otherUserActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.NOT_FOUND })
        );
        expect(() => (service as AnyService)._canView(ownerActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.NOT_FOUND })
        );
    });

    it('should allow staff with COMMERCE_VIEW_ALL to view deleted entities', () => {
        const entity = makeGastronomyEntity({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        expect(() => (service as AnyService)._canView(staffActor, entity)).not.toThrow();
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
        // After B7a fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(model.findAllWithRelations).toHaveBeenCalled();
        expect(model.findAllWithRelations.mock.calls[0][1]).toMatchObject({
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

// ---------------------------------------------------------------------------
// Bug B7a regression — _executeSearch loads destination+owner relations
// Fixes: destinationName always empty on gastronomy card (findAll never joined
// the destination table; findAllWithRelations does).
// ---------------------------------------------------------------------------

describe('GastronomyService._executeSearch — B7a regression (destination relation loaded)', () => {
    it('passes destination: true and owner: true to findAllWithRelations', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {});

        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destination: true, owner: true }),
            expect.any(Object),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('preserves the AC-6.2 security invariant (visibility=PUBLIC + lifecycleState=ACTIVE + deletedAt=null) in the where argument', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10, destinationId: DEST_ID }, staffActor, {});

        // arg[1] is the where object in findAllWithRelations
        expect(mockFindAllWithRelations.mock.calls[0]?.[1]).toMatchObject({
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        // Scalar filters from caller are forwarded too
        expect(mockFindAllWithRelations.mock.calls[0]?.[1]).toMatchObject({
            destinationId: DEST_ID
        });
    });
});

// ---------------------------------------------------------------------------
// BETA-119 regression — _executeSearch forwards sort from ctx.pagination
// Before the fix, sortBy/sortOrder were destructured out of params (to _sortBy/
// _sortOrder) and discarded, so findAllWithRelations received only { page,
// pageSize } and built no ORDER BY — the public listing's sort dropdown was a
// silent no-op. BaseCrudRead.search republishes sort via ctx.pagination, so the
// service must read it from there.
// ---------------------------------------------------------------------------

describe('GastronomyService._executeSearch — BETA-119 regression (sort forwarded from ctx.pagination)', () => {
    it('forwards ctx.pagination.sortBy/sortOrder into the findAllWithRelations pagination argument', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {
            pagination: { sortBy: 'name', sortOrder: 'asc' }
        });

        // arg[2] is the pagination options object in findAllWithRelations
        expect(mockFindAllWithRelations.mock.calls[0]?.[2]).toMatchObject({
            page: 1,
            pageSize: 10,
            sortBy: 'name',
            sortOrder: 'asc'
        });
    });

    it('leaves sortBy/sortOrder undefined when ctx has no pagination (no ORDER BY forced)', async () => {
        const entity = makeGastronomyEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {});

        const paginationArg = mockFindAllWithRelations.mock.calls[0]?.[2] as {
            sortBy?: unknown;
            sortOrder?: unknown;
        };
        expect(paginationArg.sortBy).toBeUndefined();
        expect(paginationArg.sortOrder).toBeUndefined();
    });
});
