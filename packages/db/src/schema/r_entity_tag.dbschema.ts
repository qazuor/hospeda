import { relations } from 'drizzle-orm';
import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from './enums.dbschema';
import { tags } from './tag.dbschema';

/**
 * r_entity_tag join table
 * Maps any entity (accommodation, destination, event, post, user) to tags.
 * Composite PK on (entity_type, entity_id, tag_id).
 */
export const entityTagRelations = pgTable(
    'r_entity_tag',
    {
        /** The type of entity being tagged */
        entityType: EntityTypePgEnum('entity_type').notNull(),

        /** The ID of the tagged entity */
        entityId: uuid('entity_id').notNull(),

        /** FK to tags.id */
        tagId: uuid('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' })
    },
    (table) => ({
        /** Composite primary key to enforce uniqueness */
        pk: primaryKey({ columns: [table.entityType, table.entityId, table.tagId] })
    })
);

/**
 * Relations for r_entity_tag table
 */
export const entityTagRelationsRelations = relations(entityTagRelations, ({ one }) => ({
    /** The tag */
    tag: one(tags)
}));
