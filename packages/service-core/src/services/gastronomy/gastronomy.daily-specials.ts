/**
 * gastronomy.daily-specials.ts
 *
 * The menú del día — read and whole-document write (HOS-1041).
 *
 * ## The expiry lives HERE, in a read, and nowhere else
 *
 * Owner decision (2026-09-01): a special stops being published because the
 * READ stops returning it, not because a job flipped a column. That choice is
 * worth stating because the alternative looks equivalent and is not. A cron
 * that expires rows has a window between the dish going stale and the job
 * running; it has to be re-run after an outage; it needs its own alerting; and
 * when it fails, the visible symptom is a public page confidently advertising
 * yesterday's fish. A `valid_until >= today` predicate has none of those
 * states — there is nothing to be behind on.
 *
 * So there is no cron job in this feature, and adding one later would not be an
 * optimisation, it would be a second source of truth for the same fact.
 *
 * ## Two reads, and the difference between them matters
 *
 * `getGastronomyDailySpecials` takes an OPTIONAL `validOn`:
 *
 * - The public detail route passes today (resolved in the AR market timezone),
 *   so a diner sees exactly what is on offer.
 * - The owner's editor passes NOTHING, and must: an owner scheduling next
 *   Friday's special needs to see the row they just saved, and an owner looking
 *   at last week's needs to find it in order to change it. Filtering the
 *   editor would silently swallow both, and the owner's only evidence would be
 *   an empty form where they had typed something.
 *
 * ## Permissions vs. entitlements
 *
 * This module answers PERMISSION only — `COMMERCE_EDIT_OWN` on your own
 * listing, `COMMERCE_EDIT_ALL` for staff, via the same
 * {@link checkGastronomyCanEditFaqs} gate the carta and FAQ helpers use.
 * Whether the caller's PLAN includes the menú del día is an entitlement
 * (`MANAGE_GASTRONOMY_DAILY_SPECIAL`), checked at the route before this is
 * reached — the same split `gastronomy.menu.ts` makes.
 *
 * @module gastronomy.daily-specials
 */

import { GastronomyDailySpecialModel, type GastronomyModel, withTransaction } from '@repo/db';
import {
    type GastronomyDailySpecialsGetInput,
    GastronomyDailySpecialsGetInputSchema,
    type GastronomyDailySpecialsOutput,
    type GastronomyDailySpecialsReplaceInput,
    GastronomyDailySpecialsReplaceInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkGastronomyCanEditFaqs } from './gastronomy.permissions';

/**
 * Upper bound on the rows the unfiltered (owner) read pulls back.
 *
 * `findAll` paginates, so an unstated page size would silently truncate rather
 * than fail. Sized well past the schema's own ceiling
 * (`GASTRONOMY_DAILY_SPECIALS_MAX`) because the owner's read is NOT filtered by
 * the window: it returns every special the listing has ever accumulated, and
 * the payload cap only bounds what one save writes, not what many saves left
 * behind.
 */
const DAILY_SPECIALS_READ_PAGE_SIZE = 1000;

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
 * Reads a listing's menú del día.
 *
 * Open to any actor that can see the listing: a menú del día is public content,
 * and the caller-facing projection is the route's business, not this
 * function's.
 *
 * @param model - GastronomyModel instance.
 * @param data - `{ gastronomyId, validOn? }`. Pass `validOn` (a `YYYY-MM-DD`
 *   resolved in the AR market timezone) for the PUBLIC read; omit it for the
 *   owner's, which must include scheduled and elapsed rows.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyDailySpecialsOutput>`.
 */
export async function getGastronomyDailySpecials(
    model: GastronomyModel,
    data: GastronomyDailySpecialsGetInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyDailySpecialsOutput>> {
    try {
        const parseResult = GastronomyDailySpecialsGetInputSchema.safeParse(data);
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
        const { gastronomyId, validOn } = parseResult.data;

        await requireGastronomy(model, gastronomyId, ctx?.tx);

        const specialModel = new GastronomyDailySpecialModel();

        // The branch IS the feature. `findValidOn` applies the window in SQL,
        // served by the composite index; the unfiltered path is the owner's and
        // deliberately sees everything.
        const rows = validOn
            ? await specialModel.findValidOn({ gastronomyId, today: validOn, tx: ctx?.tx })
            : (
                  await specialModel.findAll(
                      { gastronomyId },
                      { pageSize: DAILY_SPECIALS_READ_PAGE_SIZE },
                      undefined,
                      ctx?.tx
                  )
              ).items;

        return { data: { specials: [...rows].sort(byDisplayOrder) } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    err instanceof Error ? err.message : 'Failed to read gastronomy daily specials'
            }
        };
    }
}

/**
 * Replaces a listing's menú del día with the submitted document.
 *
 * Permission: `COMMERCE_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL`
 * (staff). The `MANAGE_GASTRONOMY_DAILY_SPECIAL` entitlement is the route's
 * gate, not this one's.
 *
 * An EMPTY `specials` array is a legitimate submission and takes the menú del
 * día down — the manual escape hatch beside the automatic one, for the venue
 * that sold out at 13:00 and does not want to wait for midnight.
 *
 * The write is whole-document and deletes EVERY special of the listing before
 * reinserting, expired ones included. That is deliberate housekeeping: the
 * rows nothing will ever return again are cleared by the next ordinary save,
 * so the table does not accumulate a year of dead lunches per venue and the
 * owner's unfiltered read stays short.
 *
 * `displayOrder` is assigned from ARRAY POSITION, never read from the payload —
 * so the order a client sees is the order it sent, and two specials cannot be
 * given the same place.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - `{ gastronomyId, specials }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyDailySpecialsOutput>` as now stored — the
 *   OWNER's view, unfiltered, because this is the owner's own write echoing
 *   back and a filtered echo would hide the special they just scheduled.
 */
export async function replaceGastronomyDailySpecials(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyDailySpecialsReplaceInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyDailySpecialsOutput>> {
    try {
        const parseResult = GastronomyDailySpecialsReplaceInputSchema.safeParse(data);
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

        const specialModel = new GastronomyDailySpecialModel();

        // ONE transaction for the whole document, for the reason the carta
        // gives: a half-written menú del día — the old plates gone and the new
        // ones not yet in — is a published offer the owner never described.
        const runInTx = async (tx: ServiceContext['tx']): Promise<void> => {
            await specialModel.hardDelete({ gastronomyId }, tx);

            for (const [index, special] of validated.specials.specials.entries()) {
                await specialModel.create(
                    {
                        gastronomyId,
                        title: special.title,
                        // `''` and `undefined` both mean "no detail"; stored as
                        // NULL so the read has one absent value, not two.
                        description: special.description || null,
                        // `?? null` and NOT `|| null`: `0` is a real price, and
                        // `||` would silently turn it into "a consultar".
                        priceCents: special.priceCents ?? null,
                        validFrom: special.validFrom,
                        validUntil: special.validUntil,
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

        return await getGastronomyDailySpecials(model, { gastronomyId }, ctx);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message:
                    err instanceof Error
                        ? err.message
                        : 'Failed to replace gastronomy daily specials'
            }
        };
    }
}
