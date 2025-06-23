import { PermissionEnum, RoleEnum, ServiceErrorCode, VisibilityEnum } from '@repo/types';
import { z } from 'zod';
import { BaseService } from '../../src/base/base.service';
import type { Actor, BaseModel } from '../../src/types';
import { ServiceError } from '../../src/types';
import { serviceLogger } from '../../src/utils/service-logger';
import { mockModel } from '../setupTest';

// Schemas and Types for testing
export const TestEntitySchema = z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
    visibility: z.nativeEnum(VisibilityEnum),
    ownerId: z.string().optional(),
    createdById: z.string(),
    updatedById: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullish()
});
export type TestEntity = z.infer<typeof TestEntitySchema>;

export const CreateTestEntitySchema = TestEntitySchema.pick({ name: true, value: true });
export const UpdateTestEntitySchema = CreateTestEntitySchema.partial();
export const SearchTestEntitySchema = z.object({
    pagination: z.object({ page: z.number(), pageSize: z.number() }).optional(),
    sort: z.object({ field: z.string(), direction: z.string() }).optional(),
    filters: z
        .object({
            name: z.string().optional()
        })
        .optional()
});

// The TestService class to be used in all tests
export class TestService extends BaseService<
    TestEntity,
    BaseModel<TestEntity>,
    typeof CreateTestEntitySchema,
    typeof UpdateTestEntitySchema,
    typeof SearchTestEntitySchema
> {
    protected entityName = 'testEntity';
    protected model = mockModel;
    protected createSchema = CreateTestEntitySchema;
    protected updateSchema = UpdateTestEntitySchema;
    protected searchSchema = SearchTestEntitySchema;
    protected logger = serviceLogger;

    protected _canCreate(actor: Actor, _data: z.infer<typeof CreateTestEntitySchema>): void {
        if (!actor.permissions.includes(PermissionEnum.ACCOMMODATION_CREATE)) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
    }
    protected _canView(_actor: Actor, _entity: TestEntity): void {}
    protected _canUpdate(actor: Actor, entity: TestEntity): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN && actor.id !== entity.ownerId) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
    }
    protected _canSoftDelete(actor: Actor, entity: TestEntity): void {
        if (actor.role !== RoleEnum.SUPER_ADMIN && actor.id !== entity.ownerId) {
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        }
    }
    protected _canHardDelete(actor: Actor, entity: TestEntity): void {
        const isAdmin = actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN;
        const isOwner = actor.id === entity.ownerId;

        if (isAdmin || isOwner) {
            return;
        }

        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }
    protected _canRestore(actor: Actor, entity: TestEntity): void {
        const isAdmin = actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN;
        const isOwner = actor.id === entity.ownerId;

        if (isAdmin || isOwner) {
            return;
        }

        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }
    protected _canList(): void {}
    protected _canSearch(): void {}
    protected _canCount(): void {}
    protected _canUpdateVisibility(actor: Actor, entity: TestEntity): void {
        const isAdmin = actor.role === RoleEnum.ADMIN || actor.role === RoleEnum.SUPER_ADMIN;
        const isOwner = actor.id === entity.ownerId;

        if (isAdmin || isOwner) {
            return;
        }

        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }
    protected async _executeSearch() {
        return { items: [], total: 0 };
    }
    protected async _executeCount() {
        return { count: 0 };
    }
}
