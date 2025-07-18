/**
 * @fileoverview Normalization functions for EventOrganizer entities.
 * Contains functions to clean, validate, and standardize input data for event organizers.
 */

import type { EventOrganizerType, UpdateEventOrganizerInputType } from '@repo/types';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating an event organizer.
 * Performs data cleaning and standardization including:
 * - Trims whitespace from string fields
 * - Normalizes admin information
 * - Prepares contact info and social media data for future normalization
 *
 * @param data - The original input data for creation
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized event organizer data
 *
 * @example
 * ```typescript
 * const normalized = normalizeCreateInput(rawData, actor);
 * // Returns data with trimmed strings and normalized admin info
 * ```
 */
export const normalizeCreateInput = (
    data: EventOrganizerType,
    _actor: Actor
): EventOrganizerType => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);
    return {
        id: data.id,
        name: data.name.trim(),
        logo: data.logo?.trim(),
        contactInfo: data.contactInfo, // TODO: normalizeContactInfo if exists
        social: data.social, // TODO: normalizeSocial if exists
        lifecycleState: data.lifecycleState,
        adminInfo,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdById: data.createdById,
        updatedById: data.updatedById,
        deletedAt: data.deletedAt,
        deletedById: data.deletedById
    };
};

/**
 * Normalizes the input data for updating an event organizer.
 * Performs selective data cleaning and standardization for update operations including:
 * - Trims whitespace from string fields when present
 * - Normalizes admin information if provided
 * - Handles partial updates by only processing provided fields
 *
 * @param data - The original input data for update (partial fields)
 * @param _actor - The actor performing the action (unused in this normalization)
 * @returns The normalized update data with only provided fields processed
 *
 * @example
 * ```typescript
 * const normalized = normalizeUpdateInput({ name: ' Updated Name ' }, actor);
 * // Returns: { name: 'Updated Name' }
 * ```
 */
export const normalizeUpdateInput = (
    data: UpdateEventOrganizerInputType,
    _actor: Actor
): UpdateEventOrganizerInputType => {
    const result: UpdateEventOrganizerInputType = {};
    if (data.id) result.id = data.id;
    if (data.name) result.name = data.name.trim();
    if (data.logo) result.logo = data.logo.trim();
    if (data.contactInfo) result.contactInfo = data.contactInfo; // TODO: normalizeContactInfo
    if (data.social) result.social = data.social; // TODO: normalizeSocial
    if (data.lifecycleState) result.lifecycleState = data.lifecycleState;
    if (data.adminInfo) result.adminInfo = normalizeAdminInfo(data.adminInfo);
    if (data.createdAt) result.createdAt = data.createdAt;
    if (data.updatedAt) result.updatedAt = data.updatedAt;
    if (data.createdById) result.createdById = data.createdById;
    if (data.updatedById) result.updatedById = data.updatedById;
    if (data.deletedAt) result.deletedAt = data.deletedAt;
    if (data.deletedById) result.deletedById = data.deletedById;
    return result;
};
