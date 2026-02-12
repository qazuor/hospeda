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
 * Para obtener la entidad relacionada, filtra por entityType y haz la query correspondiente:
 *
 * Ejemplo:
 *   - Para obtener los tags de un accommodation:
 *     db.query.rEntityTag.findMany({
 *       where: (r, { eq }) => eq(r.entityType, 'ACCOMMODATION') && eq(r.entityId, accommodationId)
 *     })
 *   - Para obtener la entidad desde rEntityTag:
 *     if (entityType === 'ACCOMMODATION') => busca en accommodations por entityId
 *     if (entityType === 'DESTINATION') => busca en destinations por entityId
 *     ...
 *
 * Puedes crear helpers de typescript para automatizar este patrón en tu código de acceso a datos.
 */
