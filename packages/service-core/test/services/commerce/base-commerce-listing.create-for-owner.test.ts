/**
 * base-commerce-listing.create-for-owner.test.ts
 *
 * Unit tests for `BaseCommerceListingService.createForOwner` — the owner
 * self-service create that grants `COMMERCE_OWNER` in the same transaction as
 * the listing insert (HOS-687 / HOS-589 §6.1).
 *
 * Covers:
 *  - AC-1 — a signed-in account with no commerce role gets the hat, no admin
 *    action anywhere in the path.
 *  - AC-2 — the second listing neither errors nor duplicates the grant.
 *  - AC-3 — the grant is additive: an account already holding `HOST` keeps it,
 *    and nothing in this path ever revokes.
 *  - Atomicity — the insert, the junction sync and the grant share ONE
 *    transaction, and a failing grant aborts the whole unit of work rather
 *    than committing a listing whose owner cannot manage it.
 *
 * `grantRole` and `withServiceTransaction` are mocked: the point here is the
 * WIRING (which ctx, which role, which reason, in which order), and the
 * primitives themselves are covered by their own suites.
 */

import { DestinationTypeEnum, RoleEnum, RoleGrantReason, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type {
    CommerceCatalogModel,
    CommerceJunctionModel,
    CommerceListingEntity
} from '../../../src/services/commerce/base-commerce-listing.service';
import { BaseCommerceListingService } from '../../../src/services/commerce/base-commerce-listing.service';
import type {
    Actor,
    PaginatedListOutput,
    ServiceConfig,
    ServiceContext,
    ServiceOutput
} from '../../../src/types';
import { ServiceError } from '../../../src/types';

// ---------------------------------------------------------------------------
// Module mocks (hoisted above the imports of the code under test)
// ---------------------------------------------------------------------------

/** Sentinel standing in for the Drizzle transaction client. */
const FAKE_TX = { __tx: 'commerce-create-for-owner' } as const;

const { mockGrantRole, mockRevokeRole, mockWithServiceTransaction, mockScheduleRevalidation } =
    vi.hoisted(() => ({
        mockGrantRole: vi.fn(),
        mockRevokeRole: vi.fn(),
        mockWithServiceTransaction: vi.fn(),
        mockScheduleRevalidation: vi.fn()
    }));

vi.mock('../../../src/services/user-role/user-role.service', () => ({
    grantRole: mockGrantRole,
    revokeRole: mockRevokeRole
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

type TestEntity = CommerceListingEntity & { readonly type: string };

const createSchema = z.object({
    name: z.string(),
    slug: z.string().optional(),
    type: z.string(),
    destinationId: z.string().optional(),
    ownerId: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional()
});
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
        create: vi.fn().mockImplementation(async (data: Partial<TestEntity>) => ({
            id: ENTITY_ID,
            name: 'Test Listing',
            slug: 'test-listing',
            type: 'RESTAURANT',
            ...data
        })),
        update: vi.fn(),
        updateById: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        findWithRelations: vi.fn().mockResolvedValue(null),
        findOneWithRelations: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

function makeCatalogModel(existingIds: string[]): CommerceCatalogModel {
    return {
        findByIds: vi
            .fn()
            .mockImplementation((ids: readonly string[]) =>
                Promise.resolve(ids.filter((id) => existingIds.includes(id)).map((id) => ({ id })))
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
    const amenityJunction = makeJunctionModel();
    const featureJunction = makeJunctionModel();
    const svc = new TestCommerceService(
        {} as ServiceConfig,
        model,
        makeCatalogModel(['amenity-1']),
        makeCatalogModel(['feature-1']),
        amenityJunction,
        featureJunction
    );
    svc.destModel = {
        findById: vi
            .fn()
            .mockResolvedValue({ id: DEST_ID_CITY, destinationType: DestinationTypeEnum.CITY })
    } as unknown as typeof svc.destModel;
    return { svc, model, amenityJunction, featureJunction };
}

/** The account this spec exists for: signed in, zero commerce anything. */
const plainUserActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER],
    permissions: []
};

/** AC-3: an account that already wears the HOST hat. */
const hostActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER, RoleEnum.HOST],
    permissions: []
};

const VALID_INPUT = {
    name: 'La Parrilla del Puerto',
    type: 'RESTAURANT',
    destinationId: DEST_ID_CITY,
    ownerId: OWNER_ID
};

beforeEach(() => {
    vi.clearAllMocks();
    mockGrantRole.mockResolvedValue({ data: { changed: true } });
    mockScheduleRevalidation.mockResolvedValue(undefined);
    // Stand in for the real boundary: hand the callback a ctx carrying the
    // sentinel tx, so "did the grant run in the same transaction as the
    // insert?" becomes an assertable identity rather than a hope.
    mockWithServiceTransaction.mockImplementation(
        async (fn: (ctx: ServiceContext) => Promise<unknown>) =>
            fn({ tx: FAKE_TX, hookState: {} } as unknown as ServiceContext)
    );
});

describe('BaseCommerceListingService.createForOwner (HOS-687 §6.1)', () => {
    it('grants COMMERCE_OWNER to the creating account (AC-1)', async () => {
        const { svc } = makeService();

        const result = (await svc.createForOwner(
            plainUserActor,
            VALID_INPUT
        )) as ServiceOutput<TestEntity>;

        expect(result.error).toBeUndefined();
        expect(result.data?.id).toBe(ENTITY_ID);
        expect(mockGrantRole).toHaveBeenCalledTimes(1);

        const grantArgs = mockGrantRole.mock.calls[0]?.[0];
        expect(grantArgs).toMatchObject({
            userId: OWNER_ID,
            role: RoleEnum.COMMERCE_OWNER,
            grantedBy: null,
            reason: RoleGrantReason.COMMERCE_LISTING_CREATED
        });
    });

    it('never grants any role other than COMMERCE_OWNER, and never revokes (AC-3)', async () => {
        const { svc } = makeService();

        await svc.createForOwner(hostActor, VALID_INPUT);

        expect(mockRevokeRole).not.toHaveBeenCalled();
        const grantedRoles = mockGrantRole.mock.calls.map((call) => call[0]?.role);
        expect(grantedRoles).toEqual([RoleEnum.COMMERCE_OWNER]);
        // The grant is additive by construction — the call carries only the one
        // role and no role list that could replace what the account already
        // wears. A payload naming HOST here would mean the path rewrites hats.
        expect(mockGrantRole.mock.calls[0]?.[0]).not.toHaveProperty('roles');
    });

    it('runs the insert and the grant inside ONE transaction', async () => {
        const { svc, model } = makeService();

        await svc.createForOwner(plainUserActor, VALID_INPUT);

        expect(mockWithServiceTransaction).toHaveBeenCalledTimes(1);
        // The model insert received the transaction client...
        expect(model.create).toHaveBeenCalledWith(expect.any(Object), FAKE_TX);
        // ...and so did the role grant. Same tx, one unit of work.
        expect(mockGrantRole.mock.calls[0]?.[0]?.ctx?.tx).toBe(FAKE_TX);
    });

    it('syncs the amenity junction in that same transaction', async () => {
        const { svc, amenityJunction } = makeService();

        await svc.createForOwner(plainUserActor, { ...VALID_INPUT, amenityIds: ['amenity-1'] });

        expect(amenityJunction.create).toHaveBeenCalled();
        expect(mockGrantRole).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate the grant on a second listing, and does not error (AC-2)', async () => {
        const { svc } = makeService();

        await svc.createForOwner(plainUserActor, VALID_INPUT);
        // grantRole is idempotent on the (user_id, role) primary key: the
        // second listing reports `changed: false` rather than failing.
        mockGrantRole.mockResolvedValue({ data: { changed: false } });
        const second = (await svc.createForOwner(plainUserActor, {
            ...VALID_INPUT,
            name: 'Second listing'
        })) as ServiceOutput<TestEntity>;

        expect(second.error).toBeUndefined();
        expect(second.data?.id).toBe(ENTITY_ID);
        // Once per listing — the call itself is the idempotent primitive, so
        // "not duplicated" means no extra ROW, not a skipped call.
        expect(mockGrantRole).toHaveBeenCalledTimes(2);
        expect(mockGrantRole.mock.calls[1]?.[0]?.role).toBe(RoleEnum.COMMERCE_OWNER);
    });

    it('aborts the whole unit of work when the grant fails', async () => {
        const { svc } = makeService();
        mockGrantRole.mockResolvedValue({
            error: new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'grant exploded')
        });

        const result = (await svc.createForOwner(
            plainUserActor,
            VALID_INPUT
        )) as ServiceOutput<TestEntity>;

        expect(result.data).toBeUndefined();
        expect(result.error).toBeInstanceOf(ServiceError);
        expect(result.error?.message).toContain('grant exploded');
    });

    it('does not grant when the listing insert itself fails', async () => {
        const { svc, model } = makeService();
        model.create.mockResolvedValue(null);

        const result = (await svc.createForOwner(
            plainUserActor,
            VALID_INPUT
        )) as ServiceOutput<TestEntity>;

        expect(result.error).toBeDefined();
        expect(mockGrantRole).not.toHaveBeenCalled();
    });

    it('enlists in a caller-owned transaction instead of opening a second one', async () => {
        const { svc } = makeService();
        const callerCtx = { tx: FAKE_TX, hookState: {} } as unknown as ServiceContext;

        await svc.createForOwner(plainUserActor, VALID_INPUT, callerCtx);

        expect(mockWithServiceTransaction).not.toHaveBeenCalled();
        expect(mockGrantRole.mock.calls[0]?.[0]?.ctx).toBe(callerCtx);
    });
});
