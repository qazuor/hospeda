import type { AdminInfoType, BasePriceType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { posts } from './post.dbschema.ts';
import { postSponsors } from './post_sponsor.dbschema.ts';

export const postSponsorships: ReturnType<typeof pgTable> = pgTable('post_sponsorships', {
    id: uuid('id').primaryKey().defaultRandom(),
    sponsorId: uuid('sponsor_id')
        .notNull()
        .references(() => postSponsors.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
        .notNull()
        .references(() => posts.id, { onDelete: 'cascade' }),
    message: text('message'),
    description: text('description').notNull(),
    paid: jsonb('paid').$type<BasePriceType>().notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    fromDate: timestamp('from_date', { withTimezone: true }),
    toDate: timestamp('to_date', { withTimezone: true }),
    isHighlighted: boolean('is_highlighted').notNull().default(false),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const postSponsorshipsRelations = relations(postSponsorships, ({ one }) => ({
    post: one(posts, {
        fields: [postSponsorships.postId],
        references: [posts.id]
    }),
    sponsor: one(postSponsors, {
        fields: [postSponsorships.sponsorId],
        references: [postSponsors.id]
    })
}));
