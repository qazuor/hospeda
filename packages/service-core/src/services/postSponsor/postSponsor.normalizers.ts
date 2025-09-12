import type { PostSponsorCreateInput, PostSponsorUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';
import { normalizeContactInfo } from '../../utils';

/**
 * Normalizes the input data for creating a post sponsor.
 * Trims and cleans all string fields, normalizes contact and social if present.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: PostSponsorCreateInput,
    _actor: Actor
): PostSponsorCreateInput => {
    // Normalize contact info if present
    const normalizedContactInfo = data.contactInfo
        ? (normalizeContactInfo(data.contactInfo) as typeof data.contactInfo)
        : undefined;

    return {
        ...data,
        name: data.name.trim(),
        description: data.description.trim(),
        logo: data.logo, // TODO: normalize image if necessary
        contactInfo: normalizedContactInfo,
        socialNetworks: data.socialNetworks, // TODO: normalize social if necessary
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
    data: PostSponsorUpdateInput,
    _actor: Actor
): PostSponsorUpdateInput => {
    const result: PostSponsorUpdateInput = {};

    if (data.name) result.name = data.name.trim();
    if (data.description) result.description = data.description.trim();
    if (data.logo) result.logo = data.logo; // TODO: normalize image if necessary
    if (data.contactInfo) {
        result.contactInfo = normalizeContactInfo(data.contactInfo) as typeof data.contactInfo;
    }
    if (data.socialNetworks) result.socialNetworks = data.socialNetworks; // TODO: normalize social if necessary
    if (data.type) result.type = data.type;

    return result;
};
