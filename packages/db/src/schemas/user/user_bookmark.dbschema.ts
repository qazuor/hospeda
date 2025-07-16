import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum, LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

export const userBookmarks: ReturnType<typeof pgTable> = pgTable('user_bookmarks', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    entityId: uuid('entity_id').notNull(),
    entityType: EntityTypePgEnum('entity_type').notNull(),
    name: text('name'),
    description: text('description'),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    user: one(users, {
        fields: [userBookmarks.userId],
        references: [users.id]
    })
}));
