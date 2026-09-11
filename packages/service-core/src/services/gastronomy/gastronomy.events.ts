/**
 * gastronomy.events.ts
 *
 * The venue's own agenda — read and whole-document write (HOS-1042).
 *
 * Live music night, happy hour, dinner show, the Tuesday deal. Not the
 * platform's DESTINATION events (a festival, curated by staff, a different
 * entity entirely) and not the free "we host YOUR birthday" CTA of HOS-1055.
 *
 * ## Two operations, not six
 *
 * The same choice `gastronomy.menu.ts` makes, for the same reason and with the
 * same contrast against `gastronomy_media`: an agenda entry is text, so nothing
 * exists outside the database and nothing can be orphaned by a save that never
 * happens. What it has instead is that it is edited as a WHOLE — reordering two
 * events while deleting a third and renaming a fourth is ONE thought, and as
 * four requests it can half-succeed and leave a published agenda in a state the
 * owner never described.
 *
 * ## Why delete-and-reinsert rather than a diff
 *
 * Entry ids are not stable across a save, and callers are told so by the payload
 * schema, which carries no ids at all. Nothing references an agenda entry today
 * — no photo, no ticket, no metric — so a diff would be machinery with no
 * consequence, and the reinsert is what makes the transaction trivially correct.
 * The day something DOES reference an entry, this function grows a diff, exactly
 * as `replaceGastronomyMenu` records for the carta.
 *
 * ## Permissions vs. entitlements
 *
 * This module answers PERMISSION only — `COMMERCE_EDIT_OWN` on your own
 * listing, `COMMERCE_EDIT_ALL` for staff, via the same
 * {@link checkGastronomyCanEditFaqs} gate every sibling helper uses. Whether the
 * caller's PLAN includes an agenda is an entitlement
 * (`MANAGE_GASTRONOMY_EVENTS`) and is checked at the route, before this is
 * reached.
 *
 * @module gastronomy.events
 */

import { GastronomyEventModel, type GastronomyModel, withTransaction } from '@repo/db';
import {
    type GastronomyEventsGetInput,
    GastronomyEventsGetInputSchema,
    type GastronomyEventsOutput,
    type GastronomyEventsReplaceInput,
    GastronomyEventsReplaceInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkGastronomyCanEditFaqs } from './gastronomy.permissions';

/**
 * Upper bound on the rows one read pulls back.
 *
 * `findAll` paginates, and the agenda is read whole — so an unstated page size
 * would silently truncate a long agenda rather than fail. Sized well above the
 * schema's own ceiling (`GASTRONOMY_EVENTS_MAX_ENTRIES`), so an agenda that
 * passed validation on the way in can always be read back out.
 */
const EVENTS_READ_PAGE_SIZE = 500;

/**
 * Loads a gastronomy listing by ID or throws NOT_FOUND.
 *
 * @param model - The GastronomyModel instance.
 * @param gastronomyId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The gastronomy DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireGastronomy(
    model: GastronomyModel,
    gastronomyId: string,
    tx?: ServiceContext['tx']
) {
    const entity = await model.findById(gastronomyId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy listing not found');
    }
    return entity;
}

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
 * own Postgres, not assumed. `GastronomyEventTimeSchema` rejects seconds ON
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
 * @returns The row with its times normalised to `HH:MM`.
 */
export function projectEvent<T extends { startTime: string; endTime: string | null }>(row: T): T {
    return { ...row, startTime: toClockTime(row.startTime), endTime: toClockTime(row.endTime) };
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
 * @param model - GastronomyModel instance.
 * @param data - `{ gastronomyId }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyEventsOutput>`.
 */
export async function getGastronomyEvents(
    model: GastronomyModel,
    data: GastronomyEventsGetInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyEventsOutput>> {
    try {
        const parseResult = GastronomyEventsGetInputSchema.safeParse(data);
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
        const { gastronomyId } = parseResult.data;

        await requireGastronomy(model, gastronomyId, ctx?.tx);

        const eventModel = new GastronomyEventModel();
        const { items: rows } = await eventModel.findAll(
            { gastronomyId },
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
                message: err instanceof Error ? err.message : 'Failed to read gastronomy events'
            }
        };
    }
}

/**
 * Replaces a listing's agenda with the submitted document.
 *
 * Permission: `COMMERCE_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL`
 * (staff). The `MANAGE_GASTRONOMY_EVENTS` entitlement is the route's gate, not
 * this one's.
 *
 * An EMPTY `events` array is a legitimate submission and takes the agenda down:
 * a venue that stopped doing live music needs a way to say so, and refusing the
 * empty document would leave them with no way to.
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
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - `{ gastronomyId, agenda }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyEventsOutput>` with the agenda as now stored.
 */
export async function replaceGastronomyEvents(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyEventsReplaceInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyEventsOutput>> {
    try {
        const parseResult = GastronomyEventsReplaceInputSchema.safeParse(data);
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
        const { gastronomyId } = validated;

        const gastronomy = await requireGastronomy(model, gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const eventModel = new GastronomyEventModel();

        // ONE transaction for the whole document, same reason the carta's write
        // is one: an agenda half-written — the old entries gone and the new ones
        // not yet in — is a published page the owner never described.
        const runInTx = async (tx: ServiceContext['tx']): Promise<void> => {
            await eventModel.hardDelete({ gastronomyId }, tx);

            for (const [index, event] of validated.agenda.events.entries()) {
                await eventModel.create(
                    {
                        gastronomyId,
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
                        createdById: actor.id,
                        updatedById: actor.id
                    },
                    tx
                );
            }
        };

        if (ctx?.tx) {
            await runInTx(ctx.tx);
        } else {
            await withTransaction(async (tx) => {
                await runInTx(tx);
            });
        }

        return await getGastronomyEvents(model, { gastronomyId }, ctx);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : 'Failed to replace gastronomy events'
            }
        };
    }
}
