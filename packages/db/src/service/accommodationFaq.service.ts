import { dbLogger } from '@repo/db/utils/logger.js';
import { BuiltinRoleTypeEnum, type UserType } from '@repo/types';
import {
    AccommodationFaqModel,
    type AccommodationFaqRecord,
    AccommodationModel,
    type SelectAccommodationFaqFilter
} from '../model/index.js';
import type {
    InsertAccommodationFaq,
    PaginationParams,
    UpdateAccommodationFaqData
} from '../types/db-types.js';
import { assertExists, sanitizePartialUpdate } from '../utils/db-utils.js';

/**
 * Service layer for managing accommodation FAQ operations.
 * Handles business logic, authorization, and interacts with the AccommodationFaqModel.
 */
export class AccommodationFaqService {
    /**
     * Checks if the given actor is an admin.
     * @param actor - The user performing the action.
     * @returns true if the actor is an admin, false otherwise.
     */
    private static isAdmin(actor: UserType): boolean {
        return actor.roleId === BuiltinRoleTypeEnum.ADMIN;
    }

    /**
     * Asserts that the actor is either the owner of the resource or an admin.
     * @param ownerId - The ID of the resource owner.
     * @param actor - The user performing the action.
     * @throws Error if the actor is neither the owner nor an admin.
     */
    private static assertOwnerOrAdmin(ownerId: string, actor: UserType): void {
        if (actor.id !== ownerId && !AccommodationFaqService.isAdmin(actor)) {
            dbLogger.warn(
                {
                    actorId: actor.id,
                    requiredOwnerId: ownerId
                },
                'Forbidden access attempt'
            );
            throw new Error('Forbidden');
        }
    }

    /**
     * Create a new FAQ entry.
     * @param data - The data for the new FAQ entry.
     * @param actor - The user creating the FAQ entry.
     * @returns The created FAQ record.
     * @throws Error if actor is not authorized or creation fails.
     */
    async create(data: InsertAccommodationFaq, actor: UserType): Promise<AccommodationFaqRecord> {
        dbLogger.info({ actor: actor.id }, 'creating accommodation FAQ');

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(
                data.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${data.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationFaqService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            const dataWithAudit: InsertAccommodationFaq = {
                ...data,
                createdById: actor.id,
                updatedById: actor.id
            };
            const createdFaq = await AccommodationFaqModel.createFaq(dataWithAudit);
            dbLogger.info({ faqId: createdFaq.id }, 'accommodation FAQ created successfully');
            return createdFaq;
        } catch (error) {
            dbLogger.error(error, 'failed to create accommodation FAQ');
            throw error;
        }
    }

    /**
     * Get a single FAQ entry by ID.
     * @param id - The ID of the FAQ entry to fetch.
     * @param actor - The user performing the action.
     * @returns The FAQ record.
     * @throws Error if FAQ entry is not found or actor is not authorized.
     */
    async getById(id: string, actor: UserType): Promise<AccommodationFaqRecord> {
        dbLogger.info({ faqId: id, actor: actor.id }, 'fetching FAQ by id');

        try {
            const faq = await AccommodationFaqModel.getFaqById(id);
            const existingFaq = assertExists(faq, `FAQ ${id} not found`);

            // Get the accommodation to check ownership
            const accommodation = await AccommodationModel.getAccommodationById(
                existingFaq.accommodationId
            );
            if (!accommodation) {
                throw new Error(`Accommodation ${existingFaq.accommodationId} not found`);
            }

            // Check if actor is owner or admin
            AccommodationFaqService.assertOwnerOrAdmin(accommodation.ownerId, actor);

            dbLogger.info({ faqId: existingFaq.id }, 'FAQ fetched successfully');
            return existingFaq;
        } catch (error) {
            dbLogger.error(error, 'failed to fetch FAQ by id');
            throw error;
        }
    }

    /**
     * List FAQ entries for an accommodation.
     * @param accommodationId - The ID of the accommodation.
     * @param actor - The user performing the action.
     * @param filter - Pagination options.
     * @returns Array of FAQ records.
     * @throws Error if accommodation is not found, actor is not authorized, or listing fails.
     */
    async list(
        accommodationId: string,
        actor: UserType,
        filter: PaginationParams = {}
    ): Promise<AccommodationFaqRecord[]> {
        dbLogger.info(
            {
                accommodationId,
                actor: actor.id,
                filter
            },
            'listing FAQs for accommodation'
        );

        try {
            // Verify accommodation exists
            const accommodation = await AccommodationModel.getAccommodationById(accommodationId);
            if (!accommodation) {
                throw new Error(`Accommodation ${accommodationId} not found`);
            }

            const faqFilter: SelectAccommodationFaqFilter = {
                accommodationId,
                ...filter,
                includeDeleted: false
            };

            const faqs = await AccommodationFaqModel.listFaqs(faqFilter);
            dbLogger.info({ accommodationId, count: faqs.length }, 'FAQs listed successfully');
            return faqs;
        } catch (error) {
            dbLogger.error(error, 'failed to list FAQs');
            throw error;
        }
    }

    /**
     * Update fields on an existing FAQ entry.
     * @param id - The ID of the FAQ entry to update.
     * @param changes - The partial fields to update.
     * @param actor - The user performing the action.
     * @returns The updated FAQ record.
     * @throws Error if FAQ entry is not found, actor is not authorized, or update fails.
     */
    async update(
        id: string,
        changes: UpdateAccommodationFaqData,
        actor: UserType
    ): Promise<AccommodationFaqRecord> {
        dbLogger.info({ faqId: id, actor: actor.id }, 'updating FAQ');

        const existingFaq = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFaq.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFaq.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFaqService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        const dataToUpdate = sanitizePartialUpdate(changes);

        try {
            const dataWithAudit: UpdateAccommodationFaqData = {
                ...dataToUpdate,
                updatedById: actor.id
            };
            const updatedFaq = await AccommodationFaqModel.updateFaq(existingFaq.id, dataWithAudit);
            dbLogger.info({ faqId: updatedFaq.id }, 'FAQ updated successfully');
            return updatedFaq;
        } catch (error) {
            dbLogger.error(error, 'failed to update FAQ');
            throw error;
        }
    }

    /**
     * Soft-delete a FAQ entry by setting the deletedAt timestamp.
     * @param id - The ID of the FAQ entry to delete.
     * @param actor - The user performing the action.
     * @throws Error if FAQ entry is not found, actor is not authorized, or deletion fails.
     */
    async delete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ faqId: id, actor: actor.id }, 'soft deleting FAQ');

        const existingFaq = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFaq.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFaq.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFaqService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFaqModel.softDeleteFaq(id);
            dbLogger.info({ faqId: id }, 'FAQ soft deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to soft delete FAQ');
            throw error;
        }
    }

    /**
     * Restore a soft-deleted FAQ entry by clearing the deletedAt timestamp.
     * @param id - The ID of the FAQ entry to restore.
     * @param actor - The user performing the action.
     * @throws Error if FAQ entry is not found, actor is not authorized, or restoration fails.
     */
    async restore(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ faqId: id, actor: actor.id }, 'restoring FAQ');

        const existingFaq = await this.getById(id, actor);

        // Get the accommodation to check ownership
        const accommodation = await AccommodationModel.getAccommodationById(
            existingFaq.accommodationId
        );
        if (!accommodation) {
            throw new Error(`Accommodation ${existingFaq.accommodationId} not found`);
        }

        // Check if actor is owner or admin
        AccommodationFaqService.assertOwnerOrAdmin(accommodation.ownerId, actor);

        try {
            await AccommodationFaqModel.restoreFaq(id);
            dbLogger.info({ faqId: id }, 'FAQ restored successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to restore FAQ');
            throw error;
        }
    }

    /**
     * Permanently delete a FAQ entry record from the database.
     * @param id - The ID of the FAQ entry to hard delete.
     * @param actor - The user performing the action (must be an admin).
     * @throws Error if FAQ entry is not found, actor is not authorized, or deletion fails.
     */
    async hardDelete(id: string, actor: UserType): Promise<void> {
        dbLogger.info({ faqId: id, actor: actor.id }, 'hard deleting FAQ');

        // Only admins can hard delete
        if (!AccommodationFaqService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete FAQs');
        }

        await this.getById(id, actor);

        try {
            await AccommodationFaqModel.hardDeleteFaq(id);
            dbLogger.info({ faqId: id }, 'FAQ hard deleted successfully');
        } catch (error) {
            dbLogger.error(error, 'failed to hard delete FAQ');
            throw error;
        }
    }
}
