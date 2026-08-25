/**
 * base-commerce-listing.junction-transaction.test.ts
 *
 * Regression suite for HOS-808 — ticking ANY service or feature checkbox in the
 * commerce owner editor answered 500 in BOTH verticals:
 *
 * ```
 * PATCH /api/v1/protected/gastronomies/{id} → 500
 * PATCH /api/v1/protected/experiences/{id}  → 500
 * ServiceError: Junction sync requires an active transaction;
 *               wrap update() in withServiceTransaction
 * ```
 *
 * `_afterUpdate` / `_afterCreate` hard-refuse to sync the junction tables
 * without `ctx.tx`, and nothing on the owner path (`updateOwn` → `update`) ever
 * opened a boundary. `r_experience_amenity`, `r_experience_feature` and their
 * gastronomy counterparts were consequently at ZERO rows: no listing could ever
 * record a service.
 *
 * These tests pin the four properties that fix has to hold:
 *
 *  1. A payload carrying `amenityIds` / `featureIds` opens a transaction, and
 *     the junction sync runs INSIDE it (asserted on the `tx` argument the
 *     junction model receives, not merely on the absence of an error).
 *  2. A payload without them opens NO transaction — the boundary is not a new
 *     per-write cost for every editor save.
 *  3. A caller-supplied `tx` is joined, never re-wrapped: `withServiceTransaction`
 *     always opens a NEW boundary, so re-entering would split one unit of work.
 *  4. A refusal raised inside the boundary comes back as a `ServiceOutput`
 *     ENVELOPE, not a rejected promise. `runWithLoggingAndValidation` re-throws
 *     whenever `ctx.tx` is set, and `updateOwn`'s `return this.update(…)` inside
 *     a `try` does NOT catch a rejection — so without the conversion a 400-class
 *     refusal (unknown amenity ID) would surface as an unhandled 500.
 *
 * `withServiceTransaction` is replaced with a faithful stand-in that injects a
 * sentinel `tx` into the context, exactly as the real one does. The real
 * implementation is a thin wrapper over `@repo/db`'s `withTransaction` and is
 * covered by its own suite; what is under test here is the WIRING — whether the
 * service opens a boundary at all, and whether the sync sees it.
 */

import { DestinationTypeEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
    CommerceCatalogModel,
    CommerceJunctionModel,
    CommerceListingEntity
} from '../../../src/services/commerce/base-commerce-listing.service';
import { BaseCommerceListingService } from '../../../src/services/commerce/base-commerce-listing.service';
import type { Actor, PaginatedListOutput, ServiceConfig, ServiceContext } from '../../../src/types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted above the imports of the code under test)
// ---------------------------------------------------------------------------

/** Sentinel standing in for the Drizzle transaction client opened by the service. */
const FAKE_TX = { __tx: 'commerce-junction-boundary' } as const;

/** Sentinel standing in for a transaction the CALLER already owns. */
const CALLER_TX = { __tx: 'caller-owned' } as const;

const { mockWithServiceTransaction, mockScheduleRevalidation } = vi.hoisted(() => ({
    mockWithServiceTransaction: vi.fn(),
    mockScheduleRevalidation: vi.fn()
}));

vi.mock('../../../src/utils/transaction', () => ({
    withServiceTransaction: mockWithServiceTransaction
}));

vi.mock('../../../src/services/commerce/commerce-revalidation.js', () => ({
    scheduleCommerceListingRevalidation: mockScheduleRevalidation
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const DEST_ID_CITY = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000004';

const AMENITY_A = 'amenity-1';
const AMENITY_UNKNOWN = 'amenity-does-not-exist';
const FEATURE_A = 'feature-1';

type TestEntity = CommerceListingEntity & { readonly type: string };

const ENTITY: TestEntity = {
    id: ENTITY_ID,
    name: 'Test Listing',
    slug: 'test-listing',
    type: 'RESTAURANT',
    ownerId: OWNER_ID,
    destinationId: DEST_ID_CITY,
    lifecycleState: 'ACTIVE'
} as TestEntity;

const createSchema = z.object({
    name: z.string(),
    slug: z.string().optional(),
    type: z.string(),
    destinationId: z.string().optional(),
    ownerId: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional()
});

const updateSchema = z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional()
});

const searchSchema = z.object({ q: z.string().optional() });

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeModel() {
    return {
        entityName: 'test_commerce',
        findById: vi.fn().mockResolvedValue(ENTITY),
        findByIds: vi.fn().mockResolvedValue([ENTITY]),
        findOne: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi
            .fn()
            .mockImplementation(async (data: Partial<TestEntity>) => ({ ...ENTITY, ...data })),
        update: vi.fn().mockImplementation(async (_where: unknown, data: Partial<TestEntity>) => ({
            ...ENTITY,
            ...data
        })),
        updateById: vi.fn().mockResolvedValue(ENTITY),
        softDelete: vi.fn().mockResolvedValue(undefined),
        hardDelete: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined),
        findWithRelations: vi.fn().mockResolvedValue(ENTITY),
        findOneWithRelations: vi.fn().mockResolvedValue(ENTITY),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

/** Catalog stub: echoes back only the IDs declared to exist (HOS-321 batch shape). */
function makeCatalogModel(existing: readonly string[]) {
    return {
        findByIds: vi
            .fn()
            .mockImplementation((ids: readonly string[]) =>
                Promise.resolve(ids.filter((id) => existing.includes(id)).map((id) => ({ id })))
            )
    };
}

function makeJunctionModel() {
    return {
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        hardDelete: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({})
    };
}

function makeDestinationModel() {
    return {
        findById: vi
            .fn()
            .mockResolvedValue({ id: DEST_ID_CITY, destinationType: DestinationTypeEnum.CITY })
    };
}

// ---------------------------------------------------------------------------
// Concrete test subclass
// ---------------------------------------------------------------------------

class TestCommerceService extends BaseCommerceListingService<
    TestEntity,
    ReturnType<typeof makeModel>,
    typeof createSchema,
    typeof updateSchema,
    typeof searchSchema
> {
    public set destModel(m: typeof this._destinationModel) {
        this._destinationModel = m;
    }

    protected readonly createSchema = createSchema;
    protected readonly updateSchema = updateSchema;
    protected readonly searchSchema = searchSchema;

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

const makeActor = (): Actor => ({
    id: OWNER_ID,
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.COMMERCE_EDIT_ALL]
});

function makeService() {
    const model = makeModel();
    const amenityModel = makeCatalogModel([AMENITY_A]);
    const featureModel = makeCatalogModel([FEATURE_A]);
    const amenityJunction = makeJunctionModel();
    const featureJunction = makeJunctionModel();

    const svc = new TestCommerceService(
        {} as ServiceConfig,
        model,
        amenityModel,
        featureModel,
        amenityJunction,
        featureJunction
    );
    svc.destModel = makeDestinationModel() as unknown as typeof svc.destModel;

    return { svc, model, amenityModel, featureModel, amenityJunction, featureJunction };
}

// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
    mockScheduleRevalidation.mockResolvedValue(undefined);
    // Faithful stand-in for the real `withServiceTransaction`: merges the base
    // context, injects a tx client, guarantees a hookState.
    mockWithServiceTransaction.mockImplementation(
        async (fn: (ctx: ServiceContext) => Promise<unknown>, baseCtx?: Partial<ServiceContext>) =>
            fn({
                ...baseCtx,
                tx: FAKE_TX,
                hookState: baseCtx?.hookState ?? {}
            } as unknown as ServiceContext)
    );
});

// ---------------------------------------------------------------------------
// update() — the reported bug
// ---------------------------------------------------------------------------

describe('BaseCommerceListingService.update — junction transaction boundary (HOS-808)', () => {
    it('succeeds when amenityIds are supplied and no caller transaction exists', async () => {
        const { svc, amenityJunction } = makeService();

        const result = await svc.update(makeActor(), ENTITY_ID, { amenityIds: [AMENITY_A] });

        // The bug surfaced exactly here: INTERNAL_ERROR instead of the entity.
        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(ENTITY_ID);
        expect(mockWithServiceTransaction).toHaveBeenCalledTimes(1);
        // The row must have been written INSIDE the boundary, not merely without
        // an error: the junction model receives the tx client as its 2nd argument.
        expect(amenityJunction.create).toHaveBeenCalledTimes(1);
        expect(amenityJunction.create.mock.calls[0]?.[0]).toEqual({
            testCommerceId: ENTITY_ID,
            amenityId: AMENITY_A
        });
        expect(amenityJunction.create.mock.calls[0]?.[1]).toBe(FAKE_TX);
    });

    it('succeeds when featureIds are supplied and no caller transaction exists', async () => {
        const { svc, featureJunction } = makeService();

        const result = await svc.update(makeActor(), ENTITY_ID, { featureIds: [FEATURE_A] });

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).toHaveBeenCalledTimes(1);
        expect(featureJunction.create).toHaveBeenCalledTimes(1);
        expect(featureJunction.create.mock.calls[0]?.[0]).toEqual({
            testCommerceId: ENTITY_ID,
            featureId: FEATURE_A
        });
        expect(featureJunction.create.mock.calls[0]?.[1]).toBe(FAKE_TX);
    });

    it('treats an empty amenityIds array as a junction write and opens a boundary', async () => {
        // `[]` means "clear all" in the three-way contract — it reaches the sync
        // and therefore needs the transaction just as much as a non-empty list.
        const { svc } = makeService();

        const result = await svc.update(makeActor(), ENTITY_ID, { amenityIds: [] });

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).toHaveBeenCalledTimes(1);
    });

    it('opens NO transaction when the payload carries no junction ids', async () => {
        const { svc, amenityJunction, featureJunction } = makeService();

        const result = await svc.update(makeActor(), ENTITY_ID, { name: 'Renamed' });

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
        expect(amenityJunction.create).not.toHaveBeenCalled();
        expect(featureJunction.create).not.toHaveBeenCalled();
    });

    it("joins the caller's transaction instead of opening a second boundary", async () => {
        const { svc, amenityJunction } = makeService();

        const result = await svc.update(makeActor(), ENTITY_ID, { amenityIds: [AMENITY_A] }, {
            tx: CALLER_TX
        } as unknown as ServiceContext);

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
        expect(amenityJunction.create.mock.calls[0]?.[1]).toBe(CALLER_TX);
    });

    it('returns an error ENVELOPE (never a rejection) when the sync refuses inside the boundary', async () => {
        const { svc, amenityJunction } = makeService();

        // An unknown catalog id makes `validateCatalogIds` throw inside the
        // transaction, where `runWithLoggingAndValidation` re-throws rather than
        // returning. The boundary owner has to convert it back.
        const result = await svc.update(makeActor(), ENTITY_ID, {
            amenityIds: [AMENITY_UNKNOWN]
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(amenityJunction.create).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// create() — the same hole on the admin create path
// ---------------------------------------------------------------------------

describe('BaseCommerceListingService.create — junction transaction boundary (HOS-808)', () => {
    it('succeeds when amenityIds are supplied and no caller transaction exists', async () => {
        const { svc, amenityJunction } = makeService();

        const result = await svc.create(makeActor(), {
            name: 'New Listing',
            type: 'RESTAURANT',
            destinationId: DEST_ID_CITY,
            amenityIds: [AMENITY_A]
        });

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).toHaveBeenCalledTimes(1);
        expect(amenityJunction.create).toHaveBeenCalledTimes(1);
        expect(amenityJunction.create.mock.calls[0]?.[1]).toBe(FAKE_TX);
    });

    it('opens NO transaction when the payload carries no junction ids', async () => {
        const { svc } = makeService();

        const result = await svc.create(makeActor(), {
            name: 'New Listing',
            type: 'RESTAURANT',
            destinationId: DEST_ID_CITY
        });

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
    });

    it("joins the caller's transaction instead of opening a second boundary", async () => {
        // This is the `createForOwner` path: it already owns a transaction that
        // also carries the COMMERCE_OWNER role grant, and re-wrapping would split
        // that unit of work in two (withServiceTransaction never nests).
        const { svc, amenityJunction } = makeService();

        const result = await svc.create(
            makeActor(),
            {
                name: 'New Listing',
                type: 'RESTAURANT',
                destinationId: DEST_ID_CITY,
                amenityIds: [AMENITY_A]
            },
            { tx: CALLER_TX } as unknown as ServiceContext
        );

        expect(result.error).toBeUndefined();
        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
        expect(amenityJunction.create.mock.calls[0]?.[1]).toBe(CALLER_TX);
    });
});
