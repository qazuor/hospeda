import type { PublicUserType, UserType } from '@repo/types';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/types';
import {
    AccommodationModel,
    type AccommodationOrderByColumn
} from '../../models/accommodation/accommodation.model';
import { DestinationModel } from '../../models/destination/destination.model';
import { EventModel } from '../../models/event/event.model';
import { EntityTagModel } from '../../models/tag/entity_tag.model';
import { hasPermission } from '../../utils/permission-manager';
import { isUserType, logMethodEnd, logMethodStart } from '../../utils/service-helper';
import { serviceLogger } from '../../utils/serviceLogger';
import {
    type AddTagInput,
    type AddTagOutput,
    type GetAccommodationsByTagInput,
    type GetAccommodationsByTagOutput,
    type GetDestinationsByTagInput,
    type GetDestinationsByTagOutput,
    type GetEventsByTagInput,
    type GetEventsByTagOutput,
    type RemoveTagInput,
    type RemoveTagOutput,
    addTagInputSchema,
    getAccommodationsByTagInputSchema,
    getDestinationsByTagInputSchema,
    getEventsByTagInputSchema,
    removeTagInputSchema
} from './tag.schemas';

/**
 * TagService provides methods to manage tag associations and retrieve entities by tag.
 * All methods follow the RO-RO pattern and are strongly typed.
 *
 * @example
 * const result = await TagService.addTag({ ... }, user);
 */
export const TagService = {
    /**
     * Adds a tag to an entity.
     *
     * @param input - The input object containing tag and entity information.
     * @param actor - The user or public actor performing the operation.
     * @returns An object with the created entity-tag relation.
     * @throws Error if the actor lacks permission or input is invalid.
     * @example
     * const result = await TagService.addTag({ tagId, entityId, entityType }, user);
     */
    async addTag(input: AddTagInput, actor: UserType | PublicUserType): Promise<AddTagOutput> {
        logMethodStart(serviceLogger, 'addTag', input, actor);
        const parsedInput = addTagInputSchema.parse(input);

        // Unify public user and insufficient permission control
        if (!isUserType(actor) || actor.role === RoleEnum.GUEST) {
            serviceLogger.permission({
                permission: 'UNKNOWN_PERMISSION',
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: { input, error: 'Forbidden: insufficient permission to add tag' }
            });
            throw new Error('Forbidden: insufficient permission to add tag');
        }

        // Permission check by entity type
        let requiredPermission: PermissionEnum | undefined;
        switch (parsedInput.entityType) {
            case EntityTypeEnum.ACCOMMODATION:
                requiredPermission = PermissionEnum.ACCOMMODATION_TAGS_MANAGE;
                break;
            case EntityTypeEnum.DESTINATION:
                requiredPermission = PermissionEnum.DESTINATION_TAGS_MANAGE;
                break;
            case EntityTypeEnum.EVENT:
                requiredPermission = PermissionEnum.EVENT_UPDATE;
                break;
            case EntityTypeEnum.POST:
                requiredPermission = PermissionEnum.POST_TAGS_MANAGE;
                break;
            case EntityTypeEnum.USER:
                requiredPermission = PermissionEnum.USER_UPDATE_PROFILE;
                break;
            default:
                serviceLogger.permission({
                    permission: 'UNKNOWN_PERMISSION',
                    userId: actor.id,
                    role: actor.role,
                    extraData: { input, error: 'Unsupported entity type for tagging' }
                });
                throw new Error('Unsupported entity type for tagging');
        }

        // Insufficient permission check (hasPermission returns boolean)
        // checkAndLogPermission does not throw, only logs if hasPermission throws
        // Here we must throw if the user lacks permission
        // (Pattern same as other services)
        if (!hasPermission(actor, requiredPermission)) {
            serviceLogger.permission({
                permission: requiredPermission,
                userId: actor.id,
                role: actor.role,
                extraData: { input, error: 'Forbidden: insufficient permission to add tag' }
            });
            throw new Error('Forbidden: insufficient permission to add tag');
        }

        const entityTag = await EntityTagModel.create({
            tagId: parsedInput.tagId,
            entityId: parsedInput.entityId,
            entityType: parsedInput.entityType
        });
        logMethodEnd(serviceLogger, 'addTag', { entityTag });
        return { entityTag };
    },

    /**
     * Removes a tag from an entity.
     *
     * @param input - The input object containing tag and entity information.
     * @param actor - The user or public actor performing the operation.
     * @returns An object with the result of the operation.
     * @throws Error if the actor lacks permission or input is invalid.
     * @example
     * const result = await TagService.removeTag({ tagId, entityId, entityType }, user);
     */
    async removeTag(
        input: RemoveTagInput,
        actor: UserType | PublicUserType
    ): Promise<RemoveTagOutput> {
        logMethodStart(serviceLogger, 'removeTag', input, actor);
        const parsedInput = removeTagInputSchema.parse(input);
        if (!isUserType(actor) || actor.role === RoleEnum.GUEST) {
            serviceLogger.permission({
                permission: 'UNKNOWN_PERMISSION',
                userId: 'public',
                role: RoleEnum.GUEST,
                extraData: { input, error: 'Forbidden: insufficient permission to remove tag' }
            });
            throw new Error('Forbidden: insufficient permission to remove tag');
        }
        let requiredPermission: PermissionEnum | undefined;
        switch (parsedInput.entityType) {
            case EntityTypeEnum.ACCOMMODATION:
                requiredPermission = PermissionEnum.ACCOMMODATION_TAGS_MANAGE;
                break;
            case EntityTypeEnum.DESTINATION:
                requiredPermission = PermissionEnum.DESTINATION_TAGS_MANAGE;
                break;
            case EntityTypeEnum.EVENT:
                requiredPermission = PermissionEnum.EVENT_UPDATE;
                break;
            case EntityTypeEnum.POST:
                requiredPermission = PermissionEnum.POST_TAGS_MANAGE;
                break;
            case EntityTypeEnum.USER:
                requiredPermission = PermissionEnum.USER_UPDATE_PROFILE;
                break;
            default:
                serviceLogger.permission({
                    permission: 'UNKNOWN_PERMISSION',
                    userId: actor.id,
                    role: actor.role,
                    extraData: { input, error: 'Unsupported entity type for tag removal' }
                });
                throw new Error('Unsupported entity type for tag removal');
        }
        if (!hasPermission(actor, requiredPermission)) {
            serviceLogger.permission({
                permission: requiredPermission,
                userId: actor.id,
                role: actor.role,
                extraData: { input, error: 'Forbidden: insufficient permission to remove tag' }
            });
            throw new Error('Forbidden: insufficient permission to remove tag');
        }
        const removed = await EntityTagModel.delete(
            parsedInput.tagId,
            parsedInput.entityId,
            parsedInput.entityType
        );
        logMethodEnd(serviceLogger, 'removeTag', { removed: !!removed });
        return { removed: !!removed };
    },

    /**
     * Gets accommodations associated with a tag.
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor requesting the data.
     * @returns An object with the list of accommodations.
     * @example
     * const result = await TagService.getAccommodationsByTag({ tagId }, user);
     */
    async getAccommodationsByTag(
        input: GetAccommodationsByTagInput,
        actor: UserType | PublicUserType
    ): Promise<GetAccommodationsByTagOutput> {
        logMethodStart(serviceLogger, 'getAccommodationsByTag', input, actor);
        const parsedInput = getAccommodationsByTagInputSchema.parse(input);
        // Only 'name' is valid for AccommodationOrderByColumn
        const orderBy: AccommodationOrderByColumn | undefined =
            parsedInput.orderBy === 'name' ? 'name' : undefined;
        const accommodations = await AccommodationModel.search({
            tagId: parsedInput.tagId,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            order: parsedInput.order,
            orderBy
        });
        logMethodEnd(serviceLogger, 'getAccommodationsByTag', { count: accommodations.length });
        return { accommodations };
    },

    /**
     * Gets destinations associated with a tag.
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor requesting the data.
     * @returns An object with the list of destinations.
     * @example
     * const result = await TagService.getDestinationsByTag({ tagId }, user);
     */
    async getDestinationsByTag(
        input: GetDestinationsByTagInput,
        actor: UserType | PublicUserType
    ): Promise<GetDestinationsByTagOutput> {
        logMethodStart(serviceLogger, 'getDestinationsByTag', input, actor);
        const parsedInput = getDestinationsByTagInputSchema.parse(input);
        // Only 'name' is valid for orderBy (DestinationModel)
        const orderBy = parsedInput.orderBy === 'name' ? 'name' : undefined;
        const destinations = await DestinationModel.search({
            tagId: parsedInput.tagId,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            order: parsedInput.order,
            orderBy
        });
        logMethodEnd(serviceLogger, 'getDestinationsByTag', { count: destinations.length });
        return { destinations };
    },

    /**
     * Gets events associated with a tag.
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor requesting the data.
     * @returns An object with the list of events.
     * @example
     * const result = await TagService.getEventsByTag({ tagId }, user);
     */
    async getEventsByTag(
        input: GetEventsByTagInput,
        actor: UserType | PublicUserType
    ): Promise<GetEventsByTagOutput> {
        logMethodStart(serviceLogger, 'getEventsByTag', input, actor);
        const parsedInput = getEventsByTagInputSchema.parse(input);
        // Only 'summary' and 'createdAt' are valid for orderBy (EventModel)
        const orderBy = parsedInput.orderBy === 'summary' ? 'summary' : undefined;
        const events = await EventModel.search({
            tagId: parsedInput.tagId,
            limit: parsedInput.limit ?? 20,
            offset: parsedInput.offset ?? 0,
            order: parsedInput.order,
            orderBy
        });
        logMethodEnd(serviceLogger, 'getEventsByTag', { count: events.length });
        return { events };
    },

    /**
     * Gets posts associated with a tag.
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor requesting the data.
     * @returns An object with the list of posts.
     * @example
     * const result = await TagService.getPostsByTag({ tagId }, user);
     */
    async getPostsByTag(
        input: import('./tag.schemas').GetPostsByTagInput,
        actor: UserType | PublicUserType
    ): Promise<import('./tag.schemas').GetPostsByTagOutput> {
        logMethodStart(serviceLogger, 'getPostsByTag', input, actor);
        const parsedInput = (await import('./tag.schemas')).getPostsByTagInputSchema.parse(input);
        // Only 'title' and 'createdAt' are valid for orderBy (PostModel)
        const orderBy =
            parsedInput.orderBy === 'title'
                ? 'title'
                : parsedInput.orderBy === 'createdAt'
                  ? 'createdAt'
                  : undefined;
        const posts = await (await import('../../models/post/post.model')).PostModel.getByTag(
            parsedInput.tagId,
            {
                limit: parsedInput.limit ?? 20,
                offset: parsedInput.offset ?? 0,
                order: parsedInput.order,
                orderBy
            }
        );
        logMethodEnd(serviceLogger, 'getPostsByTag', { count: posts.length });
        return { posts };
    },

    // --- FUTURE METHODS (stubs) ---

    /**
     * Soft-deletes a tag (archives it).
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor performing the operation.
     * @throws Error always (not implemented)
     */
    async softDelete(_input: unknown, _actor: UserType | PublicUserType): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Hard-deletes a tag (permanently removes it).
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor performing the operation.
     * @throws Error always (not implemented)
     */
    async hardDelete(_input: unknown, _actor: UserType | PublicUserType): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Restores a soft-deleted tag.
     *
     * @param input - The input object containing tag information.
     * @param actor - The user or public actor performing the operation.
     * @throws Error always (not implemented)
     */
    async restore(_input: unknown, _actor: UserType | PublicUserType): Promise<never> {
        throw new Error('Not implemented yet');
    },

    /**
     * Updates a tag.
     *
     * @param input - The input object containing tag update information.
     * @param actor - The user or public actor performing the operation.
     * @throws Error always (not implemented)
     */
    async update(_input: unknown, _actor: UserType | PublicUserType): Promise<never> {
        throw new Error('Not implemented yet');
    }
};
