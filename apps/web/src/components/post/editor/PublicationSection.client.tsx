/**
 * @file PublicationSection.client.tsx
 * @description Publication state of a post, plus the two state actions that do
 * NOT travel in the editor's PATCH: publish/unpublish and delete
 * (HOS-374 2C-2, §7.6.1 / §7.6.4).
 *
 * ## Why these are not form fields
 *
 * `visibility`, `moderationState` and `lifecycleState` are not accepted by the
 * generic PATCH payload, by design — leaving them in it would make every gate
 * in §7.6 bypassable by editing the field directly. Publication moves through
 * its own single-purpose endpoint (`POST /protected/posts/:id/publish-state`),
 * which touches `visibility` and leaves the moderation verdict intact, so
 * unpublish → edit → republish never re-enters the review queue.
 *
 * ## Why the controls are absent rather than disabled
 *
 * A plain editor holds neither `post.publish.own` nor `post.delete.own`
 * (HOS-374 OQ-3). For them the buttons do not render at all: "a disabled button
 * only invites the question of how to enable it", and the answer — a per-user
 * grant an admin makes — is not something the author can act on.
 */

import { type JSX, useCallback, useState } from 'react';
import { postEditApi } from '@/lib/api/endpoints-protected';
import type {
    EditorContentLifecycleState,
    EditorContentModerationState,
    EditorContentVisibility
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import styles from './PublicationSection.module.css';
import fieldStyles from './post-editor-fields.module.css';

/** Props for {@link PublicationSection}. */
export interface PublicationSectionProps {
    readonly locale: SupportedLocale;
    readonly postId: string;
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
    postId,
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
        const result = await postEditApi.setPublishState({ id: postId, visibility: next });
        setIsPublishing(false);

        if (result.ok) {
            onVisibilityChange(next);
            addToast({
                type: 'success',
                message: isPublic
                    ? t(
                          'account.myContent.posts.editor.toast.unpublished',
                          'Publicación despublicada'
                      )
                    : t('account.myContent.posts.editor.toast.published', 'Publicación publicada')
            });
            return;
        }

        addToast({
            type: 'error',
            message: t(
                'account.myContent.posts.editor.toast.publishError',
                'No se pudo cambiar la publicación.'
            )
        });
    }, [isPublic, postId, onVisibilityChange, t]);

    const handleDelete = useCallback(async () => {
        setDeleteState('pending');
        const result = await postEditApi.softDelete({ id: postId });

        if (result.ok) {
            window.location.href = buildUrl({ locale, path: 'mi-cuenta/publicaciones' });
            return;
        }

        setDeleteState('idle');
        addToast({
            type: 'error',
            message: t(
                'account.myContent.posts.editor.toast.deleteError',
                'No se pudo eliminar la publicación.'
            )
        });
    }, [postId, locale, t]);

    return (
        <fieldset className={fieldStyles.section}>
            <legend className={fieldStyles.sectionTitle}>
                {t('account.myContent.posts.editor.section.publication', 'Publicación')}
            </legend>

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

            <p className={fieldStyles.fieldHint}>
                {t(
                    'account.myContent.posts.editor.publicationExplainer',
                    'Tu nota se ve en el sitio público solo cuando está aprobada, pública y activa a la vez.'
                )}
            </p>

            {(canPublish || canDelete) && (
                <div className={styles.actions}>
                    {canPublish && (
                        <button
                            type="button"
                            className={styles.publishButton}
                            onClick={handleTogglePublish}
                            disabled={isPublishing || hasUnsavedChanges}
                            data-testid="post-publish-toggle"
                        >
                            {isPublic
                                ? t(
                                      'account.myContent.posts.editor.action.unpublish',
                                      'Despublicar'
                                  )
                                : t('account.myContent.posts.editor.action.publish', 'Publicar')}
                        </button>
                    )}

                    {canDelete && deleteState === 'idle' && (
                        <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => setDeleteState('confirming')}
                            data-testid="post-delete"
                        >
                            {t('account.myContent.posts.editor.action.delete', 'Eliminar')}
                        </button>
                    )}

                    {canDelete && deleteState !== 'idle' && (
                        <span className={styles.confirm}>
                            <span className={styles.confirmText}>
                                {t(
                                    'account.myContent.posts.editor.action.deleteConfirm',
                                    '¿Eliminar esta publicación?'
                                )}
                            </span>
                            <button
                                type="button"
                                className={styles.deleteButton}
                                onClick={handleDelete}
                                disabled={deleteState === 'pending'}
                                data-testid="post-delete-confirm"
                            >
                                {t(
                                    'account.myContent.posts.editor.action.deleteYes',
                                    'Sí, eliminar'
                                )}
                            </button>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={() => setDeleteState('idle')}
                                disabled={deleteState === 'pending'}
                            >
                                {t('account.myContent.posts.editor.action.deleteNo', 'Cancelar')}
                            </button>
                        </span>
                    )}
                </div>
            )}

            {canPublish && hasUnsavedChanges && (
                <p className={fieldStyles.fieldHint}>
                    {t(
                        'account.myContent.posts.editor.publishBlockedByUnsaved',
                        'Guardá los cambios antes de cambiar la publicación.'
                    )}
                </p>
            )}
        </fieldset>
    );
}
