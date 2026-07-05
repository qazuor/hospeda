import { RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../../src/base/base.crud.service';
import type { Actor, ServiceConfig, ServiceContext } from '../../../src/types';

/**
 * Regression coverage for BETA-106: `BaseCrudService.create()` must forward the
 * execution context to `_canCreate`, consistent with `_beforeCreate`. Before the
 * fix, `_canCreate` was invoked as `_canCreate(actor, data)` with no ctx, so a
 * permission check that needs to read uncommitted rows could not join the
 * caller's transaction.
 */

class MockModel {
    entityName = 'ctx_capture_entity';
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    findById = vi.fn();
    findByIds = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    updateById = vi.fn();
    delete = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    findWithRelations = vi.fn();
    findOneWithRelations = vi.fn();
    raw = vi.fn();
    getTable = vi.fn();
}

class CtxCapturingService extends BaseCrudService<
    // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    any,
    MockModel,
    // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    any,
    // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    any,
    // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    any
> {
    public canCreateCtx: ServiceContext | undefined;
    public beforeCreateCtx: ServiceContext | undefined;
    public canCreateCalled = false;

    protected readonly model: MockModel;
    protected readonly createSchema = z.object({ name: z.string() });
    protected readonly updateSchema = z.object({ name: z.string().optional() });
    protected readonly searchSchema = z.object({ q: z.string().optional() });

    constructor(ctx: ServiceConfig, model: MockModel) {
        super(ctx, 'ctx_capture_entity');
        this.model = model;
    }

    protected getDefaultListRelations() {
        return undefined;
    }

    protected _canCreate(_actor: Actor, _data: { name: string }, ctx?: ServiceContext): void {
        this.canCreateCalled = true;
        this.canCreateCtx = ctx;
    }

    protected async _beforeCreate(
        data: { name: string },
        _actor: Actor,
        ctx: ServiceContext
        // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    ): Promise<any> {
        this.beforeCreateCtx = ctx;
        return data;
    }

    protected _canUpdate(): void {}
    protected _canSoftDelete(): void {}
    protected _canHardDelete(): void {}
    protected _canRestore(): void {}
    protected _canView(): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}
    // biome-ignore lint/suspicious/noExplicitAny: minimal generic test double
    protected async _executeSearch(): Promise<any> {
        return { items: [], total: 0 };
    }
    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

describe('BaseCrudService.create forwards ctx to _canCreate (BETA-106)', () => {
    let model: MockModel;
    let service: CtxCapturingService;
    const actor = {
        id: 'u1',
        type: 'user',
        role: RoleEnum.USER,
        permissions: []
    } as unknown as Actor;

    beforeEach(() => {
        model = new MockModel();
        model.create.mockResolvedValue({ id: 'e1', name: 'X' });
        service = new CtxCapturingService({} as ServiceConfig, model);
    });

    it('passes _canCreate the SAME execution context that _beforeCreate receives', async () => {
        const marker = { __tx: 'marker' } as unknown;
        const ctx = { tx: marker } as unknown as ServiceContext;

        await service.create(actor, { name: 'X' }, ctx);

        expect(service.canCreateCalled).toBe(true);
        expect(service.canCreateCtx).toBeDefined();
        // The ctx handed to the permission hook must be the very execCtx the
        // before-hook gets — this is exactly what the bug omitted.
        expect(service.canCreateCtx).toBe(service.beforeCreateCtx);
        // ...and it carries the caller's transaction.
        expect(service.canCreateCtx?.tx).toBe(marker);
    });

    it('still forwards a ctx to _canCreate when the caller passes none', async () => {
        await service.create(actor, { name: 'Y' });

        expect(service.canCreateCalled).toBe(true);
        // The runner builds an execCtx even without a caller ctx; both hooks
        // must receive that same object, with no transaction.
        expect(service.canCreateCtx).toBe(service.beforeCreateCtx);
        expect(service.canCreateCtx?.tx).toBeUndefined();
    });
});
