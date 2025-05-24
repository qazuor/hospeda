import type {
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../common/helpers.types.js';

/**
 * Tag used for categorizing and filtering entities.
 */
export interface TagType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    name: string;
    color: string;
    icon?: string;
    notes?: string;
}
