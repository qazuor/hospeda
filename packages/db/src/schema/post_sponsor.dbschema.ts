import type { AdminInfoType, ContactInfoType, SocialNetworkType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { ClientTypePgEnum, StatePgEnum } from './enums.dbschema';
import { postSponsorships } from './post_sponsorship.dbschema';
import { users } from './user.dbschema';

/**
 * post_sponsors table schema
 */
export const postSponsors: ReturnType<typeof pgTable> = pgTable(
    'post_sponsors',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Internal name */
        name: text('name').notNull(),

        /** Display name for UI */
        displayName: text('display_name').notNull(),

        /** Type of client (ADVERTISER, POST_SPONSOR, etc.) */
        type: ClientTypePgEnum('type').notNull(),

        /** Description of the sponsor */
        description: text('description').notNull(),

        /** Logo URL or asset reference */
        logo: text('logo'),

        /** Social networks JSONB */
        social: jsonb('social').$type<SocialNetworkType>(),

        /** Contact info JSONB */
        contact: jsonb('contact').$type<ContactInfoType>(),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

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
        /** Enforce unique sponsor names */
        uniqueSponsorName: uniqueIndex('post_sponsors_name_key').on(table.name)
    })
);

/**
 * Relations for post_sponsors table
 */
export const postSponsorsRelations = relations(postSponsors, ({ one, many }) => ({
    /** Who created this sponsor */
    createdBy: one(users),

    /** Who last updated this sponsor */
    updatedBy: one(users),

    /** Who soft-deleted this sponsor */
    deletedBy: one(users),

    /** Sponsorship records for this sponsor */
    sponsorships: many(postSponsorships)
}));
