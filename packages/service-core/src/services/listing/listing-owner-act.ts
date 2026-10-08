/**
 * The register of the owner's acts on a listing (HOS-1499, piece V9a).
 *
 * Creating and editing a listing are not state transitions, yet each one is
 * "fact 1" of the retention clock (NUCLEO/01 §1.2): somebody is using the
 * listing. The clock reads that fact from the append-only `domain_event` log
 * (NUCLEO/08 §1.1-§1.3), so every owner create and edit writes one event there,
 * in the same transaction as the change itself.
 *
 * ## Content fields carry only their NAME (DEC-DATA-005 📌1, AC:V9a:2-3)
 *
 * The log is never deleted from, and day 180 deletes a listing's content. A
 * delta of a text field IS a copy of that text, so storing old/new values for
 * content would leave the deleted text alive in the log forever. Hence:
 *
 * - fields in {@link LISTING_NON_CONTENT_FIELDS} (state, plan, dates) store
 *   `{ field, old, new }`;
 * - EVERY other field stores `{ field }` and nothing else.
 *
 * The classification is an ALLOWLIST of non-content fields on purpose: a column
 * nobody classified (a new text column, the slug derived from the name) fails
 * toward storing only its name, never toward copying its value.
 *
 * ## Only the owner's own acts
 *
 * The clock counts the owner's activity. An administrator editing somebody
 * else's listing (ACC:15) is a different act audited by its own piece, so it
 * writes nothing here.
 *
 * Export is the third act the spec names (AC:V9a:1); no export operation
 * exists in the codebase yet, so `listing.exported` is not written anywhere.
 *
 * @module services/listing/listing-owner-act
 */

import { type DomainEventChange, domainEventModel } from '@repo/db';
import type { Actor, ServiceContext } from '../../types';
import { resolveServiceCorrelationId } from '../../utils/correlation';

/** Kind of listing an owner act is about: the vertical IS the table. */
export type ListingOwnerActEntityType = 'accommodation' | 'gastronomy' | 'experience';

/** The owner acts this register writes. */
export type ListingOwnerActEventType = 'listing.created' | 'listing.edited';

/**
 * Closed list of the listing sub-entity fields an owner act can touch
 * (V9b.md:367 content list). Each value names ONE sub-entity collection
 * (`faqs`, `media`, …) — the field name only, never its content.
 */
export type ListingSubEntityField =
    | 'faqs'
    | 'media'
    | 'menu'
    | 'dailySpecials'
    | 'events'
    | 'certificates'
    | 'tags';

/**
 * The closed list of listing fields that are NOT content (NUCLEO/08 §1.2:
 * "estado, plan, monto, fechas"). Only these keep their old and new values in
 * an event; anything else is content and keeps only its name.
 */
export const LISTING_NON_CONTENT_FIELDS = [
    'lifecycleState',
    'visibility',
    'moderationState',
    'ownerSuspended',
    'planRestricted',
    'billingUnpublishedAt',
    // The new publication model's state and clock columns (HOS-1478,
    // `listing-publication-columns.ts`): state, version of the deadlines and
    // dates — never content.
    'publicationStatus',
    'inactiveSince',
    'deadlinesVersion',
    'deletionAnnouncedAt'
] as const;

const NON_CONTENT = new Set<string>(LISTING_NON_CONTENT_FIELDS);

/**
 * Payload keys that are bookkeeping or write-only flags, not a change to the
 * listing: they never appear in an event.
 */
const NOT_A_CHANGE = new Set<string>([
    'id',
    'createdAt',
    'updatedAt',
    'createdById',
    'updatedById',
    'deletedAt',
    'deletedById',
    'refreshSlugFromName',
    'aiAssistedFields'
]);

/** Write-only payload keys that never exist on the row, so cannot be diffed. */
const WRITE_ONLY_KEYS = new Set<string>(['amenityIds', 'featureIds']);

/** Renders a non-content value for storage: dates as ISO strings, absent as null. */
function toStoredValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    return value === undefined ? null : value;
}

/** Structural equality good enough for column values (scalars, dates, JSON). */
function isSameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(toStoredValue(a)) === JSON.stringify(toStoredValue(b));
}

/** Input of {@link buildListingOwnerActChanges}. */
export interface BuildListingOwnerActChangesInput {
    /** The row before the act; omit for a create. */
    readonly before?: Readonly<Record<string, unknown>> | null;
    /** The fields the act wrote, as they reached the service. */
    readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Builds the "what changed" list of an owner act (NUCLEO/08 §1.2).
 *
 * On an edit, a field whose value did not change is left out; write-only keys
 * (`amenityIds`, `featureIds`) cannot be diffed against the row and are always
 * listed when present.
 *
 * @param input - The row before the act (edits only) and the written payload.
 * @returns `{ changes }`, sorted by field name.
 */
export function buildListingOwnerActChanges(input: BuildListingOwnerActChangesInput): {
    readonly changes: readonly DomainEventChange[];
} {
    const { before, payload } = input;
    const changes: DomainEventChange[] = [];

    for (const [field, value] of Object.entries(payload)) {
        if (value === undefined || NOT_A_CHANGE.has(field)) continue;
        if (before && !WRITE_ONLY_KEYS.has(field) && isSameValue(before[field], value)) continue;

        if (NON_CONTENT.has(field)) {
            changes.push(
                before
                    ? { field, old: toStoredValue(before[field]), new: toStoredValue(value) }
                    : { field, new: toStoredValue(value) }
            );
        } else {
            changes.push({ field });
        }
    }

    changes.sort((a, b) => a.field.localeCompare(b.field));
    return { changes };
}

/** Input of {@link recordListingOwnerAct}. */
export interface RecordListingOwnerActInput {
    readonly eventType: ListingOwnerActEventType;
    readonly entityType: ListingOwnerActEntityType;
    /** The listing the act is about. */
    readonly listing: { readonly id: string; readonly ownerId?: string | null };
    readonly actor: Actor;
    /** The service context of the write; its `tx` makes the event atomic with it. */
    readonly ctx?: ServiceContext;
    readonly changes: readonly DomainEventChange[];
}

/**
 * Writes one owner act to `domain_event`, inside `ctx.tx` when there is one.
 *
 * A no-op unless the actor IS the listing's owner. A failed write throws, so
 * inside a transaction the change it describes rolls back with it: the clock
 * never sees an edit without its event.
 *
 * @param input - The act, the listing, the actor, the context and the changes.
 * @returns `{ recorded }`, `false` when the actor is not the owner.
 */
export async function recordListingOwnerAct(
    input: RecordListingOwnerActInput
): Promise<{ readonly recorded: boolean }> {
    const { listing, actor, ctx } = input;
    if (!listing.ownerId || actor.id !== listing.ownerId) {
        return { recorded: false };
    }

    const { correlationId } = resolveServiceCorrelationId({ ctx });
    await domainEventModel.insert({
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: listing.id,
        actorId: actor.id,
        actorType: 'owner',
        correlationId,
        changes: input.changes,
        ...(ctx?.tx ? { tx: ctx.tx } : {})
    });
    return { recorded: true };
}

/** Input of {@link recordListingSubEntityEdit}. */
export interface RecordListingSubEntityEditInput {
    readonly entityType: ListingOwnerActEntityType;
    /** The listing the act is about. */
    readonly listing: { readonly id: string; readonly ownerId?: string | null };
    readonly actor: Actor;
    /** The sub-entity field the act touched: the NAME only, never content. */
    readonly field: ListingSubEntityField;
    /** The service context of the write; its `tx` makes the event atomic with it. */
    readonly ctx?: ServiceContext;
}

/**
 * Writes one owner act for an edit of a listing SUB-ENTITY (an FAQ, a gallery
 * photo, …), inside `ctx.tx` when there is one (AC:V9a:6, AC:V9a:7).
 *
 * Sub-entity edits are not state transitions of the listing itself, so they are
 * always recorded as `listing.edited` — the closed DOMAIN_EVENT_TYPES catalog
 * and its CHECK constraint have no per-sub-entity type, and adding one would
 * mean a migration for no information. The event's `changes` carries ONLY the
 * field name (`[{ field: 'faqs' }]`): a delta of a sub-entity row IS a copy of
 * its content, and content fields never store values (DEC-DATA-005).
 *
 * A thin wrapper over {@link recordListingOwnerAct}: the same owner gate (the
 * actor must be the listing's owner — an administrator editing somebody
 * else's listing writes nothing), the same atomicity rule, the same
 * correlation handling.
 *
 * @param input - The vertical, the listing, the actor, the touched field and the context.
 * @returns `{ recorded }`, `false` when the actor is not the owner.
 */
export async function recordListingSubEntityEdit(
    input: RecordListingSubEntityEditInput
): Promise<{ readonly recorded: boolean }> {
    return recordListingOwnerAct({
        eventType: 'listing.edited',
        entityType: input.entityType,
        listing: input.listing,
        actor: input.actor,
        ctx: input.ctx,
        changes: [{ field: input.field }]
    });
}
