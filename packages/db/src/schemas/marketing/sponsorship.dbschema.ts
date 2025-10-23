import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { SponsorshipEntityTypePgEnum, SponsorshipStatusPgEnum } from '../enums.dbschema';
import { events } from '../event/event.dbschema';
import { posts } from '../post/post.dbschema';
import { users } from '../user/user.dbschema';

export const sponsorships = pgTable('sponsorships', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),

    // Polymorphic entity system (POST or EVENT)
    entityType: SponsorshipEntityTypePgEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(), // References either posts.id or events.id

    // Sponsorship period
    fromDate: timestamp('from_date', { withTimezone: true }),
    toDate: timestamp('to_date', { withTimezone: true }),
    status: SponsorshipStatusPgEnum('status').notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Admin metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>()
});

export const sponsorshipRelations = relations(sponsorships, ({ one }) => ({
    // Parent relations
    client: one(clients, {
        fields: [sponsorships.clientId],
        references: [clients.id]
    }),

    // Polymorphic entity relations (conditional based on entityType)
    post: one(posts, {
        fields: [sponsorships.entityId],
        references: [posts.id],
        relationName: 'sponsorships_for_post'
    }),
    event: one(events, {
        fields: [sponsorships.entityId],
        references: [events.id],
        relationName: 'sponsorships_for_event'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [sponsorships.createdById],
        references: [users.id],
        relationName: 'sponsorship_created_by'
    }),
    updatedBy: one(users, {
        fields: [sponsorships.updatedById],
        references: [users.id],
        relationName: 'sponsorship_updated_by'
    }),
    deletedBy: one(users, {
        fields: [sponsorships.deletedById],
        references: [users.id],
        relationName: 'sponsorship_deleted_by'
    })
}));
