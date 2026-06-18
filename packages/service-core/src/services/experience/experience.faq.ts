/**
 * experience.faq.ts
 *
 * FAQ service helpers for experience listings (SPEC-240 T-016).
 *
 * Mirrors the FAQ management pattern from `gastronomy.faq.ts`.
 *
 * ## Permission model
 *
 * - **Owner ops** (add / update / remove / reorder):
 *   Gated on `COMMERCE_FAQS_EDIT_OWN` for listing owners, or
 *   `COMMERCE_EDIT_ALL` for staff (via `checkExperienceCanEditFaqs`).
 * - **Admin list** (`adminGetFaqs`):
 *   Gated on `COMMERCE_VIEW_ALL` (staff) or `COMMERCE_VIEW_ALL` as
 *   viewOwn fallback; same as `checkExperienceCanViewAll`.
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
 * @module experience.faq
 */

import { ExperienceFaqModel, type ExperienceModel } from '@repo/db';
import {
    type ExperienceFaq,
    type ExperienceFaqAddInput,
    ExperienceFaqAddInputSchema,
    type ExperienceFaqListInput,
    ExperienceFaqListInputSchema,
    type ExperienceFaqListOutput,
    type ExperienceFaqRemoveInput,
    ExperienceFaqRemoveInputSchema,
    type ExperienceFaqReorderInput,
    ExperienceFaqReorderInputSchema,
    type ExperienceFaqSingleOutput,
    type ExperienceFaqUpdateInput,
    ExperienceFaqUpdateInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkExperienceCanEditFaqs, checkExperienceCanView } from './experience.permissions';

// ---------------------------------------------------------------------------
// Internal helper — load listing or throw NOT_FOUND
// ---------------------------------------------------------------------------

/**
 * Loads an experience listing by ID or throws NOT_FOUND.
 *
 * @param model - The ExperienceModel instance.
 * @param experienceId - UUID of the listing.
 * @param tx - Optional Drizzle transaction client.
 * @returns The experience DB row.
 * @throws {ServiceError} NOT_FOUND when no matching row exists.
 */
async function requireExperience(
    model: ExperienceModel,
    experienceId: string,
    tx?: ServiceContext['tx']
) {
    const entity = await model.findById(experienceId, tx);
    if (!entity) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience listing not found');
    }
    return entity;
}

// ---------------------------------------------------------------------------
// FAQ helpers (called by ExperienceService public methods)
// ---------------------------------------------------------------------------

/**
 * Adds a FAQ entry to an experience listing.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * `displayOrder` is auto-assigned as `max(existing) + 1` or 0 when no FAQs exist yet.
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated add-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<ExperienceFaqSingleOutput>` containing the created FAQ.
 */
export async function addExperienceFaq(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqAddInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<ExperienceFaqSingleOutput>> {
    try {
        const parseResult = ExperienceFaqAddInputSchema.safeParse(data);
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

        const experience = await requireExperience(model, validated.experienceId, ctx?.tx);
        checkExperienceCanEditFaqs(actor, experience);

        const faqModel = new ExperienceFaqModel();

        // Compute next displayOrder: max(existing) + 1 or 0 when none exist.
        const existing = await faqModel.findAll(
            { experienceId: validated.experienceId, deletedAt: null },
            { pageSize: 1, sortBy: 'displayOrder', sortOrder: 'desc' },
            undefined,
            ctx?.tx
        );
        const topOrder = existing.items[0]?.displayOrder ?? -1;
        const nextOrder = typeof topOrder === 'number' && topOrder >= 0 ? topOrder + 1 : 0;

        const faqToCreate = {
            ...validated.faq,
            experienceId: validated.experienceId,
            displayOrder: nextOrder
        };

        const createdFaq = await faqModel.create(faqToCreate, ctx?.tx);
        return { data: { faq: createdFaq as ExperienceFaq } };
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
 * Updates an existing FAQ entry on an experience listing.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified experience (enforced by `experienceId` check).
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated update-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<ExperienceFaqSingleOutput>` containing the updated FAQ.
 */
export async function updateExperienceFaq(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqUpdateInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<ExperienceFaqSingleOutput>> {
    try {
        const parseResult = ExperienceFaqUpdateInputSchema.safeParse(data);
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

        const experience = await requireExperience(model, validated.experienceId, ctx?.tx);
        checkExperienceCanEditFaqs(actor, experience);

        const faqModel = new ExperienceFaqModel();
        const faq = await faqModel.findById(validated.faqId, ctx?.tx);
        if (!faq || faq.experienceId !== validated.experienceId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'FAQ not found for this experience listing'
            );
        }

        const updatedFaq = await faqModel.update(
            { id: validated.faqId },
            { ...validated.faq, experienceId: validated.experienceId },
            ctx?.tx
        );
        if (!updatedFaq) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Failed to update FAQ');
        }

        return { data: { faq: updatedFaq as ExperienceFaq } };
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
 * Removes (soft-deletes) a FAQ from an experience listing.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 * The FAQ must belong to the specified experience.
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated remove-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function removeExperienceFaq(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqRemoveInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = ExperienceFaqRemoveInputSchema.safeParse(data);
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

        const experience = await requireExperience(model, validated.experienceId, ctx?.tx);
        checkExperienceCanEditFaqs(actor, experience);

        const faqModel = new ExperienceFaqModel();
        const faq = await faqModel.findById(validated.faqId, ctx?.tx);
        if (!faq || faq.experienceId !== validated.experienceId) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'FAQ not found for this experience listing'
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
 * Lists FAQs for an experience listing (public path).
 *
 * Permission: any actor that can view the listing may read its FAQs.
 * FAQs are returned ordered by `displayOrder ASC NULLS LAST, createdAt ASC`.
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated list-FAQ input.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<ExperienceFaqListOutput>` containing the FAQ array.
 */
export async function listExperienceFaqs(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<ExperienceFaqListOutput>> {
    try {
        const parseResult = ExperienceFaqListInputSchema.safeParse(data);
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
        const experience = await model.findWithRelations(
            { id: validated.experienceId },
            { faqs: true },
            ctx?.tx
        );
        if (!experience) {
            return {
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Experience listing not found' }
            };
        }

        // Public visibility check (any actor that can view the listing).
        checkExperienceCanView(actor);

        // TYPE-WORKAROUND: Drizzle widens the entity type when loading relations;
        // `faqs` is not part of the base Experience type.
        const faqs = (experience as unknown as { faqs?: unknown[] }).faqs ?? [];
        return { data: { faqs: faqs as ExperienceFaq[] } };
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
 * Reorders FAQs on an experience listing (SPEC-177 pattern).
 *
 * Steps:
 * 1. Gate on `checkExperienceCanEditFaqs` (same as add/update/remove).
 * 2. Load all active FAQs for the listing and validate every `faqId` in
 *    `order` belongs to this experience (unknown IDs → VALIDATION_ERROR).
 * 3. Apply each `displayOrder` value individually via `faqModel.update`.
 *
 * Permission: `COMMERCE_FAQS_EDIT_OWN` (listing owner) or `COMMERCE_EDIT_ALL` (staff).
 *
 * @param model - ExperienceModel instance.
 * @param actor - The actor performing the action.
 * @param data - Validated reorder input: `{ experienceId, order: [{ faqId, displayOrder }] }`.
 * @param ctx - Optional service context for transaction propagation.
 * @returns `ServiceOutput<{ success: true }>` on success.
 */
export async function reorderExperienceFaqs(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceFaqReorderInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ success: true }>> {
    try {
        const parseResult = ExperienceFaqReorderInputSchema.safeParse(data);
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

        const experience = await requireExperience(model, validated.experienceId, ctx?.tx);
        checkExperienceCanEditFaqs(actor, experience);

        const faqModel = new ExperienceFaqModel();

        // Load all active FAQs to validate ownership of every faqId in `order`.
        const { items: existingFaqs } = await faqModel.findAll(
            { experienceId: validated.experienceId, deletedAt: null },
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
                `Unknown or foreign faqId(s) for this experience listing: ${unknownIds.join(', ')}`
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
