/**
 * @file Column Factory Types and Constants
 *
 * Type definitions and badge option constants used by the entity columns factory.
 */

import { BadgeColor } from '@/components/table/DataTable';
import type { EntityType } from '@/components/table/DataTable';
import type { LinkHandler } from './types';

/**
 * Badge option configuration
 */
export type BadgeOption = {
    readonly value: string;
    readonly label: string;
    readonly color: BadgeColor;
};

/**
 * Factory configuration
 */
export type ColumnFactoryConfig = {
    /** Entity type for styling */
    readonly entityType: EntityType;
    /** Base path for entity routes */
    readonly basePath: string;
    /** Primary color for entity badges */
    readonly primaryColor?: BadgeColor;
};

/**
 * Name column options
 */
export type NameColumnOptions<TData> = {
    /** Header text (default: 'Name') */
    readonly header?: string;
    /** Field to access for name value (default: 'name') */
    readonly accessorKey?: string;
    /** Field to use in link params */
    readonly linkField?: 'id' | 'slug';
    /** Custom link handler override */
    readonly linkHandler?: LinkHandler<TData>;
    /** Enable sorting (default: true) */
    readonly enableSorting?: boolean;
};

/**
 * Badge column options
 */
export type BadgeColumnOptions = {
    /** Column ID */
    readonly id: string;
    /** Header text */
    readonly header: string;
    /** Field to access for value */
    readonly accessorKey: string;
    /** Badge options for each value */
    readonly badgeOptions: readonly BadgeOption[];
    /** Enable sorting (default: true) */
    readonly enableSorting?: boolean;
    /** Visible on table by default */
    readonly startVisibleOnTable?: boolean;
    /** Visible on grid by default */
    readonly startVisibleOnGrid?: boolean;
};

/**
 * Common visibility badge options
 */
export const VISIBILITY_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'PUBLIC', label: 'Public', color: BadgeColor.PURPLE },
    { value: 'PRIVATE', label: 'Private', color: BadgeColor.CYAN },
    { value: 'HIDDEN', label: 'Hidden', color: BadgeColor.PINK },
    { value: 'RESTRICTED', label: 'Restricted', color: BadgeColor.ORANGE }
];

/**
 * Common lifecycle state badge options
 */
export const LIFECYCLE_STATE_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'DRAFT', label: 'Draft', color: BadgeColor.GRAY },
    { value: 'ACTIVE', label: 'Active', color: BadgeColor.GREEN },
    { value: 'INACTIVE', label: 'Inactive', color: BadgeColor.YELLOW },
    { value: 'ARCHIVED', label: 'Archived', color: BadgeColor.ORANGE },
    { value: 'DELETED', label: 'Deleted', color: BadgeColor.RED }
];

/**
 * Common moderation state badge options
 */
export const MODERATION_STATE_BADGE_OPTIONS: readonly BadgeOption[] = [
    { value: 'PENDING', label: 'Pending', color: BadgeColor.YELLOW },
    { value: 'APPROVED', label: 'Approved', color: BadgeColor.GREEN },
    { value: 'REJECTED', label: 'Rejected', color: BadgeColor.RED },
    { value: 'UNDER_REVIEW', label: 'Under Review', color: BadgeColor.BLUE }
];
