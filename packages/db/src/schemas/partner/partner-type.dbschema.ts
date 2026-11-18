import type { AdminInfoType, I18nText, TranslationMeta } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { partners } from './partner.dbschema.ts';

/**
 * Partner types (HOS-2336): the admin-managed catalog that replaces the closed
 * `partner_type_enum`. A partner points at exactly one row through
 * `partners.type_id`.
 *
 * Same column set and conventions as `host_trade_category_groups` (HOS-919):
 * rows carry their own `nameI18n` content instead of resolving through
 * `@repo/i18n`, so an admin can add or rename a type without a redeploy. `slug`
 * is a machine identifier, immutable after creation (alliance leads store it),
 * and unique table-wide INCLUDING soft-deleted rows, so a deleted type keeps
 * its slug reserved until restored.
 */
export const partnerTypes = pgTable(
    'partner_types',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        slug: text('slug').notNull().unique(),
        nameI18n: jsonb('name_i18n').$type<I18nText>().notNull(),
        translationMeta: jsonb('translation_meta').$type<TranslationMeta>().default({}),
        /** Lower renders first; ties are broken by name. */
        displayWeight: integer('display_weight').notNull().default(50),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        partnerTypes_lifecycleState_idx: index('partnerTypes_lifecycleState_idx').on(
            table.lifecycleState
        )
    })
);

export const partnerTypesRelations = relations(partnerTypes, ({ many }) => ({
    partners: many(partners)
}));

/** Drizzle-inferred INSERT type for partner_types rows. */
export type InsertPartnerType = typeof partnerTypes.$inferInsert;

/** Drizzle-inferred SELECT type for partner_types rows. */
export type SelectPartnerType = typeof partnerTypes.$inferSelect;
