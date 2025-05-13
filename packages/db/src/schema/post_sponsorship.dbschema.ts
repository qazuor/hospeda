import type { BasePriceType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { posts } from './post.dbschema';
import { postSponsors } from './post_sponsor.dbschema';
import { users } from './user.dbschema';

/**
 * post_sponsorships table schema
 */
export const postSponsorships: ReturnType<typeof pgTable> = pgTable(
    'post_sponsorships',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Sponsor reference */
        sponsorId: uuid('sponsor_id')
            .notNull()
            .references(() => postSponsors.id, { onDelete: 'cascade' }),

        /** Post reference */
        postId: uuid('post_id')
            .notNull()
            .references(() => posts.id, { onDelete: 'cascade' }),

        /** Sponsor’s message for this post */
        message: text('message').notNull(),

        /** Additional description */
        description: text('description').notNull(),

        /** Paid amount and currency */
        paid: jsonb('paid').$type<BasePriceType>().notNull(),

        /** Timestamp when payment was made */
        paidAt: timestamp('paid_at', { withTimezone: true }),

        /** Sponsorship start date */
        fromDate: timestamp('from_date', { withTimezone: true }),

        /** Sponsorship end date */
        toDate: timestamp('to_date', { withTimezone: true }),

        /** Whether this sponsorship is highlighted */
        isHighlighted: boolean('is_highlighted').default(false).notNull(),

        /** Audit & soft-delete timestamps */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, {
            onDelete: 'set null'
        })
    },
    (table) => ({
        /** Prevent duplicate sponsorships by same sponsor on same post */
        uniqueSponsorPost: uniqueIndex('post_sponsorships_sponsor_post_key').on(
            table.sponsorId,
            table.postId
        )
    })
);

/**
 * Relations for post_sponsorships table
 */
export const postSponsorshipsRelations = relations(postSponsorships, ({ one }) => ({
    /** The sponsoring client */
    sponsor: one(postSponsors),

    /** The post being sponsored */
    post: one(posts),

    /** Audit: who created */
    createdBy: one(users),

    /** Audit: who updated */
    updatedBy: one(users),

    /** Audit: who soft-deleted */
    deletedBy: one(users)
}));
