import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * The closed catalog of domain event types (NUCLEO/08 §1.2, "qué pasó").
 *
 * A TS constant mirrored by a CHECK constraint rather than a pg enum: adding a
 * type is a one-line change here plus the regenerated CHECK, with no enum
 * migration and no `@repo/schemas` enum (and its frozen-count guards) for a
 * table that no API surface exposes.
 *
 * - `email.undeliverable`: a transactional mail that will never arrive
 *   (retries exhausted or hard bounce), escalated by the outbox sender
 *   (NUCLEO/07 §1.3, AC:U2:4).
 * - `listing.created` / `listing.edited`: an owner act on their own listing
 *   that is not a state transition (HOS-1499, piece V9a, AC:V9a:1). They are
 *   "fact 1" of the retention clock (NUCLEO/01 §1.2), read back from this
 *   table. Content fields carry only their name (AC:V9a:2). `listing.exported`
 *   is deliberately absent: no export operation exists yet.
 * - `trial.extended`: a running trial extended by the administrative action 11
 *   (origin `SUPER_ADMIN`, mandatory `reason`; HOS-1445, AC:V4:9). The
 *   redemption extensions are NOT here: they live in `canje_de_trial`.
 */
export const DOMAIN_EVENT_TYPES = [
    'email.undeliverable',
    'listing.created',
    'listing.edited',
    'trial.extended'
] as const;

/** One type of the closed domain event catalog. */
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/**
 * Who caused an event (NUCLEO/08 §1.2, "quién"): the owning person, an
 * administrator, a job, or the payment provider.
 */
export const DOMAIN_EVENT_ACTOR_TYPES = ['owner', 'admin', 'job', 'provider'] as const;

/** One kind of actor. */
export type DomainEventActorType = (typeof DOMAIN_EVENT_ACTOR_TYPES)[number];

/**
 * One changed field (NUCLEO/08 §1.2, "qué cambió").
 *
 * `old`/`new` are carried only for fields that are NOT listing content (status,
 * plan, amount, dates). For a content field (texts, photos, FAQ, hours) only
 * `field` is stored, never its values: a delta of a text field IS a copy of
 * the content, and this table is never deleted from.
 */
export interface DomainEventChange {
    readonly field: string;
    readonly old?: unknown;
    readonly new?: unknown;
}

/** Renders a readonly string tuple as a SQL `IN (...)` list. */
function sqlInList(values: readonly string[]) {
    return sql.raw(values.map((value) => `'${value}'`).join(', '));
}

/**
 * Domain event log (HOS-1424, unit U2, AC:U2:11; NUCLEO/02 §2.6, NUCLEO/08 §1).
 *
 * The audit record of what happened, to which entity, who caused it, when,
 * under which correlation, and which fields changed. References and deltas,
 * never a copy of the content.
 *
 * APPEND-ONLY. There is no `deleted_at` and no `updated_at` on purpose: a soft
 * delete is a write that no guard against `DELETE` sees. A `BEFORE UPDATE OR
 * DELETE` row trigger, hand-appended to migration 0131 (Drizzle cannot express
 * triggers), rejects both with SQLSTATE `P0001`. `TRUNCATE` is not a row
 * operation and is NOT blocked: the integration suites wipe every table with
 * `TRUNCATE ... CASCADE` between tests, and no application code path issues
 * one.
 *
 * - `actor_id` has no FK: the event must outlive (and never block) the account
 *   it names, and a job or the provider has no account at all.
 * - `entity_id` is text, not uuid: the pieces that write this table may not
 *   alter it, and not every entity is keyed by a uuid.
 * - `occurred_at` is a UTC instant (`timestamptz`, NUCLEO/07 §3).
 */
export const domainEvent = pgTable(
    'domain_event',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** What happened. See {@link DOMAIN_EVENT_TYPES}. */
        eventType: varchar('event_type', { length: 100 }).$type<DomainEventType>().notNull(),

        /** Kind of entity the event is about (e.g. `email_outbox`). */
        entityType: varchar('entity_type', { length: 100 }).notNull(),

        /** Id of that entity. */
        entityId: varchar('entity_id', { length: 255 }).notNull(),

        /** Account that caused it, when there is one. No FK on purpose. */
        actorId: uuid('actor_id'),

        /** Kind of actor. See {@link DOMAIN_EVENT_ACTOR_TYPES}. */
        actorType: varchar('actor_type', { length: 20 }).$type<DomainEventActorType>().notNull(),

        /** When it happened, in UTC. */
        occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),

        /** Fields that changed. A JSON array of {@link DomainEventChange}. */
        changes: jsonb('changes').$type<DomainEventChange[]>().notNull().default([]),

        /** Why, when the operation admits a reason. */
        reason: text('reason'),

        /** Correlation of the business intention (or job item) that produced it (NUCLEO/08 §2). */
        correlationId: uuid('correlation_id').notNull()
    },
    (table) => ({
        domain_event_entity_idx: index('domain_event_entity_idx').on(
            table.entityType,
            table.entityId,
            table.occurredAt
        ),
        domain_event_correlation_idx: index('domain_event_correlation_idx').on(table.correlationId),
        domain_event_type_idx: index('domain_event_type_idx').on(table.eventType, table.occurredAt),
        domain_event_event_type_check: check(
            'domain_event_event_type_check',
            sql`${table.eventType} IN (${sqlInList(DOMAIN_EVENT_TYPES)})`
        ),
        domain_event_actor_type_check: check(
            'domain_event_actor_type_check',
            sql`${table.actorType} IN (${sqlInList(DOMAIN_EVENT_ACTOR_TYPES)})`
        ),
        /** A person (owner or admin) is always named; a job or the provider has no account. */
        domain_event_person_actor_check: check(
            'domain_event_person_actor_check',
            sql`${table.actorType} NOT IN ('owner', 'admin') OR ${table.actorId} IS NOT NULL`
        ),
        domain_event_changes_array_check: check(
            'domain_event_changes_array_check',
            sql`jsonb_typeof(${table.changes}) = 'array'`
        )
    })
);

/** Insert shape of a `domain_event` row. */
export type InsertDomainEvent = typeof domainEvent.$inferInsert;
/** Select shape of a `domain_event` row. */
export type SelectDomainEvent = typeof domainEvent.$inferSelect;
