import { REntityTagModel, TagModel } from '@repo/db';
import { TagSchema } from '@repo/schemas/common/tag.schema.js';
import type { EntityTagType, NewTagInputType, TagType, UpdateTagInputType } from '@repo/types';
import { PermissionEnum, RoleEnum as RoleEnumType } from '@repo/types';
import type { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type {
    Actor,
    CanCreateResult,
    CanDeleteResult,
    CanHardDeleteResult,
    CanRestoreResult,
    CanUpdateResult,
    CanViewResult,
    ServiceInput,
    ServiceOutput
} from '../../types';
import { EntityPermissionReasonEnum } from '../../types';

/**
 * Zod schema for creating a new tag. Omits system-managed fields.
 */
export const NewTagInputSchema = TagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
});

/**
 * Zod schema for updating a tag. All fields are optional.
 */
export const UpdateTagInputSchema = TagSchema.partial();

/**
 * TagService provides business logic and permission management for tags.
 * Inherits CRUD and listing logic from BaseService.
 * Implements entity-tag relationship management.
 */
export class TagService extends BaseService<
    TagType,
    NewTagInputType,
    UpdateTagInputType,
    unknown,
    TagType[]
> {
    /**
     * Model for tag operations.
     */
    protected model = new TagModel();
    /**
     * Model for tag-entity relationship operations.
     */
    protected relationModel = new REntityTagModel();
    /**
     * Zod schema for tag creation input.
     */
    protected inputSchema = NewTagInputSchema as z.ZodType<NewTagInputType>;
    /**
     * Roles allowed to create, view, or update tags.
     */
    protected allowedRoles: RoleEnumType[] = [
        RoleEnumType.ADMIN,
        RoleEnumType.SUPER_ADMIN,
        RoleEnumType.EDITOR
    ];
    /**
     * Roles allowed to delete tags.
     */
    protected deleteRoles: RoleEnumType[] = [RoleEnumType.ADMIN, RoleEnumType.SUPER_ADMIN];

    /**
     * Constructs a new TagService instance.
     */
    constructor() {
        super('tag');
    }

    /**
     * Generates a unique, URL-friendly slug for a tag name.
     * @param _type - Entity type (unused)
     * @param name - Tag name
     * @param checkSlugExists - Async callback to check if a slug exists
     * @returns The generated unique slug string
     */
    public async generateSlug(
        _type: string,
        name: string,
        checkSlugExists: (slug: string) => Promise<boolean>
    ): Promise<string> {
        const toSlug = (str: string) =>
            str
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        let slug = toSlug(name);
        let i = 2;
        while (await checkSlugExists(slug)) {
            slug = `${toSlug(name)}-${i++}`;
        }
        return slug;
    }

    /**
     * Returns an empty list of tags. (Override for custom listing logic.)
     * @param _input - List input (unused)
     * @returns An empty array
     */
    protected async listEntities(_input: unknown): Promise<TagType[]> {
        return [];
    }

    /**
     * Checks if the actor can view a tag entity.
     * @param actor - The actor to check
     * @param _entity - The tag entity (unused)
     * @returns The result of the permission check
     */
    protected async canViewEntity(actor: Actor, _entity: TagType): Promise<CanViewResult> {
        if (!this.allowedRoles.includes(actor.role)) {
            return { canView: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canView: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can create a tag entity.
     * @param actor - The actor to check
     * @returns The result of the permission check
     */
    protected async canCreateEntity(actor: Actor): Promise<CanCreateResult> {
        if (!this.allowedRoles.includes(actor.role)) {
            return { canCreate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canCreate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can update a tag entity.
     * @param actor - The actor to check
     * @param _entity - The tag entity (unused)
     * @returns The result of the permission check
     */
    protected async canUpdateEntity(actor: Actor, _entity: TagType): Promise<CanUpdateResult> {
        if (!this.allowedRoles.includes(actor.role)) {
            return { canUpdate: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canUpdate: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can delete a tag entity.
     * @param actor - The actor to check
     * @param _entity - The tag entity (unused)
     * @returns The result of the permission check
     */
    protected async canDeleteEntity(actor: Actor, _entity: TagType): Promise<CanDeleteResult> {
        if (!this.deleteRoles.includes(actor.role)) {
            return { canDelete: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canDelete: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can restore a tag entity.
     * @param actor - The actor to check
     * @param _entity - The tag entity (unused)
     * @returns The result of the permission check
     */
    protected async canRestoreEntity(actor: Actor, _entity: TagType): Promise<CanRestoreResult> {
        if (!this.allowedRoles.includes(actor.role)) {
            return { canRestore: false, reason: EntityPermissionReasonEnum.MISSING_PERMISSION };
        }
        return { canRestore: true, reason: EntityPermissionReasonEnum.APPROVED };
    }

    /**
     * Checks if the actor can hard delete a tag entity.
     * @param actor - The actor to check
     * @param _entity - The tag entity (unused)
     * @returns The result of the permission check
     */
    protected canHardDeleteEntity(actor: Actor, _entity: TagType): CanHardDeleteResult {
        const checkedPermission = PermissionEnum.ACCOMMODATION_DELETE_OWN;
        if (!this.deleteRoles.includes(actor.role)) {
            return {
                canHardDelete: false,
                reason: EntityPermissionReasonEnum.MISSING_PERMISSION,
                checkedPermission
            };
        }
        return {
            canHardDelete: true,
            reason: EntityPermissionReasonEnum.APPROVED,
            checkedPermission
        };
    }

    /**
     * Associates a tag with an entity. If the tag does not exist, creates it first.
     * Validates actor and permissions before proceeding.
     * @param input - Service input containing tag or tagId, entityId, and entityType
     * @returns The created or associated tag and the relation, or an error
     */
    public async addTagToEntity(
        input: ServiceInput<EntityTagType & { tag?: Partial<TagType> }>
    ): Promise<ServiceOutput<{ tag: TagType; relation: EntityTagType }>> {
        // Validate actor presence and shape
        if (!input.actor || typeof input.actor.role !== 'string') {
            return {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Actor is required and must be valid',
                    details: { actor: input.actor }
                }
            };
        }
        // Permission check: only allowed roles can add tags to entities
        const canCreate = await this.canCreateEntity(input.actor);
        if (!canCreate.canCreate) {
            return {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Actor does not have permission to add tags',
                    details: { actor: input.actor }
                }
            };
        }
        try {
            let tagId = input.tagId;
            let tag: TagType | null = null;
            // If tagId is not provided, create the tag first
            if (!tagId && input.tag) {
                tag = await this.model.create(input.tag);
                tagId = tag.id;
            } else if (tagId) {
                tag = await this.model.findById(tagId);
                if (!tag) {
                    return {
                        error: {
                            code: 'NOT_FOUND',
                            message: 'Tag not found',
                            details: { tagId }
                        }
                    };
                }
            } else {
                return {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'tagId or tag data must be provided',
                        details: input
                    }
                };
            }
            // Create the relation
            const relation = await this.relationModel.create({
                tagId,
                entityId: input.entityId,
                entityType: input.entityType
            });
            return { data: { tag, relation } };
        } catch (error) {
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: (error as Error).message
                }
            };
        }
    }

    /**
     * Removes a tag from an entity. Validates permissions before proceeding.
     * @param input - Service input containing tagId, entityId, and entityType
     * @returns Null if successful, or an error
     */
    public async removeTagFromEntity(
        input: ServiceInput<EntityTagType>
    ): Promise<ServiceOutput<null>> {
        // Permission check: only allowed roles can remove tags from entities
        let tag: TagType | null = null;
        try {
            tag = await this.model.findById(input.tagId);
        } catch {
            // ignore, just for permission check
        }
        const canDelete = await this.canDeleteEntity(input.actor, tag ?? ({} as TagType));
        if (!canDelete.canDelete) {
            return {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Actor does not have permission to remove tags',
                    details: { actor: input.actor }
                }
            };
        }
        try {
            await this.relationModel.hardDelete({
                tagId: input.tagId,
                entityId: input.entityId,
                entityType: input.entityType
            });
            return { data: null };
        } catch (error) {
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: (error as Error).message
                }
            };
        }
    }

    /**
     * Lists all tags for a given entity using an efficient join.
     * @param input - Service input containing entityId and entityType
     * @returns Array of tags associated with the entity, or an error
     */
    public async listTagsForEntity(
        input: ServiceInput<{ entityId: string; entityType: string }>
    ): Promise<ServiceOutput<TagType[]>> {
        try {
            const relations = (await this.relationModel.findAllWithTags(
                input.entityId,
                input.entityType
            )) as Array<{ tag: TagType } & EntityTagType>;
            const tags = relations.map((r) => r.tag).filter(Boolean);
            return { data: tags };
        } catch (error) {
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: (error as Error).message
                }
            };
        }
    }

    /**
     * Lists all entities for a given tag using an efficient join.
     * @param input - Service input containing tagId and optional entityType
     * @returns Array of relations (entity and tag), or an error
     */
    public async listEntitiesForTag(
        input: ServiceInput<{ tagId: string; entityType?: string }>
    ): Promise<ServiceOutput<Array<{ tag: TagType } & EntityTagType>>> {
        try {
            const relations = (await this.relationModel.findAllWithEntities(
                input.tagId,
                input.entityType
            )) as Array<{ tag: TagType } & EntityTagType>;
            return { data: relations };
        } catch (error) {
            return {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: (error as Error).message
                }
            };
        }
    }
}
