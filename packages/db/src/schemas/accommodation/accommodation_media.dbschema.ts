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
import { accommodations } from './accommodation.dbschema.ts';

/**
 * PostgreSQL enum for the visibility state of a single accommodation media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery (e.g. plan downgrade over-limit)
 *               and is waiting to be restored. `is_featured` MUST be false when
 *               state is `archived` (enforced by extras T-003 CHECK constraint).
 *
 * Defined as a literal tuple (not backed by a TypeScript enum in @repo/schemas)
 * because these values are internal to the DB layer and the media-state concept
 * does not need to be exposed via Zod nativeEnum. Follows the same pattern as
 * `ExternalReputationFetchStatusPgEnum` in enums.dbschema.ts.
 */
export const AccommodationMediaStatePgEnum = pgEnum('accommodation_media_state_enum', [
    'visible',
    'archived'
]);

/**
 * `accommodation_media` — relational table for accommodation gallery photos.
 *
 * Replaces the JSONB `accommodations.media.gallery`, `media.featuredImage`, and
 * `media.archivedGallery` sub-fields with a proper per-row structure. Videos
 * remain in the existing `accommodations.media` JSONB column (D1 decision).
 *
 * Key design decisions (locked, see SPEC-204):
 * - D1: this table holds gallery + archived + featured only. Videos stay in JSONB.
 * - D2: state is modeled as `state` enum + `is_featured` boolean, not a 3-way enum.
 * - D3: uuid PK per photo; `sort_order` tracks gallery order; `archived_at` enables
 *       FIFO restore when a host re-upgrades above the photo cap.
 * - The partial unique index on `is_featured` and the CHECK(`is_featured ⇒ NOT archived`)
 *   are added via the extras carril (T-003) — they are NOT defined here.
 *
 * @see packages/db/src/migrations/extras/ for T-003 DB-level invariants
 * @see packages/schemas/src/common/media.schema.ts for the `ImageSchema` this mirrors
 */
export const accommodationMedia = pgTable(
    'accommodation_media',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the owning accommodation. ON DELETE CASCADE ensures photo rows are
         * removed automatically when the accommodation is hard-deleted.
         */
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
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
         * Mirrors `ImageSchema.alt`. Nullable; falls back to caption / accommodation name.
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
         * (`photographer`, `sourceUrl`, `license`) and a relational breakdown would add
         * tables for minimal gain. Mirrors `ImageSchema.attribution`.
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
         * Visibility state within the accommodation's media collection.
         * `visible`  → in the active gallery (or is the featured image).
         * `archived` → moved out of the gallery (downgrade over-limit); restored on upgrade.
         */
        state: AccommodationMediaStatePgEnum('state').notNull().default('visible'),
        /**
         * When `true` this row is the featured / cover image for the accommodation.
         * A partial unique index (T-003 extras) enforces at most one featured row per
         * accommodation. `is_featured` MUST be false when `state = 'archived'` (enforced
         * by a T-003 CHECK constraint, not here).
         */
        isFeatured: boolean('is_featured').notNull().default(false),
        /**
         * 0-based display order within the active gallery.
         * Higher values appear later. The model layer is responsible for keeping
         * sort_order values dense and consistent after inserts / deletions.
         */
        sortOrder: integer('sort_order').notNull(),
        /**
         * Timestamp set when the photo is moved to `state = 'archived'`.
         * Used for FIFO ordering when restoring photos on plan re-upgrade.
         * Null while the photo is `visible`.
         */
        archivedAt: timestamp('archived_at', { withTimezone: true }),
        // -------------------------------------------------------------------------
        // Standard audit / lifecycle columns (matches accommodation_faq pattern)
        // -------------------------------------------------------------------------
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Index for fetching all media belonging to one accommodation (the dominant query). */
        accommodationMedia_accommodationId_idx: index('accommodationMedia_accommodationId_idx').on(
            table.accommodationId
        ),
        /** Index to filter quickly by state (visible vs archived gallery reads). */
        accommodationMedia_state_idx: index('accommodationMedia_state_idx').on(table.state),
        /** Index to quickly locate the featured photo for a given accommodation. */
        accommodationMedia_isFeatured_idx: index('accommodationMedia_isFeatured_idx').on(
            table.isFeatured
        ),
        /** Composite index for the canonical gallery-read query: accommodation + state + order. */
        accommodationMedia_accommodationId_state_sortOrder_idx: index(
            'accommodationMedia_accommodationId_state_sortOrder_idx'
        ).on(table.accommodationId, table.state, table.sortOrder),
        /** Soft-delete filter index. */
        accommodationMedia_deletedAt_idx: index('accommodationMedia_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

/**
 * Drizzle relations for `accommodation_media`.
 *
 * Each media row belongs to exactly one accommodation. The inverse (`many`) side
 * is wired in `accommodations.dbschema.ts` separately (T-001 scope excludes
 * modifying `accommodation.dbschema.ts`).
 */
export const accommodationMediaRelations = relations(accommodationMedia, ({ one }) => ({
    accommodation: one(accommodations, {
        fields: [accommodationMedia.accommodationId],
        references: [accommodations.id]
    })
}));

/**
 * Type inferred from the Drizzle table definition for SELECT queries.
 * Use this instead of a manual interface — it always stays in sync with the schema.
 */
export type SelectAccommodationMedia = typeof accommodationMedia.$inferSelect;

/**
 * Type inferred from the Drizzle table definition for INSERT queries.
 * Use this instead of a manual interface — it always stays in sync with the schema.
 */
export type InsertAccommodationMedia = typeof accommodationMedia.$inferInsert;
