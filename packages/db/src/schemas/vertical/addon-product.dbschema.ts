import { VerticalEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    integer,
    pgTable,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { addons, addonVersions } from './addon-catalog.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

export const ADDON_CHARGE_KINDS = ['UNA_VEZ', 'PERIODICO'] as const;
export const ADDON_CYCLES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export const ADDON_INSTANCE_STATUSES = [
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'ABANDONED',
    'EXPIRED',
    'CANCELLED'
] as const;

/**
 * Saleable addon product with a required FK to its version, positive ARS price
 * and at least one compatible vertical (AC:B3:29; ESQ:8). A periodic product
 * requires a billing cycle; a one-time product has none (DJ).
 */
export const addonProducts = pgTable(
    'addon_product',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** versión */
        versionId: uuid('version_id')
            .notNull()
            .references(() => addonVersions.id),
        addonId: uuid('addon_id')
            .notNull()
            .references(() => addons.id),
        /** precio */
        price: integer('price').notNull(),
        /** moneda */
        currency: varchar('currency', { length: 3 }).notNull(),
        /** tipo de cobro */
        chargeKind: varchar('charge_kind', { length: 16 }).notNull(),
        /** ciclo */
        cycle: varchar('cycle', { length: 16 }),
        /** verticales compatibles */
        compatibleVerticals: varchar('compatible_verticals', { length: 32 }).array().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        versionAddonFk: foreignKey({
            name: 'fk_addon_product_version_addon',
            columns: [t.versionId, t.addonId],
            foreignColumns: [addonVersions.id, addonVersions.addonId]
        }),
        priceCheck: check('ck_addon_product_price', sql`${t.price} > 0`),
        currencyCheck: check('ck_addon_product_currency', sql`${t.currency} = 'ARS'`),
        chargeKindCheck: check(
            'ck_addon_product_charge_kind',
            sql`${t.chargeKind} IN (${quotedList(ADDON_CHARGE_KINDS)})`
        ),
        cycleCheck: check(
            'ck_addon_product_cycle',
            sql`(${t.chargeKind} = 'PERIODICO') = (${t.cycle} IS NOT NULL) AND (${t.cycle} IS NULL OR ${t.cycle} IN (${quotedList(ADDON_CYCLES)}))`
        ),
        verticalsCheck: check(
            'ck_addon_product_compatible_verticals',
            sql`cardinality(${t.compatibleVerticals}) >= 1 AND ${t.compatibleVerticals} <@ ARRAY[${quotedList(Object.values(VerticalEnum))}]::varchar[]`
        )
    })
);

/**
 * Acquired addon anchored to its product and version at purchase (AC:B3:29; ESQ:8).
 * FKs identify its product, version, owner and optional complement subscription;
 * the polymorphic target has no FK. Purchase identity is unique for pending or
 * active complemented rows, including rows with a null target; order IDs are unique.
 */
export const addonInstances = pgTable(
    'addon_instance',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** producto */
        productId: uuid('product_id')
            .notNull()
            .references(() => addonProducts.id),
        /** versión anclada */
        addonVersionId: uuid('addon_version_id')
            .notNull()
            .references(() => addonVersions.id),
        /** dueño */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id),
        /** objetivo */
        targetId: uuid('target_id'),
        /** estado */
        status: varchar('status', { length: 32 }).notNull(),
        /** inicio */
        startsAt: timestamp('starts_at', { withTimezone: true }),
        /** fin */
        endsAt: timestamp('ends_at', { withTimezone: true }),
        /** suscripción de complemento */
        complementSubscriptionId: uuid('complement_subscription_id').references(
            () => subscriptions.id
        ),
        /** pedido */
        orderRequestId: varchar('order_request_id', { length: 64 }),
        /** id de la orden */
        providerOrderId: varchar('provider_order_id', { length: 64 }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        statusCheck: check(
            'ck_addon_instance_status',
            sql`${t.status} IN (${quotedList(ADDON_INSTANCE_STATUSES)})`
        ),
        complementUnique: unique('uq_addon_instance_complement').on(t.complementSubscriptionId),
        orderRequestUnique: unique('uq_addon_instance_order_request').on(t.orderRequestId),
        providerOrderUnique: unique('uq_addon_instance_provider_order').on(t.providerOrderId),
        purchaseIdentity: uniqueIndex('uq_addon_instance_purchase_identity')
            .on(
                t.ownerId,
                t.productId,
                sql`coalesce(${t.targetId}, '00000000-0000-0000-0000-000000000000'::uuid)`
            )
            .where(
                sql`${t.status} = 'PENDING_AUTHORIZATION' OR (${t.status} = 'ACTIVE' AND ${t.complementSubscriptionId} IS NOT NULL)`
            )
    })
);

/** Insert shape for an addon product. */
export type InsertAddonProduct = typeof addonProducts.$inferInsert;
/** Select shape for an addon product. */
export type SelectAddonProduct = typeof addonProducts.$inferSelect;
/** Insert shape for an addon instance. */
export type InsertAddonInstance = typeof addonInstances.$inferInsert;
/** Select shape for an addon instance. */
export type SelectAddonInstance = typeof addonInstances.$inferSelect;
