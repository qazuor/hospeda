import type {
    WithActivityState,
    WithAdminInfo,
    WithAudit,
    WithId,
    WithLifecycleState,
    WithSoftDelete
} from '../../common/helpers.types.js';
import type { AccommodationId, FeatureId } from '../../common/id.types.js';

/**
 * Generic feature that can be assigned to accommodations.
 */
export interface FeatureType
    extends WithId,
        WithAudit,
        WithLifecycleState,
        WithSoftDelete,
        WithAdminInfo {
    id: FeatureId;
    name: string;
    description?: string;
    icon?: string;
    isBuiltin: boolean;
}

/**
 * Relationship between an accommodation and a feature
 */
export interface AccommodationFeatureType extends WithActivityState, WithAdminInfo {
    accommodationId: AccommodationId;
    featureId: FeatureId;
    hostReWriteName?: string | null;
    comments?: string | null;
    feature?: FeatureType;
}
