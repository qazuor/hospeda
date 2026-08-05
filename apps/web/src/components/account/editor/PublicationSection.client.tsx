/**
 * @file PublicationSection.client.tsx
 * @description Publication state of one piece of own content, plus the two
 * state actions that do NOT travel in the editor's PATCH: publish/unpublish and
 * delete (HOS-374 §7.6.1 / §7.6.4).
 *
 * Shared by the post editor (2C-2) and the event editor (2C-3): both expose the
 * exact same three orthogonal state columns and the same two actions, so the
 * entity-specific parts — which endpoint to call, where to go after a delete,
 * and the already-translated copy — are INJECTED rather than branched on. That
 * follows `DeleteButton.client.tsx`, which takes its labels as pre-resolved
 * strings for the same reason.
 *
 * ## Why these are not form fields
 *
 * `visibility`, `moderationState` and `lifecycleState` are not accepted by the
 * generic PATCH payload, by design — leaving them in it would make every gate
 * in §7.6 bypassable by editing the field directly. Publication moves through
 * its own single-purpose endpoint (`POST /protected/{posts,events}/:id/publish-state`),
 * which touches `visibility` and leaves the moderation verdict intact, so
 * unpublish → edit → republish never re-enters the review queue.
 *
 * ## Why the controls are absent rather than disabled
 *
 * A plain editor holds neither `*.publish.own` nor `*.delete.own`
 * (HOS-374 OQ-3). For them the buttons do not render at all: "a disabled button
 * only invites the question of how to enable it", and the answer — a per-user
 * grant an admin makes — is not something the author can act on.
 */

import { type JSX, useCallback, useState } from 'react';
import type {
    ApiResult,
    EditorContentLifecycleState,
    EditorContentModerationState,
    EditorContentVisibility
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import fieldStyles from './content-editor-fields.module.css';
import styles from './PublicationSection.module.css';

/**
 * The already-translated, entity-specific copy this section renders.
 *
 * Passed in rather than resolved here because the strings genuinely differ per
 * entity ("Publicación publicada" vs "Evento publicado"), and an interpolated
 * i18n key would be invisible to any static scan of the locale files.
 */
export interface PublicationSectionLabels {
    readonly sectionTitle: string;
    readonly explainer: string;
    readonly publish: string;
    readonly unpublish: string;
    readonly publishedToast: string;
    readonly unpublishedToast: string;
    readonly publishErrorToast: string;
    readonly blockedByUnsaved: string;
    readonly delete: string;
    readonly deleteConfirm: string;
    readonly deleteYes: string;
    readonly deleteNo: string;
    readonly deleteErrorToast: string;
}

/** Props for {@link PublicationSection}. */
export interface PublicationSectionProps {
    readonly locale: SupportedLocale;
    /** Already-translated copy — see {@link PublicationSectionLabels}. */
    readonly labels: PublicationSectionLabels;
    /**
     * Raises or lowers publication on the entity. Injected so this component
     * never imports an entity-specific endpoint.
     */
    readonly onSetPublishState: (params: {
        readonly visibility: 'PUBLIC' | 'PRIVATE';
    }) => Promise<ApiResult<unknown>>;
    /** Soft-deletes the entity. */
    readonly onDelete: () => Promise<ApiResult<unknown>>;
    /** Where to land after a successful delete (already locale-prefixed). */
    readonly listHref: string;
    readonly visibility: EditorContentVisibility;
    readonly moderationState: EditorContentModerationState;
    readonly lifecycleState: EditorContentLifecycleState;
    /** Holder of `post.publish.own` (or the broad `post.publish.toggle`). */
    readonly canPublish: boolean;
    /** Holder of `post.delete.own` (or the broad `post.delete`). */
    readonly canDelete: boolean;
    /**
     * `true` while the form holds an unsaved diff. Publishing then would push
     * the PERSISTED version live, not what is on screen — so the action is
     * blocked with a visible explanation rather than silently doing the
     * surprising thing.
     */
    readonly hasUnsavedChanges: boolean;
    /** Called with the new visibility after a successful publish-state change. */
    readonly onVisibilityChange: (visibility: EditorContentVisibility) => void;
}

/** Inline-confirmation state machine for the delete action. */
type DeleteState = 'idle' | 'confirming' | 'pending';

/** Translation function shape handed to the label maps below. */
type TranslateFn = (key: string, fallback?: string) => string;

/*
 * The three state-label maps.
 *
 * Written out key by key rather than interpolated
 * (`` t(`...status.moderation.${state}`) ``) for the same reason
 * `EditableContentCard` does: an interpolated key is invisible to any static
 * scan of the locale files, so a missing translation degrades to the raw enum
 * value in production with nothing failing anywhere. These reuse the exact keys
 * that card already ships (HOS-374 2C-1).
 */
const MODERATION_LABELS = (t: TranslateFn): Readonly<Record<string, string>> => ({
    PENDING: t('account.myContent.status.moderation.PENDING', 'Pendiente de revisión'),
    APPROVED: t('account.myContent.status.moderation.APPROVED', 'Aprobado'),
    REJECTED: t('account.myContent.status.moderation.REJECTED', 'Rechazado')
});

const VISIBILITY_LABELS = (t: TranslateFn): Readonly<Record<string, string>> => ({
    PUBLIC: t('account.myContent.status.visibility.PUBLIC', 'Pública'),
    PRIVATE: t('account.myContent.status.visibility.PRIVATE', 'Privada'),
    RESTRICTED: t('account.myContent.status.visibility.RESTRICTED', 'Restringida')
});

const LIFECYCLE_LABELS = (t: TranslateFn): Readonly<Record<string, string>> => ({
    DRAFT: t('account.myContent.status.lifecycle.DRAFT', 'Borrador'),
    ACTIVE: t('account.myContent.status.lifecycle.ACTIVE', 'Activo'),
    ARCHIVED: t('account.myContent.status.lifecycle.ARCHIVED', 'Archivado')
});

/**
 * Publication state + state actions for one post.
 *
 * @param props - See {@link PublicationSectionProps}.
 */
export function PublicationSection({
    locale,
    labels,
    onSetPublishState,
    onDelete,
    listHref,
    visibility,
    moderationState,
    lifecycleState,
    canPublish,
    canDelete,
    hasUnsavedChanges,
    onVisibilityChange
}: PublicationSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [isPublishing, setIsPublishing] = useState(false);
    const [deleteState, setDeleteState] = useState<DeleteState>('idle');

    const isPublic = visibility === 'PUBLIC';

    const handleTogglePublish = useCallback(async () => {
        setIsPublishing(true);
        const next: EditorContentVisibility = isPublic ? 'PRIVATE' : 'PUBLIC';
        const result = await onSetPublishState({ visibility: next });
        setIsPublishing(false);

        if (result.ok) {
            onVisibilityChange(next);
            addToast({
                type: 'success',
                message: isPublic ? labels.unpublishedToast : labels.publishedToast
            });
            return;
        }

        addToast({ type: 'error', message: labels.publishErrorToast });
    }, [isPublic, onSetPublishState, onVisibilityChange, labels]);

    const handleDelete = useCallback(async () => {
        setDeleteState('pending');
        const result = await onDelete();

        if (result.ok) {
            window.location.href = listHref;
            return;
        }

        setDeleteState('idle');
        addToast({ type: 'error', message: labels.deleteErrorToast });
    }, [onDelete, listHref, labels]);

    return (
        <fieldset className={fieldStyles.section}>
            <legend className={fieldStyles.sectionTitle}>{labels.sectionTitle}</legend>

            <dl className={styles.states}>
                <div className={styles.state}>
                    <dt className={styles.stateLabel}>
                        {t('account.myContent.status.moderation.label', 'Moderación')}
                    </dt>
                    <dd className={styles.stateValue}>
                        {MODERATION_LABELS(t)[moderationState] ?? moderationState}
                    </dd>
                </div>
                <div className={styles.state}>
                    <dt className={styles.stateLabel}>
                        {t('account.myContent.status.visibility.label', 'Visibilidad')}
                    </dt>
                    <dd className={styles.stateValue}>
                        {VISIBILITY_LABELS(t)[visibility] ?? visibility}
                    </dd>
                </div>
                <div className={styles.state}>
                    <dt className={styles.stateLabel}>
                        {t('account.myContent.status.lifecycle.label', 'Estado')}
                    </dt>
                    <dd className={styles.stateValue}>
                        {LIFECYCLE_LABELS(t)[lifecycleState] ?? lifecycleState}
                    </dd>
                </div>
            </dl>

            <p className={fieldStyles.fieldHint}>{labels.explainer}</p>

            {(canPublish || canDelete) && (
                <div className={styles.actions}>
                    {canPublish && (
                        <button
                            type="button"
                            className={styles.publishButton}
                            onClick={handleTogglePublish}
                            disabled={isPublishing || hasUnsavedChanges}
                            data-testid="content-publish-toggle"
                        >
                            {isPublic ? labels.unpublish : labels.publish}
                        </button>
                    )}

                    {canDelete && deleteState === 'idle' && (
                        <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => setDeleteState('confirming')}
                            data-testid="content-delete"
                        >
                            {labels.delete}
                        </button>
                    )}

                    {canDelete && deleteState !== 'idle' && (
                        <span className={styles.confirm}>
                            <span className={styles.confirmText}>{labels.deleteConfirm}</span>
                            <button
                                type="button"
                                className={styles.deleteButton}
                                onClick={handleDelete}
                                disabled={deleteState === 'pending'}
                                data-testid="content-delete-confirm"
                            >
                                {labels.deleteYes}
                            </button>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => setDeleteState('idle')}
                                disabled={deleteState === 'pending'}
                            >
                                {labels.deleteNo}
                            </button>
                        </span>
                    )}
                </div>
            )}

            {canPublish && hasUnsavedChanges && (
                <p className={fieldStyles.fieldHint}>{labels.blockedByUnsaved}</p>
            )}
        </fieldset>
    );
}
