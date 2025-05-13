import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from './enums.dbschema';
import { tags } from './tag.dbschema';

/**
 * Join table mapping arbitrary entities to tags.
 * Uses a composite primary key on (entity_type, entity_id, tag_id).
 */
export const entityTagRelations: ReturnType<typeof pgTable> = pgTable(
    'r_entity_tag',
    {
        /** The type of the entity being tagged (e.g. 'ACCOMMODATION', 'POST', etc.) */
        entityType: EntityTypePgEnum('entity_type').notNull(),

        /** UUID of the entity being tagged */
        entityId: uuid('entity_id').notNull(),

        /** UUID of the tag */
        tagId: uuid('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.entityType, table.entityId, table.tagId] })
    })
);
