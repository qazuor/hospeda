/**
 * @fileoverview Normalization functions for EventOrganizer entities.
 * Contains functions to clean, validate, and standardize input data for event organizers.
 */

import type { EventOrganizerCreateInput, EventOrganizerUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';
import { normalizeAdminInfo, normalizeContactInfo } from '../../utils';

/**
 * Normalizes the input data for creating an event organizer.
 * Performs data cleaning and standardization including:
 * - Trims whitespace from string fields
 * - Normalizes admin information
 * - Normalizes contact info and social media data
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
    data: EventOrganizerCreateInput,
    _actor: Actor
): EventOrganizerCreateInput => {
    const adminInfo = normalizeAdminInfo(data.adminInfo);

    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        name: data.name.trim(),
        description: data.description?.trim(),
        logo: data.logo?.trim(),
        contactInfo: normalizedContactInfo,
        socialNetworks: data.socialNetworks, // TODO: normalizeSocial if exists
        lifecycleState: data.lifecycleState,
        adminInfo
    };
};

/**
 * Normalizes the input data for updating an event organizer.
 * Performs selective data cleaning and standardization for update operations including:
 * - Trims whitespace from string fields when present
 * - Normalizes admin information if provided
 * - Normalizes contact info if provided
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
    data: EventOrganizerUpdateInput,
    _actor: Actor
): EventOrganizerUpdateInput => {
    const result: EventOrganizerUpdateInput = {};
    if (data.name) result.name = data.name.trim();
    if (data.description) result.description = data.description.trim();
    if (data.logo) result.logo = data.logo.trim();
    if (data.contactInfo) {
        result.contactInfo = normalizeContactInfo(data.contactInfo) as typeof data.contactInfo;
    }
    if (data.socialNetworks) result.socialNetworks = data.socialNetworks; // TODO: normalizeSocial
    if (data.lifecycleState) result.lifecycleState = data.lifecycleState;
    if (data.adminInfo) result.adminInfo = normalizeAdminInfo(data.adminInfo);
    return result;
};
