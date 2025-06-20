import type {
    AdminInfoType,
    ContactInfoType,
    EventDateType,
    EventPriceType,
    MediaType,
    SeoType
} from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    EventCategoryPgEnum,
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { rEntityTag } from '../tag/r_entity_tag.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { eventLocations } from './event_location.dbschema.ts';
import { eventOrganizers } from './event_organizer.dbschema.ts';

export const events: ReturnType<typeof pgTable> = pgTable(
    'events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        name: text('name').notNull(),
        summary: text('summary').notNull(),
        description: text('description'),
        media: jsonb('media').$type<MediaType>(),
        category: EventCategoryPgEnum('category').notNull(),
        date: jsonb('date').$type<EventDateType>().notNull(),
        authorId: uuid('author_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        locationId: uuid('location_id').references(() => eventLocations.id, {
            onDelete: 'set null'
        }),
        organizerId: uuid('organizer_id').references(() => eventOrganizers.id, {
            onDelete: 'set null'
        }),
        pricing: jsonb('pricing').$type<EventPriceType>(),
        contact: jsonb('contact').$type<ContactInfoType>(),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        isFeatured: boolean('is_featured').notNull().default(false),
        lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        seo: jsonb('seo').$type<SeoType>()
    },
    (table) => ({
        events_isFeatured_idx: index('events_isFeatured_idx').on(table.isFeatured),
        events_visibility_idx: index('events_visibility_idx').on(table.visibility),
        events_lifecycle_idx: index('events_lifecycle_idx').on(table.lifecycle),
        events_category_idx: index('events_category_idx').on(table.category),
        events_visibility_isFeatured_idx: index('events_visibility_isFeatured_idx').on(
            table.visibility,
            table.isFeatured
        ),
        events_category_visibility_idx: index('events_category_visibility_idx').on(
            table.category,
            table.visibility
        )
    })
);

export const eventsRelations = relations(events, ({ one, many }) => ({
    author: one(users, {
        fields: [events.authorId],
        references: [users.id]
    }),
    createdBy: one(users, {
        fields: [events.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [events.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [events.deletedById],
        references: [users.id]
    }),
    location: one(eventLocations, {
        fields: [events.locationId],
        references: [eventLocations.id]
    }),
    organizer: one(eventOrganizers, {
        fields: [events.organizerId],
        references: [eventOrganizers.id]
    }),
    tags: many(rEntityTag)
}));
