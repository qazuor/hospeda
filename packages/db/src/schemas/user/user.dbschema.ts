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
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
    boolean,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import { accommodations } from '../accommodation/accommodation.dbschema.ts';
import { destinations } from '../destination/destination.dbschema.ts';
import {
    LifecycleStatusPgEnum,
    ModerationStatusPgEnum,
    RolePgEnum,
    VisibilityPgEnum
} from '../enums.dbschema.ts';
import { events } from '../event/event.dbschema.ts';
import { eventLocations } from '../event/event_location.dbschema.ts';
import { eventOrganizers } from '../event/event_organizer.dbschema.ts';
import { posts } from '../post/post.dbschema.ts';
import { postSponsors } from '../post/post_sponsor.dbschema.ts';
import { postSponsorships } from '../post/post_sponsorship.dbschema.ts';
import { tags } from '../tag/tag.dbschema.ts';
import { accounts } from './account.dbschema.ts';
import { userPermission } from './r_user_permission.dbschema.ts';
import { sessions } from './session.dbschema.ts';
import { userBookmarks } from './user_bookmark.dbschema.ts';
import { userBookmarkCollections } from './user_bookmark_collection.dbschema.ts';
import { userAuthIdentities } from './user_identity.dbschema.ts';

export const users = pgTable(
    'users',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug')
            .notNull()
            .unique()
            .$defaultFn(() => `user-${crypto.randomUUID().slice(0, 8)}`),
        /** Better Auth required: user email address */
        email: text('email').notNull().unique(),
        /** Better Auth required: email verification status */
        emailVerified: boolean('email_verified').notNull().default(false),
        /** Better Auth required: avatar/profile image URL */
        image: text('image'),
        /**
         * Cloudinary public ID for the user avatar.
         * Satellite column: mirrors the Cloudinary public_id so that
         * _afterHardDelete can delete the asset directly without URL parsing.
         * Null for users without an uploaded avatar or with legacy rows.
         */
        imagePublicId: text('image_public_id'),
        /**
         * Moderation state of the user avatar image.
         * Satellite column: mirrors moderationState from Cloudinary image metadata.
         * Typed as moderation_status_enum for index-friendly dashboard queries.
         */
        imageModerationState: ModerationStatusPgEnum('image_moderation_state'),
        /**
         * Optional human-readable caption for the user avatar.
         * Satellite column: stored alongside the image URL for display purposes.
         */
        imageCaption: text('image_caption'),
        /** Better Auth Admin plugin: whether user is banned */
        banned: boolean('banned').default(false),
        /** Better Auth Admin plugin: reason for ban */
        banReason: text('ban_reason'),
        /** Better Auth Admin plugin: ban expiration date */
        banExpires: timestamp('ban_expires', { withTimezone: true }),
        /**
         * @deprecated Legacy field from Clerk migration. New users get BETTER_AUTH.
         * Provider identity is now tracked in the `account` table (Better Auth).
         */
        authProvider: text('auth_provider')
            .$type<AuthProviderEnum>()
            .default(AuthProviderEnum.BETTER_AUTH),
        authProviderUserId: text('auth_provider_user_id'),
        displayName: text('display_name'),
        firstName: text('first_name'),
        lastName: text('last_name'),
        birthDate: timestamp('birth_date', { withTimezone: true }),
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        location: jsonb('location').$type<FullLocationType>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetwork>(),
        role: RolePgEnum('role').notNull().default('USER'),
        profile: jsonb('profile').$type<UserProfile>(),
        settings: jsonb('settings')
            .$type<UserSettings>()
            .notNull()
            .default({
                notifications: {
                    enabled: true,
                    allowEmails: true,
                    allowSms: false,
                    allowPush: false
                }
            }),
        visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        /**
         * SPEC-113: Whether the user has completed the post-signup profile
         * completion form. New users default to FALSE and are funneled into
         * `/[lang]/mi-cuenta/completar-perfil/` by middleware until they
         * submit. Admin/SuperAdmin roles bypass the check (see spec §3.5).
         */
        profileCompleted: boolean('profile_completed').notNull().default(false),
        /**
         * SPEC-113 §3.6: One-shot flag tracking whether an OAuth-only user
         * has been prompted to set a password. Flips TRUE when the user
         * either submits the set-password form OR skips it. Backfilled to
         * TRUE for any user that already has a `credential` account row.
         */
        setPasswordPrompted: boolean('set_password_prompted').notNull().default(false),
        /**
         * SPEC-143 #29: canonical service-suspension flag. True when the host's
         * subscription is paused WITH service suspension (host self-pause or an
         * admin "full" pause). While true, the host's accommodations are hidden
         * from public reads and locked from edits/creates. Cleared on resume.
         * Denormalized to accommodations.owner_suspended for the public hot path;
         * this column is the source of truth and is used for the create-guard
         * (where no accommodation row exists yet to read).
         */
        serviceSuspended: boolean('service_suspended').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references((): AnyPgColumn => users.id, {
            onDelete: 'set null'
        }),
        updatedById: uuid('updated_by_id').references((): AnyPgColumn => users.id, {
            onDelete: 'set null'
        }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references((): AnyPgColumn => users.id, {
            onDelete: 'set null'
        })
    },
    (table) => ({
        uniqueSlug: uniqueIndex('users_slug_key').on(table.slug),
        uniqueAuthProvider: uniqueIndex('users_auth_provider_user_id_key').on(
            table.authProvider,
            table.authProviderUserId
        ),
        /** Index on role for filtering users by role */
        users_role_idx: index('users_role_idx').on(table.role),
        /** Index on lifecycleState for filtering users by state */
        users_lifecycleState_idx: index('users_lifecycleState_idx').on(table.lifecycleState),
        /** Index on visibility for filtering users by visibility */
        users_visibility_idx: index('users_visibility_idx').on(table.visibility),
        /** Index on deletedAt for soft delete filtering (very common) */
        users_deletedAt_idx: index('users_deletedAt_idx').on(table.deletedAt),
        /** Index on createdAt for sorting by creation date */
        users_createdAt_idx: index('users_createdAt_idx').on(table.createdAt),
        /** Composite index for listing active users by role */
        users_role_deletedAt_idx: index('users_role_deletedAt_idx').on(table.role, table.deletedAt),
        /** Composite index for listing active users by lifecycle state */
        users_lifecycleState_deletedAt_idx: index('users_lifecycleState_deletedAt_idx').on(
            table.lifecycleState,
            table.deletedAt
        ),
        /** Index on imageModerationState for moderation dashboard queries */
        users_image_moderation_state_idx: index('users_image_moderation_state_idx').on(
            table.imageModerationState
        )
    })
);

export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
    accounts: many(accounts),
    permissions: many(userPermission),
    bookmarks: many(userBookmarks),
    collections: many(userBookmarkCollections),
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
