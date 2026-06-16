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
 *   Gated on `COMMERCE_FAQS_EDIT_OWN` for listing owners, or
 *   `COMMERCE_EDIT_ALL` for staff (via `checkGastronomyCanEditFaqs`).
 * - **Admin list** (`adminGetFaqs`):
 *   Gated on `COMMERCE_VIEW_ALL` (staff) or `COMMERCE_VIEW_ALL` as
 *   viewOwn fallback; same as `checkGastronomyCanViewAll`.
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

import { GastronomyFaqModel, type GastronomyModel } from '@repo/db';
import {
    type GastronomyFaq,
    type GastronomyFaqAddInput,
    GastronomyFaqAddInputSchema,
    type GastronomyFaqListInput,
    GastronomyFaqListInputSchema,
    type GastronomyFaqListOutput,
    type GastronomyFaqRemoveInput,
    GastronomyFaqRemoveInputSchema,
    type GastronomyFaqReorderInput,
    GastronomyFaqReorderInputSchema,
    type GastronomyFaqSingleOutput,
    type GastronomyFaqUpdateInput,
    GastronomyFaqUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkGastronomyCanEditFaqs, checkGastronomyCanView } from './gastronomy.permissions';

// ---------------------------------------------------------------------------
// Internal helper — load listing or throw NOT_FOUND
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// FAQ helpers (called by GastronomyService public methods)
// ---------------------------------------------------------------------------

/**
 * Adds a FAQ entry to a gastronomy listing.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * `displayOrder` is auto-assigned as `max(existing) + 1` or 0 when no FAQs exist yet.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated add-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqSingleOutput>` containing the created FAQ.
 */
export async function addGastronomyFaq(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyFaqAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyFaqSingleOutput>> {
    try {
        const parseResult = GastronomyFaqAddInputSchema.safeParse(data);
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

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const faqModel = new GastronomyFaqModel();

        // Compute next displayOrder: max(existing) + 1 or 0 when none exist.
        const existing = await faqModel.findAll(
            { gastronomyId: validated.gastronomyId, deletedAt: null },
            { pageSize: 1, sortBy: 'displayOrder', sortOrder: 'desc' },
            undefined,
            ctx?.tx
        );
        const topOrder = existing.items[0]?.displayOrder ?? -1;
        const nextOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

        const faqToCreate = {
            ...validated.faq,
            gastronomyId: validated.gastronomyId,
            displayOrder: nextOrder
        };

        const createdFaq = await faqModel.create(faqToCreate, ctx?.tx);
        return { data: { faq: createdFaq as GastronomyFaq } };
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
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified gastronomy (enforced by `gastronomyId` check).
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated update-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqSingleOutput>` containing the updated FAQ.
 */
export async function updateGastronomyFaq(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyFaqUpdateInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyFaqSingleOutput>> {
    try {
        const parseResult = GastronomyFaqUpdateInputSchema.safeParse(data);
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

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const faqModel = new GastronomyFaqModel();
        const faq = await faqModel.findById(validated.faqId, ctx?.tx);
        if (!faq || faq.gastronomyId !== validated.gastronomyId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'FAQ not found for this gastronomy listing'
            );
        }

        const updatedFaq = await faqModel.update(
            { id: validated.faqId },
            { ...validated.faq, gastronomyId: validated.gastronomyId },
            ctx?.tx
        );
        if (!updatedFaq) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
        }

        return { data: { faq: updatedFaq as GastronomyFaq } };
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
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified gastronomy.
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated remove-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removeGastronomyFaq(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyFaqRemoveInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = GastronomyFaqRemoveInputSchema.safeParse(data);
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

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const faqModel = new GastronomyFaqModel();
        const faq = await faqModel.findById(validated.faqId, ctx?.tx);
        if (!faq || faq.gastronomyId !== validated.gastronomyId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'FAQ not found for this gastronomy listing'
            );
        }

        await faqModel.softDelete({ id: validated.faqId }, ctx?.tx);
        return { data: { success: true } };
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
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated list-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<GastronomyFaqListOutput>` containing the FAQ array.
 */
export async function listGastronomyFaqs(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyFaqListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<GastronomyFaqListOutput>> {
    try {
        const parseResult = GastronomyFaqListInputSchema.safeParse(data);
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
        const gastronomy = await model.findWithRelations(
            { id: validated.gastronomyId },
            { faqs: true },
            ctx?.tx
        );
        if (!gastronomy) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Gastronomy listing not found' }
            };
        }

        // Public visibility check (any actor that can view the listing).
        checkGastronomyCanView(actor);

        // TYPE-WORKAROUND: Drizzle widens the entity type when loading relations;
        // `faqs` is not part of the base Gastronomy type.
        const faqs = (gastronomy as unknown as { faqs?: unknown[] }).faqs ?? [];
        return { data: { faqs: faqs as GastronomyFaq[] } };
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
 * 1. Gate on `checkGastronomyCanEditFaqs` (same as add/update/remove).
 * 2. Load all active FAQs for the listing and validate every `faqId` in
 *    `order` belongs to this gastronomy (unknown IDs → VALIDATION_ERROR).
 * 3. Apply each `displayOrder` value individually via `faqModel.update`.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 *
 * @param model - GastronomyModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated reorder input: `{ gastronomyId, order: [{ faqId, displayOrder }] }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function reorderGastronomyFaqs(
    model: GastronomyModel,
    actor: Actor,
    data: GastronomyFaqReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = GastronomyFaqReorderInputSchema.safeParse(data);
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

        const gastronomy = await requireGastronomy(model, validated.gastronomyId, ctx?.tx);
        checkGastronomyCanEditFaqs(actor, gastronomy);

        const faqModel = new GastronomyFaqModel();

        // Load all active FAQs to validate ownership of every faqId in `order`.
        const { items: existingFaqs } = await faqModel.findAll(
            { gastronomyId: validated.gastronomyId, deletedAt: null },
            { pageSize: 200 },
            undefined,
            ctx?.tx
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
                faqModel.update({ id: item.faqId }, { displayOrder: item.displayOrder }, ctx?.tx)
            )
        );

        return { data: { success: true } };
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
