import type { ImageAttribution } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';
import { ModerationStatusPgEnum } from '../enums.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * PostgreSQL enum for the visibility state of a single gastronomy media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery and is waiting to be restored.
 *               `is_featured` MUST be false when state is `archived` (enforced by
 *               the extras-carril CHECK constraint).
 *
 * Mirrors `AccommodationMediaStatePgEnum` deliberately. No commerce flow archives
 * photos today — the commerce plan carries `limits: []`, so there is no
 * downgrade-over-limit remediation like the accommodation one (SPEC-167). The
 * state is modeled anyway so all three verticals share ONE table shape and can
 * therefore share one composition/service implementation instead of diverging
 * (HOS-372 owner decision, 2026-08-02).
 */
export const GastronomyMediaStatePgEnum = pgEnum('gastronomy_media_state_enum', [
    'visible',
    'archived'
]);

/**
 * `gastronomy_media` — relational table for gastronomy listing gallery photos.
 *
 * Replaces the JSONB `gastronomies.media.gallery` / `media.featuredImage` sub-fields
 * with a proper per-row structure. Videos live in the dedicated `gastronomies.videos`
 * JSONB column, NOT here: a video is an external YouTube/Vimeo URL, not an uploaded
 * asset, so it cannot be orphaned and gains nothing from a relational row (HOS-372).
 *
 * Why this table exists at all: the upload endpoint persists the FILE immediately but
 * the association used to wait for the form's Save, so an owner who uploaded photos and
 * left without saving lost them while the asset kept billing in Cloudinary. A row per
 * photo is what lets every add/remove/set-featured call persist on its own.
 *
 * Structure mirrors `accommodation_media` exactly, including `state`/`archived_at`.
 *
 * @see packages/db/src/schemas/accommodation/accommodation_media.dbschema.ts
 * @see packages/schemas/src/common/media.schema.ts for the `ImageSchema` this mirrors
 */
export const gastronomyMedia = pgTable(
    'gastronomy_media',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the owning gastronomy listing. ON DELETE CASCADE ensures photo rows are
         * removed by the DATABASE when the listing is hard-deleted — integrity guaranteed
         * by the schema rather than by a check someone has to remember to write.
         */
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        /**
         * Full public URL of the photo (e.g. a Cloudinary delivery URL or an external
         * CDN URL). Mirrors `ImageSchema.url`. Required — every media row must have a URL.
         */
        url: text('url').notNull(),
        /**
         * Short display caption for the photo (max 100 chars in Zod).
         * Mirrors `ImageSchema.caption`. Nullable because not all uploads include one.
         */
        caption: text('caption'),
        /**
         * Longer description of the photo content (max 300 chars in Zod).
         * Mirrors `ImageSchema.description`. Nullable.
         */
        description: text('description'),
        /**
         * Accessible alt text for `<img alt>` and screen readers.
         * Mirrors `ImageSchema.alt`. Nullable; falls back to caption / listing name.
         */
        alt: text('alt'),
        /**
         * Cloudinary `public_id` for the uploaded asset (e.g. `hospeda/dev/abc123`).
         * Nullable because historic payloads and external URLs (Unsplash, Pexels) do
         * not carry a Cloudinary identifier. Mirrors `ImageSchema.publicId`.
         */
        publicId: text('public_id'),
        /**
         * Optional credits / source metadata (photographer, source URL, license).
         * Stored as JSONB because the attribution object has three optional sub-fields
         * and a relational breakdown would add tables for minimal gain.
         *
         * @see ImageAttributionSchema in packages/schemas/src/common/media.schema.ts
         */
        attribution: jsonb('attribution').$type<ImageAttribution>(),
        /**
         * Content moderation state of the photo.
         * Reuses the existing `ModerationStatusPgEnum` (`PENDING` | `APPROVED` | `REJECTED`).
         * Mirrors `ImageSchema.moderationState`.
         */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        /**
         * Visibility state within the listing's media collection.
         * `visible`  → in the active gallery (or is the featured image).
         * `archived` → moved out of the gallery. No commerce flow writes this today.
         */
        state: GastronomyMediaStatePgEnum('state').notNull().default('visible'),
        /**
         * When `true` this row is the featured / cover image for the listing.
         * A partial unique index (extras carril) enforces at most one featured row per
         * listing. `is_featured` MUST be false when `state = 'archived'` (enforced by
         * an extras CHECK constraint, not here).
         */
        isFeatured: boolean('is_featured').notNull().default(false),
        /**
         * 0-based display order within the active gallery.
         * Higher values appear later. The service layer keeps these dense and
         * consistent after inserts / deletions.
         */
        sortOrder: integer('sort_order').notNull(),
        /**
         * Timestamp set when the photo is moved to `state = 'archived'`.
         * Null while the photo is `visible`.
         */
        archivedAt: timestamp('archived_at', { withTimezone: true }),
        // -------------------------------------------------------------------------
        // Standard audit / lifecycle columns
        // -------------------------------------------------------------------------
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Index for fetching all media belonging to one listing (the dominant query). */
        gastronomyMedia_gastronomyId_idx: index('gastronomyMedia_gastronomyId_idx').on(
            table.gastronomyId
        ),
        /** Index to filter quickly by state (visible vs archived gallery reads). */
        gastronomyMedia_state_idx: index('gastronomyMedia_state_idx').on(table.state),
        /** Index to quickly locate the featured photo for a given listing. */
        gastronomyMedia_isFeatured_idx: index('gastronomyMedia_isFeatured_idx').on(
            table.isFeatured
        ),
        /** Composite index for the canonical gallery-read query: listing + state + order. */
        gastronomyMedia_gastronomyId_state_sortOrder_idx: index(
            'gastronomyMedia_gastronomyId_state_sortOrder_idx'
        ).on(table.gastronomyId, table.state, table.sortOrder),
        /** Soft-delete filter index. */
        gastronomyMedia_deletedAt_idx: index('gastronomyMedia_deletedAt_idx').on(table.deletedAt)
    })
);

/**
 * Drizzle relations for `gastronomy_media`.
 *
 * Each media row belongs to exactly one gastronomy listing.
 */
export const gastronomyMediaRelations = relations(gastronomyMedia, ({ one }) => ({
    gastronomy: one(gastronomies, {
        fields: [gastronomyMedia.gastronomyId],
        references: [gastronomies.id]
    })
}));

/**
 * Type inferred from the Drizzle table definition for SELECT queries.
 * Use this instead of a manual interface — it always stays in sync with the schema.
 */
export type SelectGastronomyMedia = typeof gastronomyMedia.$inferSelect;

/**
 * Type inferred from the Drizzle table definition for INSERT queries.
 * Use this instead of a manual interface — it always stays in sync with the schema.
 */
export type InsertGastronomyMedia = typeof gastronomyMedia.$inferInsert;
