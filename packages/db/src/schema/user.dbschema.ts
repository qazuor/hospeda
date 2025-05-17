import type {
    AdminInfoType,
    ContactInfoType,
    FullLocationType,
    SocialNetworkType,
    UserProfile,
    UserSettingsType
} from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { userBookmarks } from './bookmark.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { permissions } from './permission.dbschema.js';
import { userPermissions } from './r_user_permission.dbschema.js';
import { roles } from './role.dbschema.js';

/**
 * users table schema
 */
export const users: ReturnType<typeof pgTable> = pgTable(
    'users',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: name (e.g. username display) */
        name: text('name').notNull(),

        /** BaseEntity: display name (full name, etc.) */
        displayName: text('display_name').notNull(),

        /** Unique login username */
        userName: text('user_name'),
        /** Hashed password */
        passwordHash: text('password_hash').notNull(),

        /** Optional fields for profile */
        firstName: text('first_name'),
        lastName: text('last_name'),
        brithDate: timestamp('brith_date', { withTimezone: true }),

        /** Audit & state fields */
        state: StatePgEnum('state').default('ACTIVE').notNull(),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Contact, location, social JSONB blobs */
        contactInfo: jsonb('contact_info').$type<ContactInfoType>(),
        location: jsonb('location').$type<FullLocationType>(),
        socialNetworks: jsonb('social_networks').$type<SocialNetworkType[]>(),

        /** Verification flags */
        emailVerified: boolean('email_verified').default(false).notNull(),
        phoneVerified: boolean('phone_verified').default(false).notNull(),

        /** Profile & settings JSON */
        profile: jsonb('profile').$type<UserProfile>(),
        settings: jsonb('settings').$type<UserSettingsType>().notNull(),

        /** Role-based access control */
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),

        /** Timestamps and soft-delete audit */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Ensure unique usernames */
        uniqueUserName: uniqueIndex('users_user_name_key').on(table.userName)
    })
);

/**
 * Relations for users table
 */
export const usersRelations = relations(users, ({ one, many }) => ({
    /** User role */
    role: one(roles, {
        fields: [users.roleId],
        references: [roles.id]
    }),
    /** Who created this user */
    createdBy: one(users, {
        fields: [users.createdById],
        references: [users.id]
    }),
    /** Who last updated this user */
    updatedBy: one(users, {
        fields: [users.updatedById],
        references: [users.id]
    }),
    /** Who soft-deleted this user */
    deletedBy: one(users, {
        fields: [users.deletedById],
        references: [users.id]
    }),
    /** Bookmarks made by this user */
    bookmarks: many(userBookmarks),

    // Join‐table N→M; specify the join‐table name:
    userPermissions: many(userPermissions),
    // Short‐cut to Permission via that join:
    permissions: many(permissions, { relationName: 'r_user_permission' })
}));
