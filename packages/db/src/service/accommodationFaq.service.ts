import { logger } from '@repo/logger';
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

const log = logger.createLogger('AccommodationFaqService');

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
            log.warn('Forbidden access attempt', 'assertOwnerOrAdmin', {
                actorId: actor.id,
                requiredOwnerId: ownerId
            });
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
        log.info('creating accommodation FAQ', 'create', { actor: actor.id });

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
            log.info('accommodation FAQ created successfully', 'create', {
                faqId: createdFaq.id
            });
            return createdFaq;
        } catch (error) {
            log.error('failed to create accommodation FAQ', 'create', error, { actor: actor.id });
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
        log.info('fetching FAQ by id', 'getById', { faqId: id, actor: actor.id });

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

            log.info('FAQ fetched successfully', 'getById', {
                faqId: existingFaq.id
            });
            return existingFaq;
        } catch (error) {
            log.error('failed to fetch FAQ by id', 'getById', error, {
                faqId: id,
                actor: actor.id
            });
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
        log.info('listing FAQs for accommodation', 'list', {
            accommodationId,
            actor: actor.id,
            filter
        });

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
            log.info('FAQs listed successfully', 'list', {
                accommodationId,
                count: faqs.length
            });
            return faqs;
        } catch (error) {
            log.error('failed to list FAQs', 'list', error, {
                accommodationId,
                actor: actor.id
            });
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
        log.info('updating FAQ', 'update', { faqId: id, actor: actor.id });

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
            log.info('FAQ updated successfully', 'update', {
                faqId: updatedFaq.id
            });
            return updatedFaq;
        } catch (error) {
            log.error('failed to update FAQ', 'update', error, {
                faqId: id,
                actor: actor.id
            });
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
        log.info('soft deleting FAQ', 'delete', { faqId: id, actor: actor.id });

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
            log.info('FAQ soft deleted successfully', 'delete', { faqId: id });
        } catch (error) {
            log.error('failed to soft delete FAQ', 'delete', error, {
                faqId: id,
                actor: actor.id
            });
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
        log.info('restoring FAQ', 'restore', { faqId: id, actor: actor.id });

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
            log.info('FAQ restored successfully', 'restore', { faqId: id });
        } catch (error) {
            log.error('failed to restore FAQ', 'restore', error, {
                faqId: id,
                actor: actor.id
            });
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
        log.info('hard deleting FAQ', 'hardDelete', { faqId: id, actor: actor.id });

        // Only admins can hard delete
        if (!AccommodationFaqService.isAdmin(actor)) {
            throw new Error('Forbidden: Only admins can permanently delete FAQs');
        }

        await this.getById(id, actor);

        try {
            await AccommodationFaqModel.hardDeleteFaq(id);
            log.info('FAQ hard deleted successfully', 'hardDelete', { faqId: id });
        } catch (error) {
            log.error('failed to hard delete FAQ', 'hardDelete', error, {
                faqId: id,
                actor: actor.id
            });
            throw error;
        }
    }
}
