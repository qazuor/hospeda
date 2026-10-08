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
