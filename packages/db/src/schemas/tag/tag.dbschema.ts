import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, TagColorPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rEntityTag } from './r_entity_tag.dbschema.ts';

export const tags: ReturnType<typeof pgTable> = pgTable(
    'tags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        color: TagColorPgEnum('color').notNull(),
        icon: text('icon'),
        notes: text('notes'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        tags_lifecycle_idx: index('tags_lifecycle_idx').on(table.lifecycleState)
    })
);

export const tagsRelations = relations(tags, ({ many }) => ({
    entityTags: many(rEntityTag)
}));
