/**
 * base-listing.reserved-slug.test.ts
 *
 * HOS-1862 (AC:6:6): a listing slug must never collide with a static sibling
 * segment of its public folder. These tests cover the two write paths of
 * `BaseListingService`:
 *
 *  - a generated slug (create) treats a reserved candidate as taken, so
 *    `Rubro` becomes `rubro-2` instead of stealing `/comer-y-salir/rubro/`;
 *  - an explicit slug (create and update) is rejected with a 400 before the
 *    destination lookup runs.
 *
 * The harness mirrors the minimal stub in `base-listing.service.test.ts`.
 */

import {
    DestinationTypeEnum,
    type PermissionEnum,
    RoleEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { describe, expect, it, type Mock, vi } from 'vitest';
import { z } from 'zod';
import type {
    ListingCatalogModel,
    ListingEntity,
    ListingJunctionModel
} from '../../../src/services/listing/base-listing.service';
import { BaseListingService } from '../../../src/services/listing/base-listing.service';
import type {
    Actor,
    AdminSearchExecuteParams,
    PaginatedListOutput,
    ServiceConfig
} from '../../../src/types';

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const DEST_ID_CITY = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000004';

type TestEntity = ListingEntity & {
    readonly type: string;
};

function makeModel(entity: TestEntity | null = null) {
    return {
        entityName: 'venue',
        findById: vi.fn().mockResolvedValue(entity),
        findByIds: vi.fn().mockResolvedValue(entity ? [entity] : []),
        findOne: vi.fn().mockResolvedValue(entity),
        findAll: vi.fn().mockResolvedValue({ items: entity ? [entity] : [], total: 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn(),
        update: vi.fn(),
        updateById: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        findWithRelations: vi.fn().mockResolvedValue(entity),
        findOneWithRelations: vi.fn().mockResolvedValue(entity),
        count: vi.fn().mockResolvedValue(0),
        getTable: vi.fn(),
        raw: vi.fn()
    };
}

function makeCatalogModel() {
    return { findByIds: vi.fn().mockResolvedValue([]) };
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
        findById: vi.fn().mockResolvedValue({
            id: DEST_ID_CITY,
            destinationType: DestinationTypeEnum.CITY
        })
    };
}

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
    type: z.string().optional(),
    destinationId: z.string().optional(),
    amenityIds: z.array(z.string()).optional(),
    featureIds: z.array(z.string()).optional(),
    refreshSlugFromName: z.boolean().optional()
});

const searchSchema = z.object({ q: z.string().optional() });

class TestListingService extends BaseListingService<
    TestEntity,
    ReturnType<typeof makeModel>,
    typeof createSchema,
    typeof updateSchema,
    typeof searchSchema
> {
    public get destModel() {
        return this._destinationModel;
    }
    public set destModel(m: typeof this._destinationModel) {
        this._destinationModel = m;
    }

    protected readonly createSchema = createSchema;
    protected readonly updateSchema = updateSchema;
    protected readonly searchSchema = searchSchema;

    constructor(
        config: ServiceConfig,
        private readonly entityNameValue: 'venue' | 'experience',
        private readonly _model_instance: ReturnType<typeof makeModel>,
        private readonly _amenityModel_instance: ListingCatalogModel,
        private readonly _featureModel_instance: ListingCatalogModel,
        private readonly _amenityJunction_instance: ListingJunctionModel<Record<string, unknown>>,
        private readonly _featureJunction_instance: ListingJunctionModel<Record<string, unknown>>
    ) {
        super(config, entityNameValue);
    }

    protected get model() {
        return this._model_instance;
    }
    protected get _entityFkColumn() {
        return 'testListingId';
    }
    protected get _revalidationEntityType(): 'venue' | 'experience' {
        return this.entityNameValue;
    }
    protected get _amenityModel(): ListingCatalogModel {
        return this._amenityModel_instance;
    }
    protected get _featureModel(): ListingCatalogModel {
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

    public override async _executeAdminSearch(
        params: AdminSearchExecuteParams<Record<string, unknown>>
    ): Promise<PaginatedListOutput<TestEntity>> {
        return super._executeAdminSearch(params);
    }

    public async testBeforeCreate(
        data: z.infer<typeof createSchema>,
        actor: Actor,
        ctx: { hookState: Record<string, unknown>; tx?: unknown }
    ) {
        return this._beforeCreate(data, actor, ctx as Parameters<typeof this._beforeCreate>[2]);
    }

    public async testBeforeUpdate(
        data: z.infer<typeof updateSchema>,
        actor: Actor,
        ctx: { hookState: Record<string, unknown>; tx?: unknown }
    ) {
        return this._beforeUpdate(data, actor, ctx as Parameters<typeof this._beforeUpdate>[2]);
    }
}

function makeActor(permissions: PermissionEnum[] = [], id = OWNER_ID): Actor {
    return { id, roles: [RoleEnum.ADMIN], permissions };
}

function makeService(
    entityName: 'venue' | 'experience' = 'venue',
    entity: TestEntity | null = null
) {
    const model = makeModel(entity);
    const svc = new TestListingService(
        {} as ServiceConfig,
        entityName,
        model,
        makeCatalogModel(),
        makeCatalogModel(),
        makeJunctionModel(),
        makeJunctionModel()
    );
    svc.destModel = makeDestinationModel() as unknown as typeof svc.destModel;
    return { svc, model };
}

describe('BaseListingService — reserved listing slugs', () => {
    describe('generated slug (_beforeCreate)', () => {
        it('suffixes a venue named "Rubro" instead of stealing the rubro collection', async () => {
            const { svc } = makeService('venue');
            const patch = await svc.testBeforeCreate(
                { name: 'Rubro', type: 'RESTAURANT' },
                makeActor(),
                { hookState: {} }
            );

            expect(patch.slug).toBe('rubro-2');
        });

        it('suffixes an experience named "Page" instead of stealing pagination', async () => {
            const { svc } = makeService('experience');
            const patch = await svc.testBeforeCreate({ name: 'Page', type: 'TOUR' }, makeActor(), {
                hookState: {}
            });

            expect(patch.slug).toBe('page-2');
        });

        it('keeps generating a plain slug for a non-reserved name (control)', async () => {
            const { svc } = makeService('venue');
            const patch = await svc.testBeforeCreate({ name: 'Mi Bar', type: 'BAR' }, makeActor(), {
                hookState: {}
            });

            expect(patch.slug).toBe('mi-bar');
        });
    });

    describe('explicit slug', () => {
        it('rejects a reserved venue slug on create before validating the destination', async () => {
            const { svc } = makeService('venue');
            const findById = svc.destModel.findById as Mock;

            await expect(
                svc.testBeforeCreate(
                    {
                        name: 'Mi Bar',
                        slug: 'rubro',
                        type: 'BAR',
                        destinationId: DEST_ID_CITY
                    },
                    makeActor(),
                    { hookState: {} }
                )
            ).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                details: { field: 'slug', reason: 'RESERVED' }
            });
            expect(findById).not.toHaveBeenCalled();
        });

        it('rejects a reserved venue slug on update before validating the destination', async () => {
            const { svc } = makeService('venue');
            const findById = svc.destModel.findById as Mock;

            await expect(
                svc.testBeforeUpdate({ slug: 'page', destinationId: DEST_ID_CITY }, makeActor(), {
                    hookState: {}
                })
            ).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                details: { field: 'slug', reason: 'RESERVED' }
            });
            expect(findById).not.toHaveBeenCalled();
        });
    });

    describe('rename regeneration (_beforeUpdate)', () => {
        it('suffixes a reserved slug when a draft is renamed to "Rubro"', async () => {
            const current = {
                id: ENTITY_ID,
                name: 'Mi Bar',
                slug: 'mi-bar',
                type: 'BAR',
                publicationStatus: 'DRAFT'
            } as TestEntity;
            const { svc, model } = makeService('venue', current);
            const ctx = { hookState: { updateId: ENTITY_ID } as Record<string, unknown> };
            (model.findOne as Mock).mockResolvedValue(null);

            await svc.testBeforeUpdate({ name: 'Rubro' }, makeActor(), ctx);

            expect(ctx.hookState.regeneratedSlug).toBe('rubro-2');
        });
    });
});
