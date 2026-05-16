/**
 * @file Column Factory Types and Constants
 *
 * Type definitions and badge option constants used by the entity columns factory.
 */

import { BadgeColor } from '@/components/table/DataTable';
import type { EntityType } from '@/components/table/DataTable';
import type { ColumnTFunction, LinkHandler } from './types';

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
 * Common visibility badge options (localized).
 *
 * Resolves labels through `admin-entities.states.visibility.*` keys.
 */
export const getVisibilityBadgeOptions = (t: ColumnTFunction): readonly BadgeOption[] => [
    {
        value: 'PUBLIC',
        label: t('admin-entities.states.visibility.public'),
        color: BadgeColor.PURPLE
    },
    {
        value: 'PRIVATE',
        label: t('admin-entities.states.visibility.private'),
        color: BadgeColor.CYAN
    },
    {
        value: 'HIDDEN',
        label: t('admin-entities.states.visibility.hidden'),
        color: BadgeColor.PINK
    },
    {
        value: 'RESTRICTED',
        label: t('admin-entities.states.visibility.restricted'),
        color: BadgeColor.ORANGE
    }
];

/**
 * Common lifecycle state badge options (localized).
 *
 * Resolves labels through `admin-entities.states.lifecycle.*` keys.
 */
export const getLifecycleStateBadgeOptions = (t: ColumnTFunction): readonly BadgeOption[] => [
    {
        value: 'DRAFT',
        label: t('admin-entities.states.lifecycle.draft'),
        color: BadgeColor.GRAY
    },
    {
        value: 'ACTIVE',
        label: t('admin-entities.states.lifecycle.active'),
        color: BadgeColor.GREEN
    },
    {
        value: 'INACTIVE',
        label: t('admin-entities.states.lifecycle.inactive'),
        color: BadgeColor.YELLOW
    },
    {
        value: 'ARCHIVED',
        label: t('admin-entities.states.lifecycle.archived'),
        color: BadgeColor.ORANGE
    },
    {
        value: 'DELETED',
        label: t('admin-entities.states.lifecycle.deleted'),
        color: BadgeColor.RED
    }
];

/**
 * Common moderation state badge options (localized).
 *
 * Resolves labels through `admin-entities.states.moderation.*` keys.
 */
export const getModerationStateBadgeOptions = (t: ColumnTFunction): readonly BadgeOption[] => [
    {
        value: 'PENDING',
        label: t('admin-entities.states.moderation.pending'),
        color: BadgeColor.YELLOW
    },
    {
        value: 'APPROVED',
        label: t('admin-entities.states.moderation.approved'),
        color: BadgeColor.GREEN
    },
    {
        value: 'REJECTED',
        label: t('admin-entities.states.moderation.rejected'),
        color: BadgeColor.RED
    },
    {
        value: 'UNDER_REVIEW',
        label: t('admin-entities.states.moderation.underReview'),
        color: BadgeColor.BLUE
    }
];
