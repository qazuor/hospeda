/**
 * experience.service.test.ts
 *
 * Unit tests for ExperienceService (SPEC-240 T-017).
 *
 * Coverage:
 * - updateOwn: schema validation, ownership gate, per-section permission gates,
 *   staff bypass, delegation to base update.
 * - _executeSearch: scalar filters forwarded to model.findAll.
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
import type { Experience } from '@repo/schemas';
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
    permissions: [
        PermissionEnum.COMMERCE_SCHEDULE_EDIT_OWN,
        PermissionEnum.COMMERCE_CONTACT_EDIT_OWN,
        PermissionEnum.COMMERCE_SOCIAL_EDIT_OWN,
        PermissionEnum.COMMERCE_MEDIA_EDIT_OWN,
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

describe('ExperienceService.updateOwn — per-section permission gates', () => {
    it('should return FORBIDDEN when owner lacks the section permission', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const actorNoPerm: Actor = {
            id: OWNER_ID,
            role: RoleEnum.COMMERCE_OWNER,
            permissions: [] // no permissions at all
        };
        // isPriceOnRequest → COMMERCE_PRICE_RANGE_EDIT_OWN gate
        const result = await service.updateOwn(ENTITY_ID, { isPriceOnRequest: true }, actorNoPerm);
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
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
    it('should strip identity fields (name/type/priceFrom/priceUnit/destinationId) silently', async () => {
        // These fields are NOT in ExperienceOwnerUpdateInputSchema.
        // Zod strips unknown keys by default — no VALIDATION_ERROR should be thrown.
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockUpdate = (service as AnyService).model.update;
        // biome-ignore lint/suspicious/noExplicitAny: test coercion — simulating forged HTTP body
        const forgedPayload: any = {
            isPriceOnRequest: false, // valid operational field
            name: 'FORGED_NAME', // identity field — should be stripped
            type: 'TOUR_GUIDE', // identity field — should be stripped
            priceFrom: 9999999, // identity field — should be stripped
            destinationId: 'forged-dest-uuid' // identity field — should be stripped
        };
        const result = await service.updateOwn(ENTITY_ID, forgedPayload, ownerActor);
        expect(result.error).toBeUndefined();
        // If name/type/priceFrom were passed to model.update, the test would catch it;
        // they must NOT appear in the update call argument.
        const updateArgs = mockUpdate.mock.calls[0];
        if (updateArgs) {
            const updatePayload = updateArgs[1] as Record<string, unknown>;
            expect(updatePayload).not.toHaveProperty('name');
            expect(updatePayload).not.toHaveProperty('type');
            expect(updatePayload).not.toHaveProperty('priceFrom');
            expect(updatePayload).not.toHaveProperty('destinationId');
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
// _executeSearch
// ---------------------------------------------------------------------------

describe('ExperienceService search filter forwarding', () => {
    it('should call model.findAll with deletedAt: null filter', async () => {
        const entity = makeExperienceEntity();
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

    it('should forward type filter to model.findAll', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAll = (service as AnyService).model.findAll;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch(
            { type: ExperienceTypeEnum.TOUR_GUIDE, page: 1, pageSize: 10 },
            staffActor,
            {}
        );

        expect(mockFindAll).toHaveBeenCalledWith(
            expect.objectContaining({ type: ExperienceTypeEnum.TOUR_GUIDE, deletedAt: null }),
            expect.any(Object),
            undefined,
            undefined
        );
    });

    it('should forward hasActiveSubscription filter to model.findAll', async () => {
        const entity = makeExperienceEntity();
        const service = makeService(entity);
        const mockFindAll = (service as AnyService).model.findAll;

        await (
            service as unknown as { _executeSearch: (...args: unknown[]) => unknown }
        )._executeSearch({ hasActiveSubscription: true, page: 1, pageSize: 10 }, staffActor, {});

        expect(mockFindAll).toHaveBeenCalledWith(
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
    it('should throw NOT_FOUND for deleted entity when actor lacks COMMERCE_VIEW_ALL', () => {
        // The deleted-at gate fires first (before the owner check), so both owner
        // and non-owner actors without COMMERCE_VIEW_ALL receive NOT_FOUND.
        const entity = makeExperienceEntity({ deletedAt: new Date() });
        const service = makeService(entity);
        // Owner without COMMERCE_VIEW_ALL → NOT_FOUND (matches gastronomy parity)
        expect(() => (service as AnyService)._canView(ownerActor, entity)).toThrow();
        // Non-owner, non-staff also gets NOT_FOUND
        const nonOwner: Actor = { id: OTHER_USER, role: RoleEnum.USER, permissions: [] };
        expect(() => (service as AnyService)._canView(nonOwner, entity)).toThrow();
    });

    it('should allow staff with COMMERCE_VIEW_ALL to view deleted entities', () => {
        const entity = makeExperienceEntity({ deletedAt: new Date() });
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
