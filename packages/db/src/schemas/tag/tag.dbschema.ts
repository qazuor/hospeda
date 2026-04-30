import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, TagColorPgEnum, TagTypePgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rEntityTag } from './r_entity_tag.dbschema.ts';

/**
 * Tags table — User-Tag subsystem.
 *
 * Stores INTERNAL (admin-only operational labels), SYSTEM (available to any authenticated user),
 * and USER (per-user personal tags) typed tags. PostTags are a separate table (post_tags).
 *
 * Invariants enforced at service layer:
 *   - type = USER  ⇒  ownerId IS NOT NULL
 *   - type IN (INTERNAL, SYSTEM)  ⇒  ownerId IS NULL
 *
 * Cross-type name collisions (e.g. USER vs SYSTEM with the same name) are rejected by the
 * service with a 409 conflict; they are not enforced by a DB constraint.
 *
 * Partial unique indexes guarantee uniqueness within each type bucket:
 *   - INTERNAL: unique name globally among INTERNAL tags.
 *   - SYSTEM: unique name globally among SYSTEM tags.
 *   - USER: unique (ownerId, name) pair among USER tags.
 */
export const tags = pgTable(
    'tags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        color: TagColorPgEnum('color').notNull(),
        icon: text('icon'),
        description: text('description'),
        type: TagTypePgEnum('type').notNull(),
        ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Partial unique index: INTERNAL tags have unique names globally within their type.
         */
        tags_internal_name_idx: uniqueIndex('tags_internal_name_idx')
            .on(table.name)
            .where(sql`"type" = 'INTERNAL'`),
        /**
         * Partial unique index: SYSTEM tags have unique names globally within their type.
         */
        tags_system_name_idx: uniqueIndex('tags_system_name_idx')
            .on(table.name)
            .where(sql`"type" = 'SYSTEM'`),
        /**
         * Partial unique index: USER tags are unique per owner per name within USER type.
         */
        tags_user_name_idx: uniqueIndex('tags_user_name_idx')
            .on(table.ownerId, table.name)
            .where(sql`"type" = 'USER'`),
        /**
         * Non-unique index: speeds up filtering by tag type.
         */
        tags_type_idx: index('tags_type_idx').on(table.type),
        /**
         * Non-unique index: speeds up queries scoped to a specific owner (USER tags).
         */
        tags_owner_id_idx: index('tags_owner_id_idx').on(table.ownerId),
        /**
         * Non-unique index: speeds up filtering by lifecycle state (picker shows only ACTIVE).
         */
        tags_lifecycle_idx: index('tags_lifecycle_idx').on(table.lifecycleState)
    })
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
    owner: one(users, {
        fields: [tags.ownerId],
        references: [users.id]
    }),
    entityTags: many(rEntityTag)
}));

/** Inferred select type for the tags table. */
export type SelectTag = typeof tags.$inferSelect;

/** Inferred insert type for the tags table. */
export type InsertTag = typeof tags.$inferInsert;
