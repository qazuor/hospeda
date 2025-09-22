import type {
    AdminInfoType,
    ContactInfo,
    FullLocationType,
    SocialNetwork,
    UserProfile,
    UserSettings
} from '@repo/schemas';
import { AuthProviderEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { destinations } from '../destination/destination.dbschema.ts';
import { LifecycleStatusPgEnum, RolePgEnum, VisibilityPgEnum } from '../enums.dbschema.ts';
import { events } from '../event/event.dbschema.ts';
import { eventLocations } from '../event/event_location.dbschema.ts';
import { eventOrganizers } from '../event/event_organizer.dbschema.ts';
import { posts } from '../post/post.dbschema.ts';
import { postSponsors } from '../post/post_sponsor.dbschema.ts';
import { postSponsorships } from '../post/post_sponsorship.dbschema.ts';
import { tags } from '../tag/tag.dbschema.ts';
import { userPermission } from './r_user_permission.dbschema.ts';
import { userBookmarks } from './user_bookmark.dbschema.ts';
import { userAuthIdentities } from './user_identity.dbschema.ts';

export const users: ReturnType<typeof pgTable> = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        authProvider: text('auth_provider')
            .$type<AuthProviderEnum>()
            .default(AuthProviderEnum.CLERK),
        authProviderUserId: text('auth_provider_user_id'),
        displayName: text('display_name'),
        firstName: text('first_name'),
        lastName: text('last_name'),
        birthDate: timestamp('birth_date', { withTimezone: true }),
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        location: jsonb('location').$type<FullLocationType>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        role: RolePgEnum('role').notNull(),
        profile: jsonb('profile').$type<UserProfile>(),
        settings: jsonb('settings').$type<UserSettings>().notNull(),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table: typeof users) => ({
        uniqueSlug: uniqueIndex('users_slug_key').on(table.slug),
        uniqueAuthProvider: uniqueIndex('users_auth_provider_user_id_key').on(
            table.authProvider,
            table.authProviderUserId
        )
    })
);

export const usersRelations = relations(users, ({ many }) => ({
    permissions: many(userPermission),
    bookmarks: many(userBookmarks),
    authIdentities: many(userAuthIdentities),
    updatedAccommodations: many(accommodations),
    deletedAccommodations: many(accommodations),
    updatedDestinations: many(destinations),
    deletedDestinations: many(destinations),
    updatedPosts: many(posts),
    deletedPosts: many(posts),
    updatedEvents: many(events),
    deletedEvents: many(events),
    updatedTags: many(tags),
    deletedTags: many(tags),
    updatedPostSponsors: many(postSponsors),
    deletedPostSponsors: many(postSponsors),
    updatedPostSponsorships: many(postSponsorships),
    deletedPostSponsorships: many(postSponsorships),
    updatedEventLocations: many(eventLocations),
    deletedEventLocations: many(eventLocations),
    updatedEventOrganizers: many(eventOrganizers),
    deletedEventOrganizers: many(eventOrganizers)
}));
