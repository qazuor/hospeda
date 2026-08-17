/**
 * Regression tests for HOS-556 / HOS-559 — soft delete must record its author.
 *
 * `BaseCrudWrite.softDelete()` validates the actor, checks permissions with it,
 * and then called `model.softDelete(where, tx)` — dropping the actor one line
 * before the write. Every entity that soft-deletes through the base CRUD path
 * therefore left `deleted_by_id` NULL.
 *
 * Measured in production on 2026-08-15: of the 8 rows deleted by real people
 * using the product, 0 carried an actor. The 145 rows that did carry one all
 * shared a single `deleted_at` (2026-07-23 15:13:16.628) — one seed
 * data-migration, not the application.
 */
import type { ListRelationsConfig } from '@repo/schemas';
import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type { Actor, ServiceConfig } from '../../src/types';

class MockModel {
    entityName = 'mock_entity';
    findAll = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    updateById = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    findAllWithRelations = vi.fn();
    findWithRelations = vi.fn();
    findOneWithRelations = vi.fn();
    findByIds = vi.fn();
    raw = vi.fn();
    getTable = vi.fn();
}

// biome-ignore lint/suspicious/noExplicitAny: generic test double for the base class
class TestService extends BaseCrudService<any, MockModel, any, any, any> {
    protected readonly model: MockModel;
    protected readonly createSchema = z.object({ name: z.string() });
    protected readonly updateSchema = z.object({ name: z.string().optional() });
    protected readonly searchSchema = z.object({ q: z.string().optional() });

    constructor(ctx: ServiceConfig, model: MockModel) {
        super(ctx, 'test_entity');
        this.model = model;
    }

    protected getDefaultListRelations(): ListRelationsConfig {
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
    // biome-ignore lint/suspicious/noExplicitAny: generic test double for the base class
    protected async _executeSearch(): Promise<any> {
        return { data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } };
    }
    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

const ACTOR: Actor = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.ADMIN],
    permissions: []
};

describe('BaseCrudWrite.softDelete — authorship (HOS-556 / HOS-559)', () => {
    let model: MockModel;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        model = new MockModel();
        service = new TestService({ logger: undefined } as unknown as ServiceConfig, model);
        model.findById.mockResolvedValue({ id: 'entity-1', deletedAt: null });
        model.softDelete.mockResolvedValue(1);
    });

    it('hands the acting user id to the model', async () => {
        const result = await service.softDelete(ACTOR, 'entity-1');

        expect(result.error).toBeUndefined();
        expect(model.softDelete).toHaveBeenCalledTimes(1);

        const [where, deletedById] = model.softDelete.mock.calls[0] as [
            Record<string, unknown>,
            unknown
        ];
        expect(where).toEqual({ id: 'entity-1' });
        expect(deletedById).toBe(ACTOR.id);
    });

    it('does not call the model at all when the row is already deleted', async () => {
        model.findById.mockResolvedValue({ id: 'entity-1', deletedAt: new Date() });

        const result = await service.softDelete(ACTOR, 'entity-1');

        expect(result.data).toEqual({ count: 0 });
        expect(model.softDelete).not.toHaveBeenCalled();
    });
});
