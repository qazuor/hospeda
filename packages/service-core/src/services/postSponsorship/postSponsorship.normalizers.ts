import type { PostSponsorshipCreateInput, PostSponsorshipUpdateInput } from '@repo/schemas';
import type { Actor } from '../../types';

/**
 * Normalizes the input data for creating a post sponsorship.
 * Trims and cleans all string fields, normalizes dates and price if needed.
 * @param data The original input data for creation.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeCreateInput = (
    data: PostSponsorshipCreateInput,
    _actor: Actor
): PostSponsorshipCreateInput => {
    return {
        ...data,
        message: typeof data.message === 'string' ? data.message.trim() : data.message,
        description: data.description.trim()
        // TODO [c4cff8af-2c87-462c-9448-3c3bb6670d83]: normalize paid, dates if needed
    };
};

/**
 * Normalizes the input data for updating a post sponsorship.
 * Trims and cleans all string fields, normalizes dates and price if needed.
 * @param data The original input data for update.
 * @param _actor The actor performing the action (unused in this normalization).
 * @returns The normalized data.
 */
export const normalizeUpdateInput = (
    data: PostSponsorshipUpdateInput,
    _actor: Actor
): PostSponsorshipUpdateInput => {
    const normalized: PostSponsorshipUpdateInput = { ...data };
    if (typeof data.message === 'string') normalized.message = data.message.trim();
    if (typeof data.description === 'string') normalized.description = data.description.trim();
    // TODO [dd0fff10-6575-4a85-b9c1-c78a1efaf604]: normalize paid, dates if needed
    return normalized;
};
