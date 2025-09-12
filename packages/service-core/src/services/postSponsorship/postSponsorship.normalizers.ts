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
        // TODO [348328db-6dda-4933-9783-3d4352ce4a70]: normalize paid, dates if needed
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
    // TODO [1cdd78c4-fc95-440d-bc92-8703a1868156]: normalize paid, dates if needed
    return normalized;
};
