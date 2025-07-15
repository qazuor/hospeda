import type { EventOrganizerType, UpdateEventOrganizerInputType } from '@repo/types';
import type { Actor } from '../../types';
import { normalizeAdminInfo } from '../../utils';

/**
 * Normalizes the input data for creating an event organizer.
 * Trims and cleans all string fields, normalizes adminInfo, contactInfo, and social.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
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
        contactInfo: data.contactInfo, // TODO: normalizeContactInfo si existe
        social: data.social, // TODO: normalizeSocial si existe
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
 * Trims and cleans all updatable string fields.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
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
