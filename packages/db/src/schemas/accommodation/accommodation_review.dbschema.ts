import type { AccommodationRatingType, AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { accommodations } from './accommodation.dbschema.ts';

export const accommodationReviews: ReturnType<typeof pgTable> = pgTable(
    'accommodation_reviews',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'set null' }),
        title: text('title'),
        content: text('content'),
        rating: jsonb('rating').$type<AccommodationRatingType>().notNull(),
        lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        accommodation_reviews_accommodationId_idx: index(
            'accommodation_reviews_accommodationId_idx'
        ).on(table.accommodationId),
        accommodation_reviews_userId_idx: index('accommodation_reviews_userId_idx').on(table.userId)
    })
);

export const accommodationReviewsRelations = relations(accommodationReviews, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationReviews.accommodationId],
        references: [accommodations.id]
    }),
    user: one(users, {
        fields: [accommodationReviews.userId],
        references: [users.id]
    })
}));
