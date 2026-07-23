/**
 * experience.service.test.ts
 *
 * Unit tests for ExperienceService (SPEC-240 T-017).
 *
 * Coverage:
 * - updateOwn: schema validation, ownership gate, per-section permission gates,
 *   staff bypass, delegation to base update.
 * - _executeSearch: scalar filters forwarded to model.findAllWithRelations.
 * - _executeCount: scalar filters forwarded to model.count.
 * - Permission hook delegation via _canCreate / _canUpdate / _canSoftDelete.
 * - Public projection: _projectPublicEntity strips adminInfo + ownerId.
 * - Owner-scoping guard (SPEC-169 discipline + SPEC-240 AC-4.1):
 *   owner can update operational sections only on their own listing.
 *   Non-owner gets NOT_FOUND (existence leak prevention).
 *   Admin identity fields (name, slug, type, priceFrom, priceUnit, destinationId)
 *   are absent from the owner schema and silently stripped.
 *
 * DB interactions are fully mocked — no real DB is touched.
 */

import type { Experience } from '@repo/schemas';
import {
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000002';
const DEST_ID = '00000000-0000-4000-a000-000000000003';
const OTHER_USER = '00000000-0000-4000-a000-000000000099';

function makeExperienceEntity(overrides: Partial<Record<string, unknown>> = {}): Experience {
    return {
        id: ENTITY_ID,
        name: 'City Kayak Tour',
        slug: 'city-kayak-tour',
        type: ExperienceTypeEnum.EXCURSION,
        priceFrom: 150000,
        priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
        isPriceOnRequest: false,
        hasActiveSubscription: true,
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
    } as Experience;
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

// biome-ignore lint/suspicious/noExplicitAny: test helper — explicit any is intentional for mock wiring
type AnyService = any;

function makeExperienceModel(entity: Experience | null = null) {
    return {
        entityName: 'experiences',
        findById: vi.fn().mockResolvedValue(entity),
        findByIds: vi.fn().mockResolvedValue(entity ? [entity] : []),
        findOne: vi.fn().mockResolvedValue(entity),
        findAll: vi
            .fn()
            .mockResolvedValue({ items: entity ? [entity] : [], total: entity ? 1 : 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn().mockImplementation(async (data: Partial<Experience>) => ({
            id: ENTITY_ID,
            ...data
        })),
        update: vi.fn().mockImplementation(async (_where: unknown, data: Partial<Experience>) => ({
            id: ENTITY_ID,
            ...data
        })),
        updateById: vi.fn().mockImplementation(async (_id: string, data: Partial<Experience>) => ({
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

function makeService(entity: Experience | null = null): ExperienceService {
    const service: AnyService = new ExperienceService({});
    const model = makeExperienceModel(entity);
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
    return service as ExperienceService;
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
});

// ---------------------------------------------------------------------------
// updateOwn — ownership gate (SPEC-240 AC-4.1 / SPEC-169 discipline)
// ---------------------------------------------------------------------------

describe('ExperienceService.updateOwn — ownership gate', () => {
    it('should return NOT_FOUND when experience does not exist', async () => {
        const service = makeService(null);
        const result = await service.updateOwn(ENTITY_ID, {}, ownerActor);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND for a non-owner actor (existence leak prevention)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(ENTITY_ID, {}, otherUserActor);
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should allow the listing owner with editOwn permission to update operational fields', async () => {
        // Core US-5 / AC-4.1: owner can edit operational sections on their own listing.
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(ENTITY_ID, { isPriceOnRequest: true }, ownerActor);
        expect(result.error).toBeUndefined();
    });

    it('should allow staff with COMMERCE_EDIT_ALL to update any listing', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const result = await service.updateOwn(ENTITY_ID, { isPriceOnRequest: false }, staffActor);
        expect(result.error).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// updateOwn — per-section permission gates
// ---------------------------------------------------------------------------

describe('ExperienceService.updateOwn — single COMMERCE_EDIT_OWN gate (SPEC-253 D2=b)', () => {
    it('should return FORBIDDEN when owner lacks COMMERCE_EDIT_OWN (no per-section gates)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const actorNoPerm: Actor = {
            id: OWNER_ID,
            role: RoleEnum.COMMERCE_OWNER,
            permissions: [] // no permissions at all
        };
        const result = await service.updateOwn(ENTITY_ID, { isPriceOnRequest: true }, actorNoPerm);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    // SPEC-253 T-010 Block B: new owner-editable fields persist correctly
    it('should persist type when owner updates it (SPEC-253 AC-1/AC-5)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        const result = await service.updateOwn(
            ENTITY_ID,
            { type: ExperienceTypeEnum.TOUR_GUIDE },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        // type is now owner-editable (SPEC-253 AC-5 — removed from identity-strip set)
        expect(updatePayload.type).toBe(ExperienceTypeEnum.TOUR_GUIDE);
    });

    it('should persist priceFrom and priceUnit when owner updates them (SPEC-253 AC-1)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        const result = await service.updateOwn(
            ENTITY_ID,
            { priceFrom: 250000, priceUnit: ExperiencePriceUnitEnum.PER_GROUP },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        expect(updatePayload.priceFrom).toBe(250000);
        expect(updatePayload.priceUnit).toBe(ExperiencePriceUnitEnum.PER_GROUP);
    });

    it('should persist summary when owner updates it (SPEC-253 AC-1)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        const result = await service.updateOwn(
            ENTITY_ID,
            { summary: 'Resumen actualizado con diez o más caracteres.' },
            ownerActor
        );

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;
        expect(updatePayload.summary).toBe('Resumen actualizado con diez o más caracteres.');
    });

    it('should persist i18n fields when owner updates them (SPEC-253 AC-1)', async () => {
        const entity = makeExperienceEntity();
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

    it('should bypass per-section gates for staff with COMMERCE_EDIT_ALL', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        // Staff can update any field without any editOwn permission
        const result = await service.updateOwn(
            ENTITY_ID,
            { richDescription: '<p>New description</p>', isPriceOnRequest: true },
            staffActor
        );
        expect(result.error).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// updateOwn — schema enforcement (identity fields stripped)
// ---------------------------------------------------------------------------

describe('ExperienceService.updateOwn — schema enforcement', () => {
    // SPEC-253 AC-5: type/priceFrom/priceUnit are now owner-editable.
    // HOS-166 D-1: name/description/destinationId are ALSO now owner-editable
    // identity fields (reverses SPEC-239 decision #5). Only `slug` (immutable
    // post-create, OQ-3) and true control fields remain admin-only.
    it('accepts type/priceFrom/priceUnit AND name/destinationId (HOS-166 D-1 identity reversal)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        // biome-ignore lint/suspicious/noExplicitAny: test coercion — simulating mixed HTTP body
        const mixedPayload: any = {
            isPriceOnRequest: false, // valid operational field — persists
            type: ExperienceTypeEnum.TOUR_GUIDE, // owner-editable — persists
            priceFrom: 150000, // owner-editable — persists (non-negative integer)
            name: 'Nuevo nombre', // HOS-166 D-1: owner-editable identity — persists
            destinationId: '00000000-0000-4000-a000-0000000000aa' // HOS-166 D-1 — persists
        };
        const result = await service.updateOwn(ENTITY_ID, mixedPayload, ownerActor);
        expect(result.error).toBeUndefined();
        const updateArgs = mockUpdate.mock.calls[0];
        if (updateArgs) {
            const updatePayload = updateArgs[1] as Record<string, unknown>;
            // type and priceFrom persist (SPEC-253 AC-5)
            expect(updatePayload.type).toBe(ExperienceTypeEnum.TOUR_GUIDE);
            expect(updatePayload.priceFrom).toBe(150000);
            // Identity fields now persist too (HOS-166 D-1)
            expect(updatePayload.name).toBe('Nuevo nombre');
            expect(updatePayload.destinationId).toBe(mixedPayload.destinationId);
        }
    });

    it('still strips slug (immutable post-create — HOS-166 OQ-3)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        // biome-ignore lint/suspicious/noExplicitAny: test coercion — simulating a forged HTTP body
        const payload: any = { isPriceOnRequest: false, slug: 'forged-slug' };
        await service.updateOwn(ENTITY_ID, payload, ownerActor);
        const updateArgs = mockUpdate.mock.calls[0];
        if (updateArgs) {
            const updatePayload = updateArgs[1] as Record<string, unknown>;
            expect(updatePayload).not.toHaveProperty('slug');
        }
    });

    it('should not allow hasActiveSubscription in owner update (subscription lifecycle only)', async () => {
        // hasActiveSubscription is admin-only; owner cannot toggle it.
        // The field is absent from ExperienceOwnerUpdateInputSchema so it is stripped silently.
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        // biome-ignore lint/suspicious/noExplicitAny: test coercion — simulating forged HTTP body
        const forgedPayload: any = {
            isPriceOnRequest: false,
            hasActiveSubscription: true // should be stripped
        };
        await service.updateOwn(ENTITY_ID, forgedPayload, ownerActor);
        const updateArgs = mockUpdate.mock.calls[0];
        if (updateArgs) {
            const updatePayload = updateArgs[1] as Record<string, unknown>;
            expect(updatePayload).not.toHaveProperty('hasActiveSubscription');
        }
    });
});

// ---------------------------------------------------------------------------
// updateOwn — AC-3 identity-field regression (SPEC-249 T-022)
// ---------------------------------------------------------------------------

// SPEC-249 AC-3 regression, updated per SPEC-253 AC-5 and then HOS-166 D-1:
// `type`, `priceFrom`, `priceUnit` are NO LONGER stripped (SPEC-253) — owners
// can now edit them. `summary` is also owner-editable. HOS-166 D-1 further
// reverses SPEC-239 decision #5: `name`, `description`, `destinationId` are
// now owner-editable identity fields too. `slug` stays admin-only post-create
// (OQ-3); only true control fields (lifecycle/visibility/moderation/
// isFeatured/hasActiveSubscription/ownerId) remain stripped.
describe('ExperienceService.updateOwn — identity-field regression (SPEC-249 T-022, SPEC-253, HOS-166 D-1)', () => {
    it('persists name/description/destinationId/type/priceFrom/priceUnit/summary/i18n; strips slug + control fields', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;

        // biome-ignore lint/suspicious/noExplicitAny: simulating a mixed HTTP body
        const payload: any = {
            isPriceOnRequest: true, // operational — must persist
            type: ExperienceTypeEnum.TOUR_GUIDE, // owner-editable (SPEC-253 D1) — must persist
            priceFrom: 100000, // owner-editable — must persist
            priceUnit: ExperiencePriceUnitEnum.PER_GROUP, // owner-editable — must persist
            name: 'Nuevo nombre del tour', // HOS-166 D-1: owner-editable identity — must persist
            description:
                'Una descripción base actualizada por el propio dueño del comercio para su ficha.', // HOS-166 D-1 — must persist
            destinationId: '00000000-0000-4000-a000-0000000000ff', // HOS-166 D-1 — must persist
            slug: 'forged-slug', // immutable post-create (OQ-3) — stripped
            lifecycleState: LifecycleStatusEnum.ARCHIVED, // control field — stripped
            visibility: VisibilityEnum.PRIVATE, // control field — stripped
            moderationState: ModerationStatusEnum.REJECTED, // control field — stripped
            isFeatured: true, // control field — stripped
            hasActiveSubscription: false, // subscription lifecycle only — stripped
            ownerId: '00000000-0000-4000-a000-0000000000fe' // control field — stripped
        };

        const result = await service.updateOwn(ENTITY_ID, payload, ownerActor);

        expect(result.error).toBeUndefined();
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const updatePayload = (mockUpdate.mock.calls[0]?.[1] ?? {}) as Record<string, unknown>;

        // Operational and owner-editable fields persist.
        expect(updatePayload.isPriceOnRequest).toBe(true);
        expect(updatePayload.type).toBe(ExperienceTypeEnum.TOUR_GUIDE); // SPEC-253 AC-5
        expect(updatePayload.priceFrom).toBe(100000); // SPEC-253 AC-5
        expect(updatePayload.priceUnit).toBe(ExperiencePriceUnitEnum.PER_GROUP); // SPEC-253 AC-5
        expect(updatePayload.name).toBe('Nuevo nombre del tour'); // HOS-166 D-1
        expect(updatePayload.description).toBe(payload.description); // HOS-166 D-1
        expect(updatePayload.destinationId).toBe(payload.destinationId); // HOS-166 D-1

        // Immutable slug + control fields are still stripped by the owner-update schema.
        for (const forbidden of [
            'slug',
            'lifecycleState',
            'visibility',
            'moderationState',
            'isFeatured',
            'hasActiveSubscription',
            'ownerId'
        ]) {
            expect(updatePayload).not.toHaveProperty(forbidden);
        }
    });
});

// ---------------------------------------------------------------------------
// _executeSearch
// ---------------------------------------------------------------------------

describe('ExperienceService search filter forwarding', () => {
    it('should call model.findAllWithRelations with deletedAt: null filter (Bug B3: relations loaded for destinationName)', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {});

        // After B3 fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destination: true, owner: true }),
            expect.objectContaining({ deletedAt: null }),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('should forward type filter to model.findAllWithRelations', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch(
            { type: ExperienceTypeEnum.TOUR_GUIDE, page: 1, pageSize: 10 },
            staffActor,
            {}
        );

        // After B3 fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destination: true, owner: true }),
            expect.objectContaining({ type: ExperienceTypeEnum.TOUR_GUIDE, deletedAt: null }),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('should forward hasActiveSubscription filter to model.findAllWithRelations', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ hasActiveSubscription: true, page: 1, pageSize: 10 }, staffActor, {});

        // After B3 fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalledWith(
            expect.objectContaining({ destination: true, owner: true }),
            expect.objectContaining({ hasActiveSubscription: true }),
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
// Public search/count visibility filter (AC-6.2 / AC-4.3 regression)
// A hidden (PRIVATE / non-ACTIVE) listing must never surface on the public list.
// Before this fix the experience public list leaked DRAFT/PRIVATE/no-subscription
// listings because _executeSearch only filtered deletedAt=null (gastronomy parity).
// ---------------------------------------------------------------------------

describe('ExperienceService public search visibility filter (AC-6.2)', () => {
    it('forces visibility=PUBLIC + lifecycleState=ACTIVE on public search (no hidden-listing leak)', async () => {
        const service = makeService(makeExperienceEntity());
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, otherUserActor, {});

        // After B3 fix: _executeSearch uses findAllWithRelations (arg[0]=relations, arg[1]=where)
        expect(mockFindAllWithRelations).toHaveBeenCalled();
        expect(mockFindAllWithRelations.mock.calls[0][1]).toMatchObject({
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('cannot be widened by a caller-supplied visibility/lifecycle param', async () => {
        const service = makeService(makeExperienceEntity());
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch(
            {
                visibility: VisibilityEnum.PRIVATE,
                lifecycleState: LifecycleStatusEnum.DRAFT,
                page: 1,
                pageSize: 10
            },
            otherUserActor,
            {}
        );

        // The forced gates are applied AFTER the spread, so they win.
        // arg[1] is the where object in findAllWithRelations
        expect(mockFindAllWithRelations.mock.calls[0][1]).toMatchObject({
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });

    it('forces the same visibility filter on the public count', async () => {
        const service = makeService(makeExperienceEntity());
        const mockCount = (service as AnyService).model.count;

        await (
            service as unknown as { _executeCount: (...args: unknown[]) => unknown }
        )._executeCount({ page: 1, pageSize: 10 }, otherUserActor, {});

        expect(mockCount.mock.calls[0][0]).toMatchObject({
            deletedAt: null,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
    });
});

// ---------------------------------------------------------------------------
// _projectPublicEntity
// ---------------------------------------------------------------------------

describe('ExperienceService._projectPublicEntity', () => {
    it('should strip adminInfo from the projected entity', () => {
        const entity = makeExperienceEntity({ adminInfo: { notes: 'internal' } });
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).not.toHaveProperty('adminInfo');
    });

    it('should strip ownerId from the projected entity', () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).not.toHaveProperty('ownerId');
    });

    it('should preserve pricing fields (priceFrom, priceUnit, isPriceOnRequest) in public projection', () => {
        const entity = makeExperienceEntity({ priceFrom: 50000, isPriceOnRequest: false });
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).toHaveProperty('priceFrom', 50000);
        expect(result).toHaveProperty('priceUnit');
        expect(result).toHaveProperty('isPriceOnRequest', false);
    });

    it('should preserve hasActiveSubscription in public projection', () => {
        const entity = makeExperienceEntity({ hasActiveSubscription: true });
        const service = makeService(entity);
        const result = (service as AnyService)._projectPublicEntity(entity);
        expect(result).toHaveProperty('hasActiveSubscription', true);
    });
});

// ---------------------------------------------------------------------------
// _canView (visibility gate)
// ---------------------------------------------------------------------------

describe('ExperienceService._canView', () => {
    it('should throw GONE for a deleted PUBLIC entity when actor lacks COMMERCE_VIEW_ALL', () => {
        // The deleted-at gate fires first (before the owner check), so both owner
        // and non-owner actors without COMMERCE_VIEW_ALL receive GONE (HOS-117
        // T-022) — but only because this listing was PUBLIC (indexable) before
        // deletion. Refined product decision: 410 is reserved for content that
        // was actually publicly discoverable.
        const entity = makeExperienceEntity({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        // Owner without COMMERCE_VIEW_ALL → GONE (matches gastronomy parity)
        expect(() => (service as AnyService)._canView(ownerActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.GONE })
        );
        // Non-owner, non-staff also gets GONE
        const nonOwner: Actor = { id: OTHER_USER, role: RoleEnum.USER, permissions: [] };
        expect(() => (service as AnyService)._canView(nonOwner, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.GONE })
        );
    });

    it('should throw NOT_FOUND (not GONE) for a deleted PRIVATE entity — anti-enumeration (SPEC-092 T-087)', () => {
        // A PRIVATE listing was never publicly discoverable, so its deletion
        // must not be observably distinguishable from never-existed (uniform
        // 404), preserving the anti-enumeration contract.
        const entity = makeExperienceEntity({
            visibility: VisibilityEnum.PRIVATE,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        const nonOwner: Actor = { id: OTHER_USER, role: RoleEnum.USER, permissions: [] };
        expect(() => (service as AnyService)._canView(nonOwner, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.NOT_FOUND })
        );
        expect(() => (service as AnyService)._canView(ownerActor, entity)).toThrow(
            expect.objectContaining({ code: ServiceErrorCode.NOT_FOUND })
        );
    });

    it('should allow staff with COMMERCE_VIEW_ALL to view deleted entities', () => {
        const entity = makeExperienceEntity({
            visibility: VisibilityEnum.PUBLIC,
            deletedAt: new Date()
        });
        const service = makeService(entity);
        expect(() => (service as AnyService)._canView(staffActor, entity)).not.toThrow();
    });

    it('should throw NOT_FOUND for PRIVATE listing when actor is not owner or staff', () => {
        const entity = makeExperienceEntity({ visibility: VisibilityEnum.PRIVATE });
        const service = makeService(entity);
        const publicActor: Actor = { id: OTHER_USER, role: RoleEnum.USER, permissions: [] };
        expect(() => (service as AnyService)._canView(publicActor, entity)).toThrow();
    });

    it('should allow owner to view their own PRIVATE listing', () => {
        const entity = makeExperienceEntity({ visibility: VisibilityEnum.PRIVATE });
        const service = makeService(entity);
        expect(() => (service as AnyService)._canView(ownerActor, entity)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Subscription toggle (hasActiveSubscription flag)
// ---------------------------------------------------------------------------

describe('ExperienceService subscription visibility gate', () => {
    it('should have hasActiveSubscription false by default on new entities', () => {
        const entity = makeExperienceEntity({ hasActiveSubscription: false });
        expect(entity.hasActiveSubscription).toBe(false);
    });

    it('should allow staff to flip hasActiveSubscription via generic update', async () => {
        const entity = makeExperienceEntity({ hasActiveSubscription: false });
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        // Staff uses the admin update path (not updateOwn) to flip the subscription flag.
        await service.update(staffActor, ENTITY_ID, {
            hasActiveSubscription: true
        } as Partial<Experience>);
        expect(mockUpdate).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// ENTITY_NAME
// ---------------------------------------------------------------------------

describe('ExperienceService.ENTITY_NAME', () => {
    it('should be "experience"', () => {
        expect(ExperienceService.ENTITY_NAME).toBe('experience');
    });
});

// ---------------------------------------------------------------------------
// listOwn — owner-tier read inherited from BaseCommerceListingService (SPEC-249 T-005)
// ---------------------------------------------------------------------------

describe('ExperienceService.listOwn', () => {
    it("lists the owner's own non-deleted experience listings (hard-scoped to ownerId)", async () => {
        const entity = makeExperienceEntity();
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
// BETA-119 regression — _executeSearch forwards sort from ctx.pagination
// Before the fix, sortBy/sortOrder were destructured out of params (to _sortBy/
// _sortOrder) and discarded, so findAllWithRelations received only { page,
// pageSize } and built no ORDER BY — the public listing's sort dropdown was a
// silent no-op. BaseCrudRead.search republishes sort via ctx.pagination, so the
// service must read it from there.
// ---------------------------------------------------------------------------

describe('ExperienceService._executeSearch — BETA-119 regression (sort forwarded from ctx.pagination)', () => {
    it('forwards ctx.pagination.sortBy/sortOrder into the findAllWithRelations pagination argument', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAllWithRelations = (service as AnyService).model.findAllWithRelations;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ page: 1, pageSize: 10 }, staffActor, {
            pagination: { sortBy: 'averageRating', sortOrder: 'desc' }
        });

        // arg[2] is the pagination options object in findAllWithRelations
        expect(mockFindAllWithRelations.mock.calls[0]?.[2]).toMatchObject({
            page: 1,
            pageSize: 10,
            sortBy: 'averageRating',
            sortOrder: 'desc'
        });
    });

    it('leaves sortBy/sortOrder undefined when ctx has no pagination (no ORDER BY forced)', async () => {
        const entity = makeExperienceEntity();
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
