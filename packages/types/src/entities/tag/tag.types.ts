import type {
    WithAudit,
    WithLifecycleState,
    WithOptional,
    Writable
} from '../../common/helpers.types.js';
import type {
    AccommodationId,
    DestinationId,
    EventId,
    PostId,
    TagId,
    UserId
} from '../../common/id.types.js';
import type { EntityTypeEnum } from '../../enums/entity-type.enum.js';
import type { TagColorEnum } from '../../enums/tag-color.enum.js';

/**
 * Tag used for categorizing and filtering entities.
 */
export interface TagType extends WithAudit, WithLifecycleState {
    id: TagId;
    name: string;
    slug: string;
    color: TagColorEnum;
    icon?: string;
    notes?: string;
}

/**
 * Partial editable structure of a PostType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialTagType = Partial<Writable<TagType>>;

/**
 * Input structure used to create a new tag.
 * Makes id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById optional for creation.
 *
 * @example
 * // Creating a new tag (id and audit fields are optional)
 * const input: NewTagInputType = {
 *   name: 'Nature',
 *   color: 'green',
 * };
 */
export type NewTagInputType = WithOptional<
    TagType,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'createdById' | 'updatedById' | 'deletedById'
>;

/**
 * Input structure used to update an existing tag.
 * All fields are optional for partial patching.
 *
 * @example
 * // Updating a tag (only the fields to update are provided)
 * const input: UpdateTagInputType = {
 *   color: 'blue',
 * };
 */
export type UpdateTagInputType = Partial<Writable<TagType>>;

/**
 * EntityTagType represents a polymorphic relation between a tag and any supported entity type.
 * - tagId: The ID of the tag.
 * - entityId: The ID of the related entity (can be Accommodation, Destination, User, Post, or Event).
 * - entityType: The type of the related entity (see EntityTypeEnum).
 *
 * This type is used to model the many-to-many relationship between tags and various entities in the system.
 */
export interface EntityTagType {
    tagId: TagId;
    entityId: AccommodationId | DestinationId | UserId | PostId | EventId;
    entityType: EntityTypeEnum;
}
