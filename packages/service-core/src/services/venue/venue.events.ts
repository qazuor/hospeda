/**
 * venue.events.ts
 *
 * The venue's own agenda — read and whole-document write (HOS-1042).
 *
 * Live music night, happy hour, dinner show, the Tuesday deal. Not the
 * platform's DESTINATION events (a festival, curated by staff, a different
 * entity entirely) and not the free "we host YOUR birthday" CTA of HOS-1055.
 *
 * ## Two operations, not six
 *
 * The same choice `venue.menu.ts` makes, for the same reason and with the
 * same contrast against `venue_media`: an agenda entry is text, so nothing
 * exists outside the database and nothing can be orphaned by a save that never
 * happens. What it has instead is that it is edited as a WHOLE — reordering two
 * events while deleting a third and renaming a fourth is ONE thought, and as
 * four requests it can half-succeed and leave a published agenda in a state the
 * owner never described.
 *
 * ## Why a diff rather than delete-and-reinsert (HOS-2291)
 *
 * Entries are referenced from outside this table now (clicks, reminders, guest
 * lists, a featured slot), so an entry has to keep its id and its `created_at`
 * across a save. {@link replaceVenueEvents} therefore diffs the submitted
 * document against the stored agenda inside ONE transaction: an entry carrying
 * an id updates that row, an entry without one is created, and a stored row the
 * document does not mention is deleted.
 *
 * ## Permissions vs. entitlements
 *
 * This module answers PERMISSION only — `VENUE_EDIT_OWN` on your own
 * listing, `VENUE_EDIT_ALL` for staff, via the same
 * {@link checkVenueCanEditFaqs} gate every sibling helper uses. Whether the
 * caller's PLAN includes an agenda is an entitlement
 * (`MANAGE_VENUE_EVENTS`) and is checked at the route, before this is
 * reached.
 *
 * @module venue.events
 */

import { VenueEventModel, type VenueModel, withTransaction } from '@repo/db';

import {
    isVenueEventPast,
    partitionVenueEvents,
    ServiceErrorCode,
    VENUE_EVENTS_MAX_ENTRIES,
    type VenueEvent,
    type VenueEventPublic,
    type VenueEventsGetInput,
    VenueEventsGetInputSchema,
    type VenueEventsOutput,
    type VenueEventsReplaceInput,
    VenueEventsReplaceInputSchema
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { liveParentOrNull } from '../../utils/live-parent';
import { recordListingSubEntityEdit } from '../listing/listing-owner-act';
import { checkVenueCanEditFaqs } from './venue.permissions';

/**
 * Upper bound on the rows one read pulls back.
 *
 * `findAll` paginates, and the agenda is read whole — so an unstated page size
 * would silently truncate a long agenda rather than fail. Sized well above the
 * ceiling (`VENUE_EVENTS_MAX_ENTRIES`, which counts only non-past entries,
 * so a document carrying past ones can be longer), so an agenda that passed
 * validation on the way in can always be read back out.
 */
const EVENTS_READ_PAGE_SIZE = 500;

/**
 * Loads a venue listing by ID or throws NOT_FOUND.
 *
 * @param model - The VenueModel instance.
 * @param venueId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The venue DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireVenue(
    model: VenueModel,
    venueId: string,
    tx?: ServiceContext['tx'],
    includeDeleted = false
) {
    const row = await model.findById(venueId, tx);
    const entity = includeDeleted ? row : liveParentOrNull({ entity: row });
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'venue listing not found');
    }
    return entity;
}

/** A stored agenda row: the fields {@link projectEvent} reads, nothing more is required. */
type StoredVenueEvent = Pick<VenueEvent, keyof VenueEventPublic>;

/** Ascending by `displayOrder`, ties broken by title so the order is total. */
const byDisplayOrder = <T extends { displayOrder: number; title: string }>(a: T, b: T): number =>
    a.displayOrder === b.displayOrder
        ? a.title.localeCompare(b.title)
        : a.displayOrder - b.displayOrder;

/**
 * Truncates a Postgres `time` value back to the `HH:MM` the API speaks.
 *
 * **This is not cosmetic.** A `time` column does not return what you put in it:
 * `'18:00'` goes in and `'18:00:00'` comes out — measured against this repo's
 * own Postgres, not assumed. `VenueEventTimeSchema` rejects seconds ON
 * PURPOSE (two spellings of one instant is a field whose equality checks are
 * wrong somewhere downstream), so without this every read would fail its own
 * response schema and the editor would round-trip a value it cannot re-submit.
 *
 * Truncation rather than reformatting: the seconds a `time` column appends are
 * always `:00` here, because the only writer parses `HH:MM` first. A value
 * already in `HH:MM` passes through unchanged, so this is safe to apply twice.
 *
 * @param value - The raw column value, or `null`.
 * @returns The value as `HH:MM`, or `null`.
 */
export function toClockTime(value: string): string;
export function toClockTime(value: string | null): string | null;
export function toClockTime(value: string | null): string | null {
    return value === null ? null : value.slice(0, 5);
}

/**
 * Projects one stored row onto the wire shape.
 *
 * The only transformation is {@link toClockTime} on the two time columns —
 * everything else round-trips as stored, `date` included (a `date` column
 * returns exactly the `YYYY-MM-DD` it was given, which is why it is a `date`
 * and not a `timestamp`).
 *
 * @param row - The stored row.
 * @returns The public fields of the row, with times normalised to `HH:MM`.
 */
export function projectEvent(row: StoredVenueEvent): VenueEventPublic {
    // Explicit selection, never `...row` (HOS-2291): a column added to the table
    // later (an internal flag, an audit field) must not leak into the owner and
    // public responses until someone adds it here on purpose.
    return {
        id: row.id,
        venueId: row.venueId,
        title: row.title,
        description: row.description,
        recurrence: row.recurrence,
        date: row.date,
        weekday: row.weekday,
        startTime: toClockTime(row.startTime),
        endTime: toClockTime(row.endTime),
        isActive: row.isActive,
        displayOrder: row.displayOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

/**
 * Reads a listing's agenda, ordered.
 *
 * Returns EVERY entry, `isActive: false` ones included. Hiding an inactive
 * entry here would be the wrong layer to do it at: the owner's editor is the
 * first caller and needs to see the parked winter cena show in order to
 * un-park it. The public projection drops them (see the route's own gate),
 * which is where a reader-facing decision belongs.
 *
 * @param model - VenueModel instance.
 * @param data - `{ venueId }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<VenueEventsOutput>`.
 */
export async function getVenueEvents(
    model: VenueModel,
    data: VenueEventsGetInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueEventsOutput>> {
    try {
        const parseResult = VenueEventsGetInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const { venueId } = parseResult.data;

        await requireVenue(model, venueId, ctx?.tx, true);

        const eventModel = new VenueEventModel();
        const { items: rows } = await eventModel.findAll(
            { venueId },
            { pageSize: EVENTS_READ_PAGE_SIZE },
            undefined,
            ctx?.tx
        );

        return { data: { events: [...rows].sort(byDisplayOrder).map(projectEvent) } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : 'Failed to read venue events'
            }
        };
    }
}

/**
 * Replaces a listing's agenda with the submitted document.
 *
 * Permission: `VENUE_EDIT_OWN` (listing owner) or `VENUE_EDIT_ALL`
 * (staff). The `MANAGE_VENUE_EVENTS` entitlement is the route's gate, not
 * this one's.
 *
 * An EMPTY `events` array is a legitimate submission and takes the agenda down:
 * a venue that stopped doing live music needs a way to say so, and refusing the
 * empty document would leave them with no way to.
 *
 * The agenda ceiling (`VENUE_EVENTS_MAX_ENTRIES`) is enforced here, over the
 * entries that are not past (HOS-2254), and answers 400 `VALIDATION_ERROR`.
 *
 * Entries are matched by `id` (HOS-2291): see the module header for the diff
 * rules, and {@link VenueEventInputSchema} for why an id of another venue is a
 * 404 rather than something the service trusts.
 *
 * `displayOrder` is assigned from ARRAY POSITION, never read from the payload —
 * so the order a client sees is the order it sent, and two entries cannot be
 * given the same place.
 *
 * The `date`/`weekday` pair is written from the shape the payload declared, and
 * the field that does not belong to that shape is written as `NULL` rather than
 * passed through. The schema already refused a payload carrying both, so this
 * is not a second validation — it is what keeps a future caller that skips the
 * schema from persisting an entry no renderer can place.
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - `{ venueId, agenda }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<venueEventsOutput>` with the agenda as now stored.
 */
export async function replaceVenueEvents(
    model: VenueModel,
    actor: Actor,
    data: VenueEventsReplaceInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueEventsOutput>> {
    try {
        const parseResult = VenueEventsReplaceInputSchema.safeParse(data);
        if (!parseResult.success) {
            const messages = parseResult.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: `Validation failed: ${messages}`
                }
            };
        }
        const validated = parseResult.data;
        const { venueId } = validated;

        const venue = await requireVenue(model, venueId, ctx?.tx);
        checkVenueCanEditFaqs(actor, venue);

        // HOS-2254: the ceiling counts the entries that are NOT past (live and
        // switched-off ones). A past entry counts for nothing, because the
        // document still carries it until the cleanup cron deletes it. The
        // schema cannot do this: it does not know the time.
        const now = new Date();
        const { current, past } = partitionVenueEvents({
            events: validated.agenda.events,
            now
        });
        if (current.length > VENUE_EVENTS_MAX_ENTRIES) {
            throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'zodError.venue.events.max');
        }
        // A past entry may only be one that already exists (re-sent with its id).
        // Creating one dated in the past would skip the ceiling above.
        if (past.some((event) => event.id === undefined)) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'zodError.venue.events.newPast'
            );
        }

        const eventModel = new VenueEventModel();

        // ONE transaction for the whole document, same reason the carta's write
        // is one: an agenda half-written — the old entries gone and the new ones
        // not yet in — is a published page the owner never described.
        const runInTx = async (tx: ServiceContext['tx']): Promise<void> => {
            const { items: stored } = await eventModel.findAll(
                { venueId },
                { pageSize: EVENTS_READ_PAGE_SIZE },
                undefined,
                tx
            );
            const storedIds = new Set(stored.map((row) => row.id));

            // Ownership first, before any write: an id that is not one of THIS
            // venue's stored events (another venue's, or unknown) is a missing
            // resource, 404, never a 403 that would confirm it exists elsewhere
            // (error-contract). Nothing has been written yet, so the refusal
            // leaves the agenda exactly as it was.
            const sentIds = new Set<string>();
            // Past entries whose id is no longer stored: the cleanup cron deleted
            // them while the owner's editor was open. They are already gone, so
            // they are skipped instead of failing the whole save.
            const vanishedPast = new Set<string>();
            for (const event of validated.agenda.events) {
                if (event.id === undefined) continue;
                if (!storedIds.has(event.id)) {
                    // Only a PAST entry gets this leniency. An unknown id of a
                    // live entry stays a 404, so a foreign id is never accepted.
                    // Nothing is written for a skipped entry either way.
                    if (isVenueEventPast({ event, now })) {
                        vanishedPast.add(event.id);
                        continue;
                    }
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'venue event not found');
                }
                if (sentIds.has(event.id)) {
                    throw new ServiceError(
                        ServiceErrorCode.VALIDATION_ERROR,
                        'the same venue event id appears more than once'
                    );
                }
                sentIds.add(event.id);
            }

            for (const row of stored) {
                if (!sentIds.has(row.id)) {
                    await eventModel.hardDelete({ id: row.id, venueId }, tx);
                }
            }

            for (const [index, event] of validated.agenda.events.entries()) {
                if (event.id !== undefined && vanishedPast.has(event.id)) continue;
                const fields = {
                    title: event.title,
                    // `''` and `undefined` both mean "no blurb"; stored as
                    // NULL so the read has one absent value, not two.
                    description: event.description || null,
                    recurrence: event.recurrence,
                    date: event.recurrence === 'once' ? (event.date ?? null) : null,
                    // `?? null` and NOT `|| null`: weekday `0` is Sunday, a
                    // perfectly ordinary day for a venue to open, and `||`
                    // would silently turn every Sunday event into a row with
                    // no day at all.
                    weekday: event.recurrence === 'weekly' ? (event.weekday ?? null) : null,
                    startTime: event.startTime,
                    endTime: event.endTime || null,
                    isActive: event.isActive,
                    displayOrder: index,
                    updatedById: actor.id
                };
                if (event.id === undefined) {
                    await eventModel.create({ venueId, ...fields, createdById: actor.id }, tx);
                } else {
                    // `createdAt` and `createdById` are deliberately not written.
                    await eventModel.update(
                        { id: event.id, venueId },
                        { ...fields, updatedAt: new Date() },
                        tx
                    );
                }
            }
            // AC:V9a:7 — the owner act commits with the whole events document.
            await recordListingSubEntityEdit({
                entityType: 'venue',
                listing: venue,
                actor,
                field: 'events',
                ctx: { ...ctx, tx }
            });
        };

        if (ctx?.tx) {
            await runInTx(ctx.tx);
        } else {
            await withTransaction(async (tx) => {
                await runInTx(tx);
            });
        }

        return await getVenueEvents(model, { venueId }, ctx);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : 'Failed to replace venue events'
            }
        };
    }
}
