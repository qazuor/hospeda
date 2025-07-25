import { ServiceErrorCode, TagColorEnum } from '@repo/types';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { generateTagSlug } from './tag.helpers';
import type { CreateTagInput, UpdateTagInput } from './tag.schemas';

/**
 * Normalizes input for creating a tag.
 * - Trims name
 * - Generates slug if not provided (ensures uniqueness)
 * - Validates color
 * - Sanitizes optional fields
 * @param input - The raw create input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 */
export const normalizeCreateInput = async (
    input: CreateTagInput,
    _actor: Actor
): Promise<CreateTagInput> => {
    const name = input.name.trim();
    const slug = input.slug?.trim() || (await generateTagSlug(name));
    const color = input.color;
    if (color && !Object.values(TagColorEnum).includes(color)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid tag color');
    }
    return {
        name,
        slug,
        color,
        icon: input.icon?.trim() || undefined,
        notes: input.notes?.trim() || undefined
    };
};

/**
 * Normalizes input for updating a tag.
 * - Trims updatable string fields
 * - Validates color if present
 * @param input - The raw update input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 */
export const normalizeUpdateInput = (input: UpdateTagInput, _actor: Actor): UpdateTagInput => {
    const normalized: UpdateTagInput = { ...input };
    if (input.name) normalized.name = input.name.trim();
    if (input.slug) normalized.slug = input.slug.trim();
    if (input.icon) normalized.icon = input.icon.trim();
    if (input.notes) normalized.notes = input.notes.trim();
    if (input.color && !Object.values(TagColorEnum).includes(input.color)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid tag color');
    }
    return normalized;
};
