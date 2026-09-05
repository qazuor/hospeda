/**
 * base-commerce-listing.soft-delete-own-draft.test.ts
 *
 * Unit tests for `BaseCommerceListingService.softDeleteOwnDraft` — the owner-tier
 * delete the publish precheck panel's "borrar el borrador" needs (HOS-1156 T-015,
 * AC-14).
 *
 * The method exists because the ordinary `softDelete()` is staff-only
 * (`_canSoftDelete` → `COMMERCE_DELETE`), so on a commerce publish page the
 * matrix's only FREE branch could otherwise answer nothing but 403. Every test
 * below is about a narrowing, not about the happy path:
 *
 *  - ownership is the gate, and someone else's row answers NOT_FOUND — never
 *    FORBIDDEN, which would confirm the id exists;
 *  - a listing that is not DRAFT is refused, because a published or paid-for
 *    listing is not a draft to discard;
 *  - the delete is a SOFT delete, stamped with the actor as its author.
 *
 * The model is a spy: this suite asserts the DECISION and the call it makes, and
 * the soft-delete primitive itself is covered by `@repo/db`'s own suite.
 */

import {
    DestinationTypeEnum,
    LifecycleStatusEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
    CommerceCatalogModel,
    CommerceJunctionModel,
    CommerceListingEntity
} from '../../../src/services/commerce/base-commerce-listing.service';
import { BaseCommerceListingService } from '../../../src/services/commerce/base-commerce-listing.service';
import type { Actor, PaginatedListOutput, ServiceConfig } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const DEST_ID_CITY = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000004';
const STRANGER_ID = '00000000-0000-4000-a000-000000000005';

type TestEntity = CommerceListingEntity & { readonly type: string };

const createSchema = z.object({ name: z.string(), type: z.string() });
const updateSchema = z.object({ name: z.string().optional() });
const searchSchema = z.object({ q: z.string().optional() });

function makeModel() {
    return {
        entityName: 'test_commerce',
        findById: vi.fn().mockResolvedValue(null),
        findByIds: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn(),
        update: vi.fn(),
        updateById: vi.fn(),
        softDelete: vi.fn().mockResolvedValue(1),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        findWithRelations: vi.fn().mockResolvedValue(null),
        findOneWithRelations: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

function makeCatalogModel(): CommerceCatalogModel {
    return { findByIds: vi.fn().mockResolvedValue([]) };
}

function makeJunctionModel() {
    return {
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

class TestCommerceService extends BaseCommerceListingService<
    TestEntity,
    ReturnType<typeof makeModel>,
    typeof createSchema,
    typeof updateSchema,
    typeof searchSchema
> {
    protected readonly createSchema = createSchema;
    protected readonly updateSchema = updateSchema;
    protected readonly searchSchema = searchSchema;

    public set destModel(m: typeof this._destinationModel) {
        this._destinationModel = m;
    }

    constructor(
        config: ServiceConfig,
        private readonly _model_instance: ReturnType<typeof makeModel>,
        private readonly _amenityModel_instance: CommerceCatalogModel,
        private readonly _featureModel_instance: CommerceCatalogModel,
        private readonly _amenityJunction_instance: CommerceJunctionModel<Record<string, unknown>>,
        private readonly _featureJunction_instance: CommerceJunctionModel<Record<string, unknown>>
    ) {
        super(config, 'testCommerce');
    }

    protected get model() {
        return this._model_instance;
    }
    protected get _entityFkColumn() {
        return 'testCommerceId';
    }
    protected get _revalidationEntityType(): 'gastronomy' {
        return 'gastronomy';
    }
    protected get _amenityModel(): CommerceCatalogModel {
        return this._amenityModel_instance;
    }
    protected get _featureModel(): CommerceCatalogModel {
        return this._featureModel_instance;
    }
    protected get _amenityJunctionModel() {
        return this._amenityJunction_instance;
    }
    protected get _featureJunctionModel() {
        return this._featureJunction_instance;
    }

    protected getDefaultListRelations() {
        return {};
    }

    // The staff gate this method deliberately does NOT go through. Left as a
    // no-op so that a test which sees a delete happen cannot be explained by the
    // permission hook having waved it past — the only thing letting it through
    // is `softDeleteOwnDraft`'s own ownership check.
    protected _canCreate(): void {}
    protected _canUpdate(): void {}
    protected _canSoftDelete(): void {}
    protected _canHardDelete(): void {}
    protected _canRestore(): void {}
    protected _canView(): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}

    protected async _executeSearch(): Promise<PaginatedListOutput<TestEntity>> {
        return { items: [], total: 0 };
    }
    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

function makeService() {
    const model = makeModel();
    const svc = new TestCommerceService(
        {} as ServiceConfig,
        model,
        makeCatalogModel(),
        makeCatalogModel(),
        makeJunctionModel(),
        makeJunctionModel()
    );
    svc.destModel = {
        findById: vi
            .fn()
            .mockResolvedValue({ id: DEST_ID_CITY, destinationType: DestinationTypeEnum.CITY })
    } as unknown as typeof svc.destModel;
    return { svc, model };
}

/** The account this method exists for: the listing's owner, no commerce permission. */
const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER],
    permissions: []
};

/** A row as `findById` returns it. */
function row(overrides: Partial<TestEntity> = {}): TestEntity {
    return {
        id: ENTITY_ID,
        name: 'La Parrilla del Puerto',
        slug: 'la-parrilla-del-puerto',
        type: 'RESTAURANT',
        ownerId: OWNER_ID,
        lifecycleState: LifecycleStatusEnum.DRAFT,
        deletedAt: null,
        ...overrides
    } as TestEntity;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('BaseCommerceListingService.softDeleteOwnDraft (HOS-1156 AC-14)', () => {
    it('soft-deletes the owner’s own DRAFT, stamping them as its author', async () => {
        const { svc, model } = makeService();
        model.findById.mockResolvedValue(row());

        const result = await svc.softDeleteOwnDraft(ownerActor, ENTITY_ID);

        expect(result.error).toBeUndefined();
        expect(result.data).toEqual({ deleted: true });
        // Soft, scoped to the one id, and attributed — never a hard delete and
        // never an unscoped where clause.
        expect(model.softDelete).toHaveBeenCalledWith({ id: ENTITY_ID }, OWNER_ID, undefined);
        expect(model.hardDelete).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND — never FORBIDDEN — for a row owned by somebody else', async () => {
        const { svc, model } = makeService();
        model.findById.mockResolvedValue(row({ ownerId: STRANGER_ID }));

        const result = await svc.softDeleteOwnDraft(ownerActor, ENTITY_ID);

        // A 403 here would confirm the id exists, which is the whole point of
        // collapsing this case into NOT_FOUND (apps/api/docs/error-contract.md).
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(result.error?.code).not.toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a row that does not exist', async () => {
        const { svc, model } = makeService();
        model.findById.mockResolvedValue(null);

        const result = await svc.softDeleteOwnDraft(ownerActor, ENTITY_ID);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a row already soft-deleted', async () => {
        const { svc, model } = makeService();
        model.findById.mockResolvedValue(row({ deletedAt: new Date() }));

        const result = await svc.softDeleteOwnDraft(ownerActor, ENTITY_ID);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.softDelete).not.toHaveBeenCalled();
    });

    for (const state of [LifecycleStatusEnum.ACTIVE, LifecycleStatusEnum.ARCHIVED] as const) {
        it(`refuses a listing in ${state}: only a DRAFT is the owner's to discard`, async () => {
            const { svc, model } = makeService();
            model.findById.mockResolvedValue(row({ lifecycleState: state }));

            const result = await svc.softDeleteOwnDraft(ownerActor, ENTITY_ID);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(model.softDelete).not.toHaveBeenCalled();
        });
    }

    it('refuses an actor with no id rather than deleting an unowned row', async () => {
        const { svc, model } = makeService();
        model.findById.mockResolvedValue(row({ ownerId: null }));

        const result = await svc.softDeleteOwnDraft(
            { id: '', roles: [], permissions: [] },
            ENTITY_ID
        );

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.findById).not.toHaveBeenCalled();
        expect(model.softDelete).not.toHaveBeenCalled();
    });
});
