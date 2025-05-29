import type { TagId } from '@repo/types/common/id.types.js';
import type {
    NewEntityInput,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';

/**
 * Tag used for categorizing and filtering entities.
 */
export interface TagType extends WithAudit, WithLifecycleState {
    id: TagId;
    name: string;
    color: string;
    icon?: string;
    notes?: string;
}

/**
 * Partial editable structure of a PostType.
 * Useful for form values, mock data, overrides, etc.
 */
export type PartialTagType = Partial<Writable<TagType>>;

/**
 * Input structure used to create a new post.
 * Omits fields that are auto-generated or managed by the system.
 */
export type NewTagInputType = NewEntityInput<TagType>;

/**
 * Input structure used to update an existing post.
 * All fields are optional for partial patching.
 */
export type UpdateTagInputType = PartialTagType;
