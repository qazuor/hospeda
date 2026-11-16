import {
    LOCATION_EXCEPTION_EVENT_ACTIONS,
    LOCATION_EXCEPTION_REQUEST_STATUSES,
    type LocationExceptionEventAction,
    type LocationExceptionRequestStatus,
    VerticalEnum
} from '@repo/schemas';
import { sql } from 'drizzle-orm';
import {
    check,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { quotedList } from '../vertical/quoted-list.ts';

/**
 * The verticals the one-address rule covers (HOS-1810), the only values
 * `entity_type` admits on the two location-exception tables. Experiences are out.
 */
export const LOCATION_EXCEPTION_ENTITY_TYPES = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE
] as const;

/** One vertical covered by the one-address rule. */
export type LocationExceptionEntityType = (typeof LOCATION_EXCEPTION_ENTITY_TYPES)[number];

/**
 * `location_exception_request` (HOS-2192): an owner's request for an exception to
 * the one-address rule, resolved by an admin.
 *
 * - The listing is referenced by `(entity_type, entity_id)` because it lives in one
 *   of two listing tables (same shape as `fix_request`); there is no FK.
 * - At most ONE `PENDING` request per listing: the partial unique index. The service
 *   pre-checks it and maps a `23505` on it to a 409.
 * - `location_key` is the key the listing had when the request was made. A request is
 *   valid only for that key: when the listing's key changes it becomes `SUPERSEDED`.
 * - Resolved rows are kept as the record; no soft delete.
 */
export const locationExceptionRequests = pgTable(
    'location_exception_request',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        entityType: varchar('entity_type', { length: 32 })
            .$type<LocationExceptionEntityType>()
            .notNull(),
        entityId: uuid('entity_id').notNull(),
        /** The owner who asked. */
        requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
        /**
         * The place key the exception is for: the listing's own key at request time, or
         * the key of `target_location` for a move request.
         */
        locationKey: text('location_key').notNull(),
        /**
         * The address the owner wants to move the listing to (a location PATCH refused
         * with `DUPLICATE_LOCATION`). NULL for an ordinary request. The key above is
         * recomputed server-side from it; the exception is granted for that key and
         * stays dormant until the listing is saved at that address.
         */
        targetLocation: jsonb('target_location').$type<{
            street: string;
            number: string;
            floor?: string;
            apartment?: string;
        }>(),
        /** The owner's reason. */
        reason: text('reason').notNull(),
        status: varchar('status', { length: 16 })
            .$type<LocationExceptionRequestStatus>()
            .notNull()
            .default('PENDING'),
        requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
        /** The admin who approved or rejected. NULL while pending or superseded. */
        decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
        decidedAt: timestamp('decided_at', { withTimezone: true }),
        /** Admin's reason: required on reject, the grant reason on approve. */
        decisionReason: text('decision_reason')
    },
    (table) => ({
        location_exception_request_one_pending_uidx: uniqueIndex(
            'location_exception_request_one_pending_uidx'
        )
            .on(table.entityType, table.entityId)
            .where(sql`${table.status} = 'PENDING'`),
        location_exception_request_entity_idx: index('location_exception_request_entity_idx').on(
            table.entityType,
            table.entityId,
            table.requestedAt
        ),
        location_exception_request_status_idx: index('location_exception_request_status_idx').on(
            table.entityType,
            table.status,
            table.requestedAt
        ),
        location_exception_request_entity_type_check: check(
            'location_exception_request_entity_type_check',
            sql`${table.entityType} IN (${quotedList(LOCATION_EXCEPTION_ENTITY_TYPES)})`
        ),
        location_exception_request_status_check: check(
            'location_exception_request_status_check',
            sql`${table.status} IN (${quotedList(LOCATION_EXCEPTION_REQUEST_STATUSES)})`
        )
    })
);

/**
 * `location_exception_event` (HOS-2192): append-only audit trail of every action on
 * a location exception: request, approval, rejection, direct grant and revocation.
 *
 * The listing's own `location_exception_*` columns hold only the CURRENT grant and
 * are nulled by a revoke, so this table is the record that survives it. Rows are
 * never updated or deleted: no model method or route does it, a static test pins
 * that and the trigger of `migrations/extras/058-*` rejects it at the database. Each row is written in the same transaction as the state change it
 * audits.
 */
export const locationExceptionEvents = pgTable(
    'location_exception_event',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        entityType: varchar('entity_type', { length: 32 })
            .$type<LocationExceptionEntityType>()
            .notNull(),
        entityId: uuid('entity_id').notNull(),
        action: varchar('action', { length: 16 }).$type<LocationExceptionEventAction>().notNull(),
        // No FK on `actor_id` and `request_id` (same as `domain_event.actor_id`): the
        // audit row must outlive, and never block or be rewritten by, the deletion of
        // an account or a request.
        actorId: uuid('actor_id'),
        reason: text('reason'),
        /** The listing's `location_key` when the action happened. */
        locationKey: text('location_key'),
        requestId: uuid('request_id'),
        // `clock_timestamp()`, not `now()`: two events of one transaction (a SUPERSEDED
        // and the REQUESTED that follows it) must keep their order in the history.
        createdAt: timestamp('created_at', { withTimezone: true })
            .default(sql`clock_timestamp()`)
            .notNull()
    },
    (table) => ({
        location_exception_event_entity_idx: index('location_exception_event_entity_idx').on(
            table.entityType,
            table.entityId,
            table.createdAt
        ),
        location_exception_event_entity_type_check: check(
            'location_exception_event_entity_type_check',
            sql`${table.entityType} IN (${quotedList(LOCATION_EXCEPTION_ENTITY_TYPES)})`
        ),
        location_exception_event_action_check: check(
            'location_exception_event_action_check',
            sql`${table.action} IN (${quotedList(LOCATION_EXCEPTION_EVENT_ACTIONS)})`
        )
    })
);

/** Insert shape of a `location_exception_request` row. */
export type InsertLocationExceptionRequest = typeof locationExceptionRequests.$inferInsert;
/** Select shape of a `location_exception_request` row. */
export type SelectLocationExceptionRequest = typeof locationExceptionRequests.$inferSelect;
/** Insert shape of a `location_exception_event` row. */
export type InsertLocationExceptionEvent = typeof locationExceptionEvents.$inferInsert;
/** Select shape of a `location_exception_event` row. */
export type SelectLocationExceptionEvent = typeof locationExceptionEvents.$inferSelect;
