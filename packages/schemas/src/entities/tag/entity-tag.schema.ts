import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema,
    TagIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';

/**
 * EntityTag Schema - Polymorphic relation schema
 *
 * This schema defines the polymorphic relationship between tags and entities.
 * It represents a many-to-many relationship where tags can be associated with
 * various entity types (Accommodation, Destination, User, Post, Event).
 */
export const EntityTagSchema = z.object({
    // Tag reference
    tagId: TagIdSchema,

    // Polymorphic entity reference
    entityId: z.union(
        [AccommodationIdSchema, DestinationIdSchema, UserIdSchema, PostIdSchema, EventIdSchema],
        {
            message: 'zodError.entityTag.entityId.required'
        }
    ),

    // Entity type discriminator
    entityType: EntityTypeEnumSchema
});

export type EntityTag = z.infer<typeof EntityTagSchema>;

/**
 * EntityTag array schema
 */
export const EntityTagsArraySchema = z.array(EntityTagSchema, {
    message: 'zodError.entityTags.required'
});
export type EntityTagsArray = z.infer<typeof EntityTagsArraySchema>;
