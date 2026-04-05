import type { AdminInfoType } from '@repo/schemas';
import { AdminInfoSchema, ServiceErrorCode } from '@repo/schemas';
import type { ZodObject } from 'zod';
import { z } from 'zod';
import { type BaseModel, ServiceError, type ServiceInput, type ServiceOutput } from '../types';
import { normalizeAdminInfo } from '../utils';
import { BaseCrudWrite } from './base.crud.write';

/**
 * Abstract base class providing admin metadata operations for CRUD services.
 *
 * Includes the following public API methods:
 * - `getAdminInfo` - Retrieve admin-only metadata for an entity (requires update permission)
 * - `setAdminInfo` - Set admin-only metadata for an entity (requires update permission)
 *
 * @template TEntity - The primary entity type this service manages.
 * @template TModel - The Drizzle ORM model type for the entity.
 * @template TCreateSchema - The Zod schema for validating entity creation input.
 * @template TUpdateSchema - The Zod schema for validating entity update input.
 * @template TSearchSchema - The Zod schema for validating entity search input.
 */
export abstract class BaseCrudAdmin<
    TEntity extends { id: string; deletedAt?: Date | null },
    TModel extends BaseModel<TEntity>,
    TCreateSchema extends ZodObject,
    TUpdateSchema extends ZodObject,
    TSearchSchema extends ZodObject
> extends BaseCrudWrite<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema> {
    /**
     * Gets the admin info for an entity by ID.
     *
     * Only users with update permission can access this method.
     *
     * @param input - ServiceInput containing the entity `id`.
     * @returns `ServiceOutput<{ adminInfo: unknown }>` with the admin metadata.
     */
    public async getAdminInfo(
        input: ServiceInput<{ id: string }>
    ): Promise<ServiceOutput<{ adminInfo: unknown }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'getAdminInfo',
            input,
            schema: z.object({ id: z.string() }),
            execute: async ({ id }, actor) => {
                const entity = await this.model.findById(id);
                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} not found`
                    );
                }
                await this._canAdminGetInfo(actor, entity);
                return { adminInfo: (entity as Record<string, unknown>).adminInfo };
            }
        });
    }

    /**
     * Sets the admin info for an entity by ID.
     *
     * Only users with update permission can set admin metadata.
     *
     * @param input - ServiceInput containing `id` and `adminInfo` payload.
     * @returns `ServiceOutput<{ adminInfo: AdminInfoType }>` with the stored metadata.
     */
    public async setAdminInfo(
        input: ServiceInput<{ id: string; adminInfo: AdminInfoType }>
    ): Promise<ServiceOutput<{ adminInfo: AdminInfoType }>> {
        return this.runWithLoggingAndValidation({
            methodName: 'setAdminInfo',
            input,
            schema: z.object({ id: z.string(), adminInfo: AdminInfoSchema }),
            execute: async ({ id, adminInfo }, actor) => {
                const entity = await this.model.findById(id);
                if (!entity) {
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        `${this.entityName} not found`
                    );
                }
                await this._canAdminSetInfo(actor, entity);
                const normalized = normalizeAdminInfo(adminInfo);
                if (!normalized) {
                    throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid adminInfo');
                }
                await this.model.update({ id }, {
                    adminInfo: normalized
                } as unknown as Partial<TEntity>);
                return { adminInfo: normalized };
            }
        });
    }
}
