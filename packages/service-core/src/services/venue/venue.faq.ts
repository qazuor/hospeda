/**
 * gastronomy.faq.ts
 *
 * FAQ service helpers for gastronomy listings (SPEC-239 T-037).
 *
 * Mirrors the FAQ management pattern from `AccommodationService.addFaq` /
 * `removeFaq` / `updateFaq` / `getFaqs` / `reorderFaqs`.
 *
 * ## Permission model
 *
 * - **Owner ops** (add / update / remove / reorder):
 *   Gated on `VENUE_EDIT_OWN` for listing owners, or
 *   `VENUE_EDIT_ALL` for staff (via `checkVenueCanEditFaqs`).
 * - **Admin list** (`adminGetFaqs`):
 *   Gated on `VENUE_VIEW_ALL` (staff); same as `checkVenueCanViewAll`.
 * - **Public list** (`getFaqs`):
 *   Open — any actor that can view the listing can read its FAQs.
 *
 * ## display_order convention
 *
 * FAQs are read ordered by `displayOrder ASC NULLS LAST, createdAt ASC`
 * (NULLS-LAST matches the pattern established by SPEC-177 destination/accommodation FAQs).
 * On `addFaq`, `displayOrder` is set to `max(existing displayOrder) + 1`, or 0 if none exist.
 * On `reorderFaqs`, the caller supplies an explicit `{ faqId, displayOrder }[]` array.
 *
 * @module gastronomy.faq
 */

import { type DrizzleClient, VenueFaqModel, type VenueModel, withTransaction } from '@repo/db';
import {
    ServiceErrorCode,
    type VenueFaq,
    type VenueFaqAddInput,
    VenueFaqAddInputSchema,
    type VenueFaqListInput,
    VenueFaqListInputSchema,
    type VenueFaqListOutput,
    type VenueFaqRemoveInput,
    VenueFaqRemoveInputSchema,
    type VenueFaqReorderInput,
    VenueFaqReorderInputSchema,
    type VenueFaqSingleOutput,
    type VenueFaqUpdateInput,
    VenueFaqUpdateInputSchema
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { recordListingSubEntityEdit } from '../listing/listing-owner-act';
import { checkVenueCanEditFaqEntries, checkVenueCanView } from './venue.permissions';

// ---------------------------------------------------------------------------
// Internal helper — load listing or throw NOT_FOUND
// ---------------------------------------------------------------------------

/**
 * Loads a gastronomy listing by ID or throws NOT_FOUND.
 *
 * @param model - The VenueModel instance.
 * @param gastronomyId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The gastronomy DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireVenue(model: VenueModel, gastronomyId: string, tx?: ServiceContext['tx']) {
    const entity = await model.findById(gastronomyId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy listing not found');
    }
    return entity;
}

// ---------------------------------------------------------------------------
// FAQ helpers (called by VenueService public methods)
// ---------------------------------------------------------------------------

/**
 * Adds a FAQ entry to a gastronomy listing.
 *
 * Permission: `VENUE_EDIT_OWN` (listing owner) or `VENUE_EDIT_ALL` (staff).
 * `displayOrder` is auto-assigned as `max(existing) + 1` or 0 when no FAQs exist yet.
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated add-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqSingleOutput>` containing the created FAQ.
 */
export async function addVenueFaq(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueFaqSingleOutput>> {
    try {
        const parseResult = VenueFaqAddInputSchema.safeParse(data);
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

        // HOS-1642 (AC:V9a:6): the write and its owner-act event share one
        // transaction — the event commits or rolls back WITH the FAQ row.
        const run = async (tx: DrizzleClient): Promise<ServiceOutput<VenueFaqSingleOutput>> => {
            const venue = await requireVenue(model, validated.gastronomyId, tx);
            checkVenueCanEditFaqEntries(actor, venue);

            const faqModel = new VenueFaqModel();

            // Compute next displayOrder: max(existing) + 1 or 0 when none exist.
            const existing = await faqModel.findAll(
                { gastronomyId: validated.gastronomyId, deletedAt: null },
                { pageSize: 1, sortBy: 'displayOrder', sortOrder: 'desc' },
                undefined,
                tx
            );
            const topOrder = existing.items[0]?.displayOrder ?? -1;
            const nextOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

            const faqToCreate = {
                ...validated.faq,
                gastronomyId: validated.gastronomyId,
                displayOrder: nextOrder
            };

            const createdFaq = await faqModel.create(faqToCreate, tx);
            // Post-write, inside the tx; the field name only, never the
            // question/answer text (DEC-DATA-005).
            await recordListingSubEntityEdit({
                entityType: 'venue',
                listing: { id: venue.id, ownerId: venue.ownerId, name: venue.name },
                actor,
                field: 'faqs',
                ctx: { ...ctx, tx }
            });
            return { data: { faq: createdFaq as VenueFaq } };
        };
        if (ctx?.tx) {
            return await run(ctx.tx);
        }
        return await withTransaction(run);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Updates an existing FAQ entry on a gastronomy listing.
 *
 * Permission: `VENUE_EDIT_OWN` (listing owner) or `VENUE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified gastronomy (enforced by `gastronomyId` check).
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated update-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqSingleOutput>` containing the updated FAQ.
 */
export async function updateVenueFaq(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqUpdateInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueFaqSingleOutput>> {
    try {
        const parseResult = VenueFaqUpdateInputSchema.safeParse(data);
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

        // HOS-1642 (AC:V9a:6): write + owner-act event in one transaction.
        const run = async (tx: DrizzleClient): Promise<ServiceOutput<VenueFaqSingleOutput>> => {
            const venue = await requireVenue(model, validated.gastronomyId, tx);
            checkVenueCanEditFaqEntries(actor, venue);

            const faqModel = new VenueFaqModel();
            const faq = await faqModel.findById(validated.faqId, tx);
            if (!faq || faq.gastronomyId !== validated.gastronomyId || faq.deletedAt) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'FAQ not found for this gastronomy listing'
                );
            }

            const updatedFaq = await faqModel.update(
                { id: validated.faqId },
                { ...validated.faq, gastronomyId: validated.gastronomyId },
                tx
            );
            if (!updatedFaq) {
                throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
            }

            // Post-write, inside the tx; field name only (DEC-DATA-005).
            await recordListingSubEntityEdit({
                entityType: 'venue',
                listing: { id: venue.id, ownerId: venue.ownerId, name: venue.name },
                actor,
                field: 'faqs',
                ctx: { ...ctx, tx }
            });
            return { data: { faq: updatedFaq as VenueFaq } };
        };
        if (ctx?.tx) {
            return await run(ctx.tx);
        }
        return await withTransaction(run);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Removes (soft-deletes) a FAQ from a gastronomy listing.
 *
 * Permission: `VENUE_EDIT_OWN` (listing owner) or `VENUE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified gastronomy.
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated remove-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removeVenueFaq(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqRemoveInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = VenueFaqRemoveInputSchema.safeParse(data);
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

        // HOS-1642 (AC:V9a:6): write + owner-act event in one transaction.
        const run = async (tx: DrizzleClient): Promise<ServiceOutput<{ success: true }>> => {
            const venue = await requireVenue(model, validated.gastronomyId, tx);
            checkVenueCanEditFaqEntries(actor, venue);

            const faqModel = new VenueFaqModel();
            const faq = await faqModel.findById(validated.faqId, tx);
            if (!faq || faq.gastronomyId !== validated.gastronomyId || faq.deletedAt) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'FAQ not found for this gastronomy listing'
                );
            }

            await faqModel.softDelete({ id: validated.faqId }, actor.id, tx);
            // Post-write, inside the tx; field name only (DEC-DATA-005).
            await recordListingSubEntityEdit({
                entityType: 'venue',
                listing: { id: venue.id, ownerId: venue.ownerId, name: venue.name },
                actor,
                field: 'faqs',
                ctx: { ...ctx, tx }
            });
            return { data: { success: true } };
        };
        if (ctx?.tx) {
            return await run(ctx.tx);
        }
        return await withTransaction(run);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Lists FAQs for a gastronomy listing (public path).
 *
 * Permission: any actor that can view the listing may read its FAQs.
 * FAQs are returned ordered by `displayOrder ASC NULLS LAST, createdAt ASC`.
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated list-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqListOutput>` containing the FAQ array.
 */
export async function listVenueFaqs(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<VenueFaqListOutput>> {
    try {
        const parseResult = VenueFaqListInputSchema.safeParse(data);
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

        // Load the listing with its FAQs relation for a single-query pattern.
        const venue = await model.findWithRelations(
            { id: validated.gastronomyId },
            { faqs: true },
            ctx?.tx
        );
        if (!venue) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Gastronomy listing not found' }
            };
        }

        // Public visibility check (any actor that can view the listing).
        checkVenueCanView(actor);

        // TYPE-WORKAROUND: Drizzle widens the entity type when loading relations;
        // `faqs` is not part of the base Gastronomy type.
        const faqs = (venue as unknown as { faqs?: unknown[] }).faqs ?? [];
        return { data: { faqs: faqs as VenueFaq[] } };
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Reorders FAQs on a gastronomy listing (SPEC-177 pattern).
 *
 * Steps:
 * 1. Gate on `checkVenueCanEditFaqs` (same as add/update/remove).
 * 2. Load all active FAQs for the listing and validate every `faqId` in
 *    `order` belongs to this gastronomy (unknown IDs → VALIDATION_ERROR).
 * 3. Apply each `displayOrder` value individually via `faqModel.update`.
 *
 * Permission: `VENUE_EDIT_OWN` (listing owner) or `VENUE_EDIT_ALL` (staff).
 *
 * @param model - VenueModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated reorder input: `{ gastronomyId, order: [{ faqId, displayOrder }] }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function reorderVenueFaqs(
    model: VenueModel,
    actor: Actor,
    data: VenueFaqReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = VenueFaqReorderInputSchema.safeParse(data);
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

        // HOS-1642 (AC:V9a:6): the whole reorder — previously N bare updates
        // with a per-call `ctx?.tx` and no boundary — now runs in ONE
        // transaction with its owner-act event, so a partial reorder is no
        // longer possible and the event cannot outlive (or miss) the writes.
        const run = async (tx: DrizzleClient): Promise<ServiceOutput<{ success: true }>> => {
            const venue = await requireVenue(model, validated.gastronomyId, tx);
            checkVenueCanEditFaqEntries(actor, venue);

            const faqModel = new VenueFaqModel();

            // Load all active FAQs to validate ownership of every faqId in `order`.
            const { items: existingFaqs } = await faqModel.findAll(
                { gastronomyId: validated.gastronomyId, deletedAt: null },
                { pageSize: 200 },
                undefined,
                tx
            );
            const existingIds = new Set(existingFaqs.map((f) => f.id));

            const unknownIds = validated.order
                .map((item) => item.faqId)
                .filter((id) => !existingIds.has(id));

            if (unknownIds.length > 0) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Unknown or foreign faqId(s) for this gastronomy listing: ${unknownIds.join(', ')}`
                );
            }

            // Apply each displayOrder update.
            await Promise.all(
                validated.order.map((item) =>
                    faqModel.update({ id: item.faqId }, { displayOrder: item.displayOrder }, tx)
                )
            );

            // One event for the whole reorder, post-write, inside the tx;
            // field name only (DEC-DATA-005).
            await recordListingSubEntityEdit({
                entityType: 'venue',
                listing: { id: venue.id, ownerId: venue.ownerId, name: venue.name },
                actor,
                field: 'faqs',
                ctx: { ...ctx, tx }
            });

            return { data: { success: true } };
        };
        if (ctx?.tx) {
            return await run(ctx.tx);
        }
        return await withTransaction(run);
    } catch (err) {
        if (err instanceof ServiceError) {
            return { error: { code: err.code, message: err.message } };
        }
        return {
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: err instanceof Error ? err.message : String(err)
            }
        };
    }
}
