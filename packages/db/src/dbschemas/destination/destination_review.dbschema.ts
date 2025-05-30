import type { DestinationRatingType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { destinations } from './destination.dbschema.ts';

export const destinationReviews: ReturnType<typeof pgTable> = pgTable(
    'destination_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),
        title: text('title'),
        content: text('content'),
        rating: jsonb('rating').$type<DestinationRatingType>().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        destination_reviews_destinationId_idx: index('destination_reviews_destinationId_idx').on(
            table.destinationId
        ),
        destination_reviews_userId_idx: index('destination_reviews_userId_idx').on(table.userId)
    })
);

export const destinationReviewsRelations = relations(destinationReviews, ({ one }) => ({
    destination: one(destinations, {
        fields: [destinationReviews.destinationId],
        references: [destinations.id]
    }),
    user: one(users, {
        fields: [destinationReviews.userId],
        references: [users.id]
    })
}));
