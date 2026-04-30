import type { TagCreateInput, TagUpdateInput } from '@repo/schemas';
import { ServiceErrorCode, TagColorEnum } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Normalizes input for creating a tag.
 *
 * Per SPEC-086 D-002 and D-018:
 * - `slug` column is removed — user-tags have no public URLs.
 * - `notes` is removed — replaced by `description`.
 * - Trims `name`, `icon`, and `description`.
 * - Validates color against TagColorEnum.
 * - Defaults lifecycleState to ACTIVE.
 *
 * @param input - The raw create input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 * @throws {ServiceError} If color is invalid.
 */
export const normalizeCreateInput = async (
    input: TagCreateInput,
    _actor: Actor
): Promise<TagCreateInput> => {
    const name = input.name.trim();
    const color = input.color;
    if (color && !Object.values(TagColorEnum).includes(color)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid tag color');
    }
    const normalizedLifecycleState = input.lifecycleState || 'ACTIVE';
    return {
        name,
        type: input.type,
        color,
        lifecycleState: normalizedLifecycleState,
        icon: input.icon?.trim() || undefined,
        description: input.description?.trim() || undefined,
        ownerId: input.ownerId ?? undefined
    };
};

/**
 * Normalizes input for updating a tag.
 *
 * Per SPEC-086 D-018:
 * - `slug` and `notes` fields do not exist in the new schema.
 * - Trims `name`, `icon`, and `description`.
 * - Validates color if present.
 * - `type` is immutable and excluded from update schema (enforced at Zod schema level).
 *
 * @param input - The raw update input.
 * @param _actor - The actor performing the action.
 * @returns Normalized input.
 * @throws {ServiceError} If color is invalid.
 */
export const normalizeUpdateInput = (input: TagUpdateInput, _actor: Actor): TagUpdateInput => {
    const normalized: TagUpdateInput = { ...input };
    if (input.name) normalized.name = input.name.trim();
    if (input.icon) normalized.icon = input.icon.trim();
    if (input.description) normalized.description = input.description.trim();
    if (input.color && !Object.values(TagColorEnum).includes(input.color)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid tag color');
    }
    return normalized;
};
