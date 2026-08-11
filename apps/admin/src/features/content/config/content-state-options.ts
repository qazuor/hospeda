import type { InlineStateOption } from '@/components/entity-list/InlineStateSelectCell';
import type { ColumnTFunction } from '@/components/entity-list/types';
import { BadgeColor } from '@/components/table/DataTable';

/**
 * The option sets for the three content state fields, shared by every surface
 * that renders them (HOS-374 §7.6.4).
 *
 * Posts and events each carried a private copy of these three arrays in their
 * columns config. Now that the same options also drive the state panel on the
 * edit page, one drifting copy would mean the same field offering different
 * values depending on where you changed it.
 */

/** Visibility options — the author's publication switch. */
export const CONTENT_VISIBILITY_OPTIONS = (
    t: ColumnTFunction
): ReadonlyArray<InlineStateOption> => [
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
        value: 'RESTRICTED',
        label: t('admin-entities.states.visibility.restricted'),
        color: BadgeColor.PINK
    }
];

/** Lifecycle-state options. ARCHIVED is the destructive transition. */
export const CONTENT_LIFECYCLE_OPTIONS = (t: ColumnTFunction): ReadonlyArray<InlineStateOption> => [
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
        value: 'ARCHIVED',
        label: t('admin-entities.states.lifecycle.archived'),
        color: BadgeColor.ORANGE
    }
];

/** Moderation-state options. REJECTED is the destructive transition. */
export const CONTENT_MODERATION_OPTIONS = (
    t: ColumnTFunction
): ReadonlyArray<InlineStateOption> => [
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
    }
];
