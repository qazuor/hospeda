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
import { events } from './event.dbschema.ts';

/**
 * PostgreSQL enum for the visibility state of a single event media row.
 *
 * - `visible`  — photo is part of the active gallery (or is the featured image).
 * - `archived` — photo was moved out of the gallery.
 *
 * No editorial flow archives photos today (only the accommodation plan-downgrade
 * remediation does, SPEC-167, and posts have no plan). Carried anyway so post,
 * event, commerce and accommodation media share ONE table shape — and therefore
 * one sync/compose implementation. Own enum type per table, matching how
 * `gastronomy_media` and `experience_media` each declare theirs (HOS-372).
 */
export const EventMediaStatePgEnum = pgEnum('event_media_state_enum', ['visible', 'archived']);

/**
 * `event_media` — relational table for an event's gallery photos (HOS-390).
 *
 * Replaces the JSONB `events.media.gallery` / `media.featuredImage` sub-fields
 * with a per-row structure, exactly as `accommodation_media` (SPEC-204) and
 * `gastronomy_media` / `experience_media` (HOS-372) already do. **Videos remain
 * in the `events.media` JSONB column** (SPEC-204 D1) — they carry no per-row
 * state and no gallery ordering.
 *
 * Why this table exists at all: `POST /protected/media/events/:id` uploads to
 * Cloudinary and returns a URL, but persists nothing; the protected PATCH does
 * not accept `media`. Until this table is wired end to end there is no way for
 * an author to attach a photo to their own event from the web (HOS-374 slice 2D).
 *
 * The partial unique index on `is_featured` and the CHECK
 * (`is_featured ⇒ NOT archived`) live in the extras carril, not here — Drizzle
 * cannot declare either.
 *
 * @see packages/db/src/migrations/extras/ — the DB-level invariants
 * @see packages/schemas/src/entities/event/subtypes/event.media.schema.ts — the Zod mirror
 */
export const eventMedia = pgTable(
    'event_media',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * FK to the owning event. ON DELETE CASCADE so photo rows disappear with
         * the event on a hard delete (a soft-deleted event keeps its rows).
         */
        eventId: uuid('event_id')
            .notNull()
            .references(() => events.id, { onDelete: 'cascade' }),
        /** Full public URL of the photo. Mirrors `ImageSchema.url`. Required. */
        url: text('url').notNull(),
        /** Short display caption (max 100 chars in Zod). Nullable. */
        caption: text('caption'),
        /** Longer description of the photo content (max 300 chars in Zod). Nullable. */
        description: text('description'),
        /** Accessible alt text; falls back to caption / event name at render time. */
        alt: text('alt'),
        /**
         * Cloudinary `public_id`. Nullable because historic payloads and external
         * URLs (Unsplash, Pexels) carry no Cloudinary identifier.
         */
        publicId: text('public_id'),
        /**
         * Optional credits / source metadata (photographer, source URL, license).
         * JSONB for the same reason as the accommodation twin: three optional
         * sub-fields would not justify a table.
         */
        attribution: jsonb('attribution').$type<ImageAttribution>(),
        /**
         * Content moderation state of the PHOTO — independent of the event's own
         * verdict (HOS-374 §7.6.1). Approving an event says nothing about whether
         * each of its images passed review.
         */
        moderationState: ModerationStatusPgEnum('moderation_state').notNull().default('PENDING'),
        /** Visibility state within the event's media collection. */
        state: EventMediaStatePgEnum('state').notNull().default('visible'),
        /**
         * When `true` this row is the event's featured / cover image. At most one
         * per event (partial unique index, extras carril); MUST be false while
         * `state = 'archived'` (CHECK constraint, extras carril).
         */
        isFeatured: boolean('is_featured').notNull().default(false),
        /**
         * 0-based display order within the active gallery. Lower appears first.
         * The model layer keeps the values dense after inserts and deletions.
         */
        sortOrder: integer('sort_order').notNull(),
        /** Set when the photo moves to `state = 'archived'`; null while visible. */
        archivedAt: timestamp('archived_at', { withTimezone: true }),
        // ---------------------------------------------------------------------
        // Audit columns. No `createdById` / `updatedById` — media tables omit
        // them, unlike their parent entity tables.
        // ---------------------------------------------------------------------
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** The dominant query: every media row of one event. */
        eventMedia_eventId_idx: index('eventMedia_eventId_idx').on(table.eventId),
        /** Filter by state (visible vs archived reads). */
        eventMedia_state_idx: index('eventMedia_state_idx').on(table.state),
        /** Locate the featured photo of an event. */
        eventMedia_isFeatured_idx: index('eventMedia_isFeatured_idx').on(table.isFeatured),
        /** The canonical gallery read: event + state + order. */
        eventMedia_eventId_state_sortOrder_idx: index('eventMedia_eventId_state_sortOrder_idx').on(
            table.eventId,
            table.state,
            table.sortOrder
        ),
        /** Soft-delete filter. */
        eventMedia_deletedAt_idx: index('eventMedia_deletedAt_idx').on(table.deletedAt)
    })
);

/**
 * Drizzle relations for `event_media`. Each row belongs to exactly one event; the
 * inverse `many` side is wired in `event.dbschema.ts`.
 */
export const eventMediaRelations = relations(eventMedia, ({ one }) => ({
    event: one(events, {
        fields: [eventMedia.eventId],
        references: [events.id]
    })
}));

/** Type inferred from the table definition for SELECT queries. */
export type SelectEventMedia = typeof eventMedia.$inferSelect;

/** Type inferred from the table definition for INSERT queries. */
export type InsertEventMedia = typeof eventMedia.$inferInsert;
