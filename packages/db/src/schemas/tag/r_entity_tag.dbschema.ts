import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from '../enums.dbschema.ts';
import { tags } from './tag.dbschema.ts';

export const rEntityTag = pgTable(
    'r_entity_tag',
    {
        tagId: uuid('tag_id')
            .notNull()
            .references(() => tags.id, { onDelete: 'cascade' }),
        entityId: uuid('entity_id').notNull(),
        entityType: EntityTypePgEnum('entity_type').notNull()
    },
    (table) => ({
        pk: primaryKey({ columns: [table.tagId, table.entityId, table.entityType] }),
        entityType_entityId_idx: index('entityType_entityId_idx').on(
            table.entityType,
            table.entityId
        ),
        tagId_idx: index('r_entity_tag_tagId_idx').on(table.tagId)
    })
);

export const rEntityTagRelations = relations(rEntityTag, ({ one }) => ({
    tag: one(tags, {
        fields: [rEntityTag.tagId],
        references: [tags.id]
    })
}));

/**
 * Polymorphic relations helper (Drizzle does NOT support native polymorphic relations).
 *
 * To get the related entity, filter by entityType and run the corresponding query:
 *
 * Example:
 *   - To get the tags of an accommodation:
 *     db.query.rEntityTag.findMany({
 *       where: (r, { eq }) => eq(r.entityType, 'ACCOMMODATION') && eq(r.entityId, accommodationId)
 *     })
 *   - To get the entity from rEntityTag:
 *     if (entityType === 'ACCOMMODATION') => look up in accommodations by entityId
 *     if (entityType === 'DESTINATION') => look up in destinations by entityId
 *     ...
 *
 * You can create TypeScript helpers to automate this pattern in your data access code.
 */
