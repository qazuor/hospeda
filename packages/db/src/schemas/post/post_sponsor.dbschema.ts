import type { AdminInfoType, ContactInfoType, ImageType, SocialNetworkType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ClientTypePgEnum, LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { postSponsorships } from './post_sponsorship.dbschema.ts';

export const postSponsors: ReturnType<typeof pgTable> = pgTable('post_sponsors', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: ClientTypePgEnum('type').notNull(),
    description: text('description').notNull(),
    logo: jsonb('logo').$type<ImageType>(),
    contactInfo: jsonb('contact_info').$type<ContactInfoType>(),
    socialNetworks: jsonb('social_networks').$type<SocialNetworkType>(),
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const postSponsorsRelations = relations(postSponsors, ({ many }) => ({
    sponsorships: many(postSponsorships)
}));
