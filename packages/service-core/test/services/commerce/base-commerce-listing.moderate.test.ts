/**
 * base-commerce-listing.moderate.test.ts
 *
 * Unit tests for `BaseCommerceListingService.moderate()` (HOS-686).
 *
 * Covers HOS-589 AC-10 (an admin can reject a gastronomy and an experience
 * listing through one shared implementation; a non-admin cannot) and AC-36
 * (rejecting purges the edge cache).
 *
 * AC-36 is asserted against the revalidation SCHEDULER, not against the row.
 * The template this mirrors — `AccommodationService.moderate` — writes through
 * `this.model.update()` and never schedules a purge, so a faithful copy would
 * inherit the omission: the listing would be marked rejected, the reconciler
 * would flip it to PRIVATE, and Cloudflare would keep serving it. A test that
 * only checked `moderationState` in the database would pass with that bug fully
 * present.
 *
 * This file lives apart from `base-commerce-listing.service.test.ts` because it
 * mocks the revalidation module at module scope, which would change the
 * behaviour of every test in that suite.
 */

import {
    DestinationTypeEnum,
    ModerationStatusEnum,
    PermissionEnum,
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
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { Actor, PaginatedListOutput, ServiceConfig } from '../../../src/types';

// ---------------------------------------------------------------------------
// Revalidation scheduler double — the instrument AC-36 is measured with
// ---------------------------------------------------------------------------

const scheduleRevalidation = vi.fn();

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: () => ({ scheduleRevalidation })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTITY_ID = '00000000-0000-4000-a000-000000000001';
const DEST_ID = '00000000-0000-4000-a000-000000000002';
const ACTOR_ID = '00000000-0000-4000-a000-000000000004';
const DEST_SLUG = 'colon';

type TestEntity = CommerceListingEntity & { readonly type: string };

/** A listing as it stands when an admin decides to take it down: live and public. */
const publishedListing = (): TestEntity => ({
    id: ENTITY_ID,
    name: 'Bar del Puerto',
    slug: 'bar-del-puerto',
    type: 'BAR',
    destinationId: DEST_ID,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    moderationState: ModerationStatusEnum.APPROVED,
    deletedAt: null
});

// ---------------------------------------------------------------------------
// Model / catalog doubles
// ---------------------------------------------------------------------------

/**
 * `update` echoes the stored row merged with the patch, the way a real Drizzle
 * `.returning()` does. That matters: `_scheduleListingRevalidation` reads
 * `slug`, `destinationId`, `visibility` and `lifecycleState` off the row the
 * write returned, so a stub returning only the patched keys would make the
 * purge silently no-op and this suite would prove nothing.
 */
function makeModel(entity: TestEntity | null) {
    return {
        entityName: 'test_commerce',
        findById: vi.fn().mockResolvedValue(entity),
        findByIds: vi.fn().mockResolvedValue(entity ? [entity] : []),
        findOne: vi.fn().mockResolvedValue(entity),
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        create: vi.fn(),
        update: vi.fn().mockImplementation(async (_where: unknown, data: Partial<TestEntity>) => ({
            ...(entity ?? {}),
            ...data
        })),
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

const emptyCatalog: CommerceCatalogModel = { findByIds: vi.fn().mockResolvedValue([]) };
const emptyJunction: CommerceJunctionModel<Record<string, unknown>> = {
    findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    hardDelete: vi.fn(),
    create: vi.fn()
};

// ---------------------------------------------------------------------------
// Concrete test subclass
// ---------------------------------------------------------------------------

const createSchema = z.object({ name: z.string(), type: z.string() });
const updateSchema = z.object({ name: z.string().optional() });
const searchSchema = z.object({ q: z.string().optional() });

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

    constructor(
        config: ServiceConfig,
        private readonly _modelInstance: ReturnType<typeof makeModel>
    ) {
        super(config, 'testCommerce');
    }

    public set destModel(m: typeof this._destinationModel) {
        this._destinationModel = m;
    }

    protected get model() {
        return this._modelInstance;
    }
    protected get _entityFkColumn() {
        return 'testCommerceId';
    }
    protected get _revalidationEntityType(): 'gastronomy' {
        return 'gastronomy';
    }
    protected get _amenityModel(): CommerceCatalogModel {
        return emptyCatalog;
    }
    protected get _featureModel(): CommerceCatalogModel {
        return emptyCatalog;
    }
    protected get _amenityJunctionModel() {
        return emptyJunction;
    }
    protected get _featureJunctionModel() {
        return emptyJunction;
    }

    protected getDefaultListRelations() {
        return {};
    }
    protected _canCreate(): void {}
    /**
     * Deliberately permissive. `moderate()` must be gated by its OWN permission
     * check — if it ever started leaning on `_canUpdate`, the FORBIDDEN tests
     * below would go green while the gate had moved somewhere it does not belong.
     */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[]): Actor => ({
    id: ACTOR_ID,
    roles: [RoleEnum.ADMIN],
    permissions
});

const MODERATOR = () => makeActor([PermissionEnum.COMMERCE_MODERATION_CHANGE]);

function makeService(entity: TestEntity | null = publishedListing()) {
    const model = makeModel(entity);
    const svc = new TestCommerceService({} as ServiceConfig, model);
    svc.destModel = {
        findById: vi.fn().mockResolvedValue({
            id: DEST_ID,
            slug: DEST_SLUG,
            destinationType: DestinationTypeEnum.CITY
        })
    } as unknown as typeof svc.destModel;
    return { svc, model };
}

beforeEach(() => {
    scheduleRevalidation.mockClear();
});

// ---------------------------------------------------------------------------
// AC-10 — the write
// ---------------------------------------------------------------------------

describe('BaseCommerceListingService.moderate — the verdict is written (AC-10)', () => {
    it('writes moderationState and the actor, and nothing else', async () => {
        const { svc, model } = makeService();

        const result = await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.moderationState).toBe(ModerationStatusEnum.REJECTED);

        expect(model.update).toHaveBeenCalledTimes(1);
        const [where, patch] = model.update.mock.calls[0] as [
            Record<string, unknown>,
            Record<string, unknown>
        ];
        expect(where).toEqual({ id: ENTITY_ID });
        // Exact equality, not `objectContaining`: moderation must not become a
        // side door for visibility or lifecycle, which is what keeps the
        // reconciler the only thing that unpublishes a listing.
        expect(patch).toEqual({
            moderationState: ModerationStatusEnum.REJECTED,
            updatedById: ACTOR_ID
        });
    });

    it('accepts APPROVED and PENDING too — this is not a reject-only endpoint', async () => {
        for (const state of [ModerationStatusEnum.APPROVED, ModerationStatusEnum.PENDING]) {
            const { svc, model } = makeService();
            const result = await svc.moderate({
                actor: MODERATOR(),
                id: ENTITY_ID,
                moderationState: state
            });
            expect(result.error).toBeUndefined();
            expect((model.update.mock.calls[0] as [unknown, Record<string, unknown>])[1]).toEqual({
                moderationState: state,
                updatedById: ACTOR_ID
            });
        }
    });

    it('rejects a value that is not a moderation state', async () => {
        const { svc, model } = makeService();

        const result = await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid input
            moderationState: 'BANNED' as any
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a listing that does not exist', async () => {
        const { svc, model } = makeService(null);

        const result = await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('answers NOT_FOUND for a soft-deleted listing', async () => {
        const { svc, model } = makeService({ ...publishedListing(), deletedAt: new Date() });

        const result = await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(model.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// AC-10 — the gate
// ---------------------------------------------------------------------------

describe('BaseCommerceListingService.moderate — a non-admin cannot (AC-10)', () => {
    it('refuses an actor holding no permissions at all', async () => {
        const { svc, model } = makeService();

        const result = await svc.moderate({
            actor: makeActor([]),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
        expect(scheduleRevalidation).not.toHaveBeenCalled();
    });

    it('refuses the listing OWNER — COMMERCE_EDIT_OWN does not clear a rejection', async () => {
        const { svc, model } = makeService({ ...publishedListing(), ownerId: ACTOR_ID });

        const result = await svc.moderate({
            actor: makeActor([PermissionEnum.COMMERCE_EDIT_OWN]),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.APPROVED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses COMMERCE_EDIT_ALL — editing every listing is not moderating one', async () => {
        const { svc, model } = makeService();

        const result = await svc.moderate({
            actor: makeActor([PermissionEnum.COMMERCE_EDIT_ALL, PermissionEnum.COMMERCE_VIEW_ALL]),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });

    it('refuses COMMERCE_MODERATE_REVIEW — that permission moderates reviews, not listings', async () => {
        // The naming trap in HOS-589 §6.7. If this ever passes, the listing gate
        // has silently collapsed into the review gate.
        const { svc, model } = makeService();

        const result = await svc.moderate({
            actor: makeActor([PermissionEnum.COMMERCE_MODERATE_REVIEW]),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(model.update).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// AC-36 — the purge
// ---------------------------------------------------------------------------

describe('BaseCommerceListingService.moderate — rejecting purges the edge cache (AC-36)', () => {
    it('schedules a purge for the listing AND its destination page', async () => {
        const { svc } = makeService();

        await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(scheduleRevalidation).toHaveBeenCalledTimes(1);
        // Full equality: the destination slug is the half that makes the
        // listing disappear from the page that lists it, and an
        // `objectContaining` assertion would be blind to it going missing.
        expect(scheduleRevalidation).toHaveBeenCalledWith({
            entityType: 'gastronomy',
            id: ENTITY_ID,
            slug: 'bar-del-puerto',
            destinationSlug: DEST_SLUG
        });
    });

    it('purges on APPROVED too — a listing coming back has to reappear', async () => {
        const { svc } = makeService();

        await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.APPROVED
        });

        expect(scheduleRevalidation).toHaveBeenCalledTimes(1);
    });

    it('does NOT purge a listing with no public footprint', async () => {
        // The established rule from HOS-203: purging a DRAFT/PRIVATE listing's
        // nonexistent pages produced spurious 404s in production.
        const { svc } = makeService({
            ...publishedListing(),
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT'
        });

        await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(scheduleRevalidation).not.toHaveBeenCalled();
    });

    it('a failed verdict purges nothing', async () => {
        const { svc } = makeService(null);

        await svc.moderate({
            actor: MODERATOR(),
            id: ENTITY_ID,
            moderationState: ModerationStatusEnum.REJECTED
        });

        expect(scheduleRevalidation).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// G-2 — one implementation, inherited by both verticals
// ---------------------------------------------------------------------------

describe('gastronomy and experience resolve to ONE moderate implementation (AC-10 / G-2)', () => {
    it('neither service overrides it', () => {
        // Identity, not "both are functions": an override on either subclass is
        // exactly the drift G-2 exists to prevent, and it would be invisible to
        // any behavioural test that only ever exercised one vertical.
        expect(GastronomyService.prototype.moderate).toBe(
            BaseCommerceListingService.prototype.moderate
        );
        expect(ExperienceService.prototype.moderate).toBe(
            BaseCommerceListingService.prototype.moderate
        );
    });

    it('the two verticals differ only in the entity type they report to the purge', () => {
        // The one legitimate per-domain value: it must match the
        // `@repo/cache-tags` vocabulary or the purge succeeds and evicts nothing.
        const readEntityType = (svc: object) =>
            (svc as { _revalidationEntityType: string })._revalidationEntityType;

        expect(readEntityType(new GastronomyService({} as ServiceConfig))).toBe('gastronomy');
        expect(readEntityType(new ExperienceService({} as ServiceConfig))).toBe('experience');
    });
});
