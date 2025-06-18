/**
 * base.service.test.ts
 *
 * Tests for BaseService (abstract) using a minimal concrete subclass.
 */

import { PermissionEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseService } from '../../src/base/base.service';
import {
    type Actor,
    type CanCreateResult,
    type CanDeleteResult,
    type CanHardDeleteResult,
    type CanRestoreResult,
    type CanUpdateResult,
    type CanViewResult,
    EntityPermissionReasonEnum
} from '../../src/types';
import { createMockBaseModel, exampleOutput } from '../factories/baseServiceFactory';
import '../setupTest';
import { getSafeActor } from '../utils/actor';

// Minimal entity type for testing
interface TestEntity {
    id: string;
    name: string;
    ownerId?: string;
    isFeatured?: boolean;
}

// Minimal concrete subclass for testing
type TestCreateInput = { foo?: string; id?: string };
type TestUpdateInput = { id: string };
class TestService extends BaseService<
    TestEntity,
    TestCreateInput,
    TestUpdateInput,
    unknown,
    TestEntity[]
> {
    public model = createMockBaseModel<TestEntity>();
    protected inputSchema = z.object({ foo: z.string().optional(), id: z.string().optional() });
    protected async canViewEntity(_actor: Actor, _entity: TestEntity): Promise<CanViewResult> {
        return { canView: true, reason: EntityPermissionReasonEnum.ADMIN };
    }
    protected async canUpdateEntity(_actor: Actor, _entity: TestEntity): Promise<CanUpdateResult> {
        return { canUpdate: true, reason: EntityPermissionReasonEnum.ADMIN };
    }
    protected async canDeleteEntity(_actor: Actor, _entity: TestEntity): Promise<CanDeleteResult> {
        return { canDelete: true, reason: EntityPermissionReasonEnum.ADMIN };
    }
    public async canCreateEntity(_actor: Actor): Promise<CanCreateResult> {
        return { canCreate: true, reason: EntityPermissionReasonEnum.ADMIN };
    }
    protected async canRestoreEntity(
        _actor: Actor,
        _entity: TestEntity
    ): Promise<CanRestoreResult> {
        return { canRestore: true, reason: EntityPermissionReasonEnum.ADMIN };
    }
    protected canHardDeleteEntity(_actor: unknown, _entity: TestEntity): CanHardDeleteResult {
        return {
            canHardDelete: true,
            reason: EntityPermissionReasonEnum.ADMIN,
            checkedPermission: PermissionEnum.ACCOMMODATION_CREATE
        };
    }
    protected async listEntities(_input: unknown): Promise<TestEntity[]> {
        return [exampleOutput];
    }
    public generateSlug(...args: unknown[]): string {
        return args.filter(Boolean).join('-');
    }
}

describe('BaseService', () => {
    let service: TestService;
    beforeEach(() => {
        service = new TestService('test');
    });

    it('creates an entity', async () => {
        // Arrange
        const mockCreate = vi.spyOn(service.model, 'create').mockResolvedValue(exampleOutput);
        // Act
        const result = await service.create({ actor: getSafeActor(), foo: 'bar' });
        // Assert
        expect(result.data).toEqual(exampleOutput);
        mockCreate.mockRestore();
    });

    it('updates an entity', async () => {
        // Arrange
        const mockUpdate = vi.spyOn(service.model, 'update').mockResolvedValue(exampleOutput);
        vi.spyOn(service.model, 'findById').mockResolvedValue(exampleOutput);
        // Act
        const result = await service.update({ actor: getSafeActor(), id: 'entity-1' });
        // Assert
        expect(result.data).toEqual(exampleOutput);
        mockUpdate.mockRestore();
    });

    it('handles not found on update', async () => {
        // Arrange
        vi.spyOn(service.model, 'findById').mockResolvedValue(null);
        // Act
        const result = await service.update({ actor: getSafeActor(), id: 'entity-1' });
        // Assert
        expect(result.error).toBeDefined();
    });

    it('calls permission checks', async () => {
        // Arrange
        const spy = vi.spyOn(service, 'canCreateEntity');
        // Act
        await service.create({ actor: getSafeActor(), foo: 'bar' });
        // Assert
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('BaseService edge cases and errors', () => {
    let service: TestService;
    beforeEach(() => {
        service = new TestService('test');
    });

    it('returns validation error on create with invalid input', async () => {
        const result = await service.create({ actor: getSafeActor(), foo: 'bar' });
        expect(result.error).toBeDefined();
        expect(result.data).toBeUndefined();
    });

    it('returns validation error on update with invalid input', async () => {
        vi.spyOn(service.model, 'findById').mockResolvedValue(exampleOutput);
        const result = await service.update({ actor: getSafeActor(), id: 'entity-1' });
        expect(result.error).toBeDefined();
        expect(result.data).toBeUndefined();
    });

    it('handles model.create throwing error', async () => {
        vi.spyOn(service.model, 'create').mockRejectedValue(new Error('DB error'));
        const result = await service.create({ actor: getSafeActor(), foo: 'bar' });
        expect(result.error).toBeDefined();
    });

    it('handles model.update throwing error', async () => {
        vi.spyOn(service.model, 'findById').mockResolvedValue(exampleOutput);
        vi.spyOn(service.model, 'update').mockRejectedValue(new Error('DB error'));
        const result = await service.update({ actor: getSafeActor(), id: 'entity-1' });
        expect(result.error).toBeDefined();
    });

    it('handles model.findById throwing error', async () => {
        vi.spyOn(service.model, 'findById').mockRejectedValue(new Error('DB error'));
        const result = await service.update({ actor: getSafeActor(), id: 'entity-1' });
        expect(result.error).toBeDefined();
    });

    it('returns permission error if canCreateEntity is false', async () => {
        vi.spyOn(service, 'canCreateEntity').mockResolvedValue({
            canCreate: false,
            reason: EntityPermissionReasonEnum.DENIED
        });
        const result = await service.create({ actor: getSafeActor(), foo: 'bar' });
        expect(result.error).toBeDefined();
    });

    it('findById returns entity if found', async () => {
        vi.spyOn(service.model, 'findOne').mockResolvedValue(exampleOutput);
        const result = await service.getById({ actor: getSafeActor(), id: 'entity-1' });
        expect(result.data).toEqual(exampleOutput);
    });

    it('findById returns error if not found', async () => {
        vi.spyOn(service.model, 'findById').mockResolvedValue(null);
        const result = await service.getById({ actor: getSafeActor(), id: 'entity-1' });
        expect(result.error).toBeDefined();
    });

    it('delete, restore, hardDelete handle errors', async () => {
        vi.spyOn(service.model, 'findById').mockResolvedValue(exampleOutput);
        vi.spyOn(service.model, 'softDelete').mockRejectedValue(new Error('DB error'));
        const del = await service.softDelete({ actor: getSafeActor(), id: 'entity-1' });
        expect(del.error).toBeDefined();
        vi.spyOn(service.model, 'restore').mockRejectedValue(new Error('DB error'));
        const res = await service.restore({ actor: getSafeActor(), id: 'entity-1' });
        expect(res.error).toBeDefined();
        vi.spyOn(service.model, 'hardDelete').mockRejectedValue(new Error('DB error'));
        const hard = await service.hardDelete({ actor: getSafeActor(), id: 'entity-1' });
        expect(hard.error).toBeDefined();
    });

    it('handles empty/nil input gracefully', async () => {
        // Prueba input sin actor (inválido)
        const result = await service.create({ actor: undefined as unknown as Actor, foo: 'bar' });
        expect(result.error).toBeDefined();
        const upd = await service.update({
            actor: undefined as unknown as Actor,
            id: undefined as unknown as string
        });
        expect(upd.error).toBeDefined();
    });
});
