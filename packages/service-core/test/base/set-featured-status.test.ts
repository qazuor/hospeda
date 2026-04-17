/**
 * Tests for setFeaturedStatus edge cases (SPEC-059 GAP-055).
 *
 * Verifies that calling setFeaturedStatus on an entity whose schema does NOT
 * include an isFeatured property returns a ServiceError (INTERNAL_ERROR) instead
 * of crashing with an unhandled exception. The base implementation detects the
 * missing property via `!('isFeatured' in entity)` and throws a plain Error which
 * runWithLoggingAndValidation catches and wraps as INTERNAL_ERROR.
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { ListRelationsConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { BaseCrudService } from '../../src/base/base.crud.service';
import type {
    Actor,
    BaseModel,
    PaginatedListOutput,
    ServiceConfig,
    ServiceInput
} from '../../src/types';
import { serviceLogger } from '../../src/utils';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import '../setupTest';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Minimal entity WITHOUT isFeatured
// ---------------------------------------------------------------------------

type NoFeaturedEntity = {
    id: string;
    name: string;
    ownerId: string;
    createdById: string;
    updatedById: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
};

const createSchema = z.object({ name: z.string().min(1) });
const updateSchema = z.object({ name: z.string().min(1).optional() });
const searchSchema = z.object({ q: z.string().optional() });

class NoFeaturedService extends BaseCrudService<
    NoFeaturedEntity,
    BaseModel<NoFeaturedEntity>,
    typeof createSchema,
    typeof updateSchema,
    typeof searchSchema
> {
    protected readonly entityName = 'noFeaturedEntity';
    protected readonly model: BaseModel<NoFeaturedEntity>;
    protected readonly createSchema = createSchema;
    protected readonly updateSchema = updateSchema;
    protected readonly searchSchema = searchSchema;
    protected readonly logger = serviceLogger;

    constructor(config: ServiceConfig, model: BaseModel<NoFeaturedEntity>) {
        super(config, 'noFeaturedEntity');
        this.model = model;
    }

    protected getDefaultListRelations(): ListRelationsConfig {
        return undefined;
    }

    protected _canCreate(_actor: Actor): void {}
    protected _canUpdate(_actor: Actor, _entity: NoFeaturedEntity): void {}
    protected _canSoftDelete(_actor: Actor, _entity: NoFeaturedEntity): void {}
    protected _canHardDelete(_actor: Actor, _entity: NoFeaturedEntity): void {}
    protected _canRestore(_actor: Actor, _entity: NoFeaturedEntity): void {}
    protected _canView(_actor: Actor, _entity: NoFeaturedEntity): void {}
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(): void {}

    protected async _executeSearch(): Promise<PaginatedListOutput<NoFeaturedEntity>> {
        return { items: [], total: 0 };
    }

    protected async _executeCount(): Promise<{ count: number }> {
        return { count: 0 };
    }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeActor = (): Actor => ({
    id: 'actor-id-001',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_ANY]
});

const makeEntity = (): NoFeaturedEntity => ({
    id: 'entity-id-001',
    name: 'No Featured Entity',
    ownerId: 'actor-id-001',
    createdById: 'actor-id-001',
    updatedById: 'actor-id-001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCrudWrite: setFeaturedStatus — entity without isFeatured (SPEC-059 GAP-055)', () => {
    let modelMock: BaseModel<NoFeaturedEntity>;
    let service: NoFeaturedService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<NoFeaturedEntity>();
        service = new NoFeaturedService({}, modelMock as BaseModelDB<NoFeaturedEntity>);
    });

    it('returns a ServiceError instead of crashing when entity has no isFeatured property', async () => {
        // Arrange — model returns an entity that has no isFeatured field
        const entity = makeEntity();
        asMock(modelMock.findById).mockResolvedValue(entity);

        const actor = makeActor();
        const input: ServiceInput<{ id: string; isFeatured: boolean }> = {
            actor,
            id: entity.id,
            isFeatured: true
        };

        // Act
        const result = await service.setFeaturedStatus(input);

        // Assert — must not crash; must return an error response
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toContain('isFeatured');
    });

    it('does not call model.update when the isFeatured check fails', async () => {
        // Arrange
        const entity = makeEntity();
        asMock(modelMock.findById).mockResolvedValue(entity);

        const actor = makeActor();
        const input: ServiceInput<{ id: string; isFeatured: boolean }> = {
            actor,
            id: entity.id,
            isFeatured: true
        };

        // Act
        await service.setFeaturedStatus(input);

        // Assert — no update should have been attempted
        expect(asMock(modelMock.update)).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND when entity does not exist (precondition coverage)', async () => {
        // Arrange — model returns null (entity not found)
        asMock(modelMock.findById).mockResolvedValue(null);

        const actor = makeActor();
        const input: ServiceInput<{ id: string; isFeatured: boolean }> = {
            actor,
            id: 'non-existent-id',
            isFeatured: true
        };

        // Act
        const result = await service.setFeaturedStatus(input);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});
