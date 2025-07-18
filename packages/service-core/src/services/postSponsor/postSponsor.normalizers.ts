import type { Actor } from '../../types';
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
    return {
        ...data,
        name: data.name.trim(),
        description: data.description.trim(),
        logo: data.logo, // TODO: normalize image if necessary
        contact: data.contact, // TODO: normalize contact if necessary
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
    const normalized: UpdatePostSponsorInput = { ...data };
    if (typeof data.name === 'string') normalized.name = data.name.trim();
    if (typeof data.description === 'string') normalized.description = data.description.trim();
    // TODO: normalize logo/contact/social if necessary
    return normalized;
};
