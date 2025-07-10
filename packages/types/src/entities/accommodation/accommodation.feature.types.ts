import type {
    NewEntityInput,
    WithAdminInfo,
    WithAudit,
    WithLifecycleState,
    Writable
} from '../../common/helpers.types.js';
import type { AccommodationId, FeatureId } from '../../common/id.types.js';

/**
 * Generic feature that can be assigned to accommodations.
 */
export interface FeatureType extends WithAudit, WithLifecycleState, WithAdminInfo {
    /**
     * Unique identifier for the feature.
     */
    id: FeatureId;
    /**
     * Unique, URL-friendly identifier for the feature. Auto-generated from name if not provided.
     */
    slug: string;
    /**
     * Name of the feature.
     */
    name: string;
    /**
     * Optional description of the feature.
     */
    description?: string;
    /**
     * Optional icon for the feature.
     */
    icon?: string;
    /**
     * Whether this feature is built-in (system default).
     */
    isBuiltin: boolean;
    /**
     * Whether this feature is highlighted (featured) in the UI.
     */
    isFeatured: boolean;
}

/**
 * Relationship between an accommodation and a feature
 */
export interface AccommodationFeatureType {
    accommodationId: AccommodationId;
    featureId: FeatureId;
    hostReWriteName?: string | null;
    comments?: string | null;
    feature?: FeatureType;
}

export type PartialFeatureType = Partial<Writable<FeatureType>>;
export type NewFeatureInputType = NewEntityInput<FeatureType>;
export type UpdateFeatureInputType = PartialFeatureType;
