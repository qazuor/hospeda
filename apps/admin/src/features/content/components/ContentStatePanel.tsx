import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import { InlineStateSelectCell } from '@/components/entity-list/InlineStateSelectCell';
import {
    CONTENT_LIFECYCLE_OPTIONS,
    CONTENT_MODERATION_OPTIONS,
    CONTENT_VISIBILITY_OPTIONS
} from '@/features/content/config/content-state-options';
import { EVENT_STATE_MUTATIONS } from '@/features/events/hooks/useEventQuery';
import { POST_STATE_MUTATIONS } from '@/features/posts/hooks/usePostQuery';
import { useTranslations } from '@/hooks/use-translations';

/**
 * The three content state controls, on the entity edit page.
 *
 * These used to be SELECT fields inside the "States & Moderation" form section,
 * saved with the rest of the form through the generic PATCH. HOS-374 §7.6.4 took
 * them out of that payload — each now has its own endpoint and its own
 * permission — so they cannot be form fields any more: the form builds ONE
 * payload from its declared fields, and these three no longer belong in it.
 *
 * They therefore write immediately on selection, exactly like the equivalent
 * dropdowns in the entity list, rather than waiting for Save. Same component,
 * same endpoints, same permissions from either surface.
 */

/** The two entities that carry the three-state model. */
export type ContentStateEntityType = 'post' | 'event';

interface EntityWiring {
    readonly labelKey: TranslationKey;
    readonly permissions: {
        readonly moderation: PermissionEnum;
        readonly publish: PermissionEnum;
        readonly lifecycle: PermissionEnum;
    };
}

const WIRING: Record<ContentStateEntityType, EntityWiring> = {
    post: {
        labelKey: 'admin-entities.entities.post.singular',
        permissions: {
            moderation: PermissionEnum.POST_MODERATION_CHANGE,
            publish: PermissionEnum.POST_PUBLISH_TOGGLE,
            lifecycle: PermissionEnum.POST_LIFECYCLE_CHANGE
        }
    },
    event: {
        labelKey: 'admin-entities.entities.event.singular',
        permissions: {
            moderation: PermissionEnum.EVENT_MODERATION_CHANGE,
            publish: PermissionEnum.EVENT_PUBLISH_TOGGLE,
            lifecycle: PermissionEnum.EVENT_LIFECYCLE_CHANGE
        }
    }
};

export interface ContentStatePanelProps {
    readonly entityType: ContentStateEntityType;
    readonly entityId: string;
    /** Entity title/name, interpolated into the success toast. */
    readonly entityName: string;
    readonly visibility: string | undefined;
    readonly moderationState: string | undefined;
    readonly lifecycleState: string | undefined;
}

/**
 * Renders the visibility / moderation / lifecycle controls for one post or
 * event. Each control is read-only for an actor lacking its permission.
 */
export function ContentStatePanel({
    entityType,
    entityId,
    entityName,
    visibility,
    moderationState,
    lifecycleState
}: ContentStatePanelProps) {
    const { t } = useTranslations();
    const wiring = WIRING[entityType];
    // The same module-scope bundles the entity list uses — one stable hook
    // factory per entity, as InlineStateSelectCell requires.
    const hooks = entityType === 'post' ? POST_STATE_MUTATIONS : EVENT_STATE_MUTATIONS;

    return (
        <section
            aria-label={t('admin-entities.detail.sections.states')}
            className="rounded-lg border border-border bg-card p-4"
        >
            <h2 className="mb-3 font-medium text-sm">
                {t('admin-entities.detail.sections.states')}
            </h2>
            <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground text-sm">
                        {t('admin-entities.columns.visibility')}
                    </dt>
                    <dd>
                        <InlineStateSelectCell
                            entityId={entityId}
                            entityName={entityName}
                            entityLabelKey={wiring.labelKey}
                            field="visibility"
                            currentValue={visibility}
                            options={CONTENT_VISIBILITY_OPTIONS(t)}
                            permission={wiring.permissions.publish}
                            successMessageKey="admin-entities.messages.visibilityChanged"
                            useUpdateMutation={hooks.useSetPublishStateMutation}
                        />
                    </dd>
                </div>
                <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground text-sm">
                        {t('admin-entities.columns.moderation')}
                    </dt>
                    <dd>
                        <InlineStateSelectCell
                            entityId={entityId}
                            entityName={entityName}
                            entityLabelKey={wiring.labelKey}
                            field="moderationState"
                            currentValue={moderationState}
                            options={CONTENT_MODERATION_OPTIONS(t)}
                            permission={wiring.permissions.moderation}
                            successMessageKey="admin-entities.messages.moderationChanged"
                            useUpdateMutation={hooks.useModerateMutation}
                            confirmValues={['REJECTED']}
                            confirmCopyKey="reject"
                        />
                    </dd>
                </div>
                <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground text-sm">
                        {t('admin-entities.columns.status')}
                    </dt>
                    <dd>
                        <InlineStateSelectCell
                            entityId={entityId}
                            entityName={entityName}
                            entityLabelKey={wiring.labelKey}
                            field="lifecycleState"
                            currentValue={lifecycleState}
                            options={CONTENT_LIFECYCLE_OPTIONS(t)}
                            permission={wiring.permissions.lifecycle}
                            successMessageKey="admin-entities.messages.stateChanged"
                            useUpdateMutation={hooks.useSetLifecycleStateMutation}
                            confirmValues={['ARCHIVED']}
                            confirmCopyKey="archive"
                        />
                    </dd>
                </div>
            </dl>
        </section>
    );
}
