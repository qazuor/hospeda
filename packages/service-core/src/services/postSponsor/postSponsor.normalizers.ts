import type { Actor } from '../../types';
import { normalizeContactInfo } from '../../utils';
import type { CreatePostSponsorInput, UpdatePostSponsorInput } from './postSponsor.schemas';

/**
 * Normalizes the input data for creating a post sponsor.
 * Trims and cleans all string fields, normalizes contact and social if present.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: CreatePostSponsorInput,
    _actor: Actor
): CreatePostSponsorInput => {
    // Normalize contact info if present
    const normalizedContact = data.contact
        ? (normalizeContactInfo(data.contact) as typeof data.contact)
        : undefined;

    return {
        ...data,
        name: data.name.trim(),
        description: data.description.trim(),
        logo: data.logo, // TODO: normalize image if necessary
        contact: normalizedContact,
        social: data.social, // TODO: normalize social if necessary
        type: data.type
    };
};

/**
 * Normalizes the input data for updating a post sponsor.
 * Trims and cleans all string fields, normalizes contact and social if present.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (
    data: UpdatePostSponsorInput,
    _actor: Actor
): UpdatePostSponsorInput => {
    const result: UpdatePostSponsorInput = {};

    if (data.name) result.name = data.name.trim();
    if (data.description) result.description = data.description.trim();
    if (data.logo) result.logo = data.logo; // TODO: normalize image if necessary
    if (data.contact) {
        result.contact = normalizeContactInfo(data.contact) as typeof data.contact;
    }
    if (data.social) result.social = data.social; // TODO: normalize social if necessary
    if (data.type) result.type = data.type;

    return result;
};
