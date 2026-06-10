/**
 * @file entity_comment.dbschema.ts
 *
 * Polymorphic comment storage for posts and events (SPEC-165). A single table
 * with an `(entityType, entityId)` polymorphic foreign-key pair, mirroring the
 * `user_bookmarks` precedent. The column accepts the full `EntityTypePgEnum`,
 * but the `EntityCommentService` validates and rejects any value outside
 * `POST | EVENT` (see SPEC-165 RD-3).
 *
 * **Author nullability**: `author_id` is NULLABLE with `ON DELETE SET NULL`.
 * "Registered users only" (RD-5) is enforced at the service layer (the actor
 * id is always set on create). When a user is deleted, their comments remain
 * with a null author, surfaced as "[Usuario eliminado]" in the response DTO
 * (SPEC-165 risk R6). A NOT NULL column combined with ON DELETE SET NULL is
 * impossible in Postgres, so the nullable form is the only one that satisfies
 * both the soft-delete-cascade requirement and the registered-users guarantee.
 *
 * Soft-delete via `deletedAt`. The `set_updated_at` trigger attaches
 * automatically (it targets every table with an `updated_at` column) when
 * `apply-postgres-extras.mjs` runs after a schema push. See SPEC-165 §4.1.
 */
import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum, ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

export const entityComments = pgTable(
    'entity_comments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        entityType: EntityTypePgEnum('entity_type').notNull(),
        entityId: uuid('entity_id').notNull(),
        /**
         * Comment author. Nullable so the FK can SET NULL when the user is
         * deleted, preserving the comment. The service guarantees a non-null
         * actor id on create (RD-5: registered users only).
         */
        authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
        content: text('content').notNull(),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('APPROVED'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Compound index supporting the public per-entity comment thread query
         * (filter by entity, exclude soft-deleted) and the admin per-entity
         * listings. Mirrors `idx_user_bookmarks_entity_active`. SPEC-165 §4.1.
         */
        entityActiveIdx: index('idx_entity_comments_entity_active').on(
            table.entityId,
            table.entityType,
            table.deletedAt
        )
    })
);

export const entityCommentsRelations = relations(entityComments, ({ one }) => ({
    author: one(users, {
        fields: [entityComments.authorId],
        references: [users.id]
    })
}));
