/**
 * @file PostEditor.client.tsx
 * @description Orchestrator island for the post editor at
 * `/mi-cuenta/publicaciones/[id]/editar` (HOS-374 Phase 2 2C-2).
 *
 * Follows `AccommodationEditor.client.tsx`: one component owns the form state,
 * the mutable baseline, the PATCH diff and the submit; the section components
 * only render. The sticky `EditorSectionNav` and the `ActionBar` are the same
 * generic components that editor uses — the commerce editor's omission of both
 * is a known gap, not a lighter-weight variant to copy.
 */

import { PostUpdateHttpSchema } from '@repo/schemas';
import { type JSX, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { ContentMediaSection } from '@/components/account/editor/ContentMediaSection.client';
import styles from '@/components/account/editor/content-editor-layout.module.css';
import type { PublicationSectionLabels } from '@/components/account/editor/PublicationSection.client';
import { PublicationSection } from '@/components/account/editor/PublicationSection.client';
import { ActionBar } from '@/components/host/editor/ActionBar.client';
import type { EditorSectionNavItem } from '@/components/host/editor/EditorSectionNav.client';
import { EditorSectionNav } from '@/components/host/editor/EditorSectionNav.client';
import { postEditApi } from '@/lib/api/endpoints-protected';
import type { EditorContentVisibility, PostEditDetail } from '@/lib/api/types';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { BasicInfoSection } from './BasicInfoSection.client';
import { ContentSection } from './ContentSection.client';
import type { PostDestinationOption } from './DetailsSection.client';
import { DetailsSection } from './DetailsSection.client';
import { POST_FIELD_ID_SUFFIXES, POST_FIELD_PREFIX } from './field-ids';
import type { PostEditFormData } from './post-edit-data';
import { buildPostEditFormData, buildPostPatchPayload } from './post-edit-data';

/**
 * PATCH-diff validation schema for the post editor.
 *
 * Extends the REAL `PostUpdateHttpSchema` — the exact schema
 * `PATCH /api/v1/protected/posts/:id` validates the body against — then
 * tightens the two bounds where the HTTP schema is LOOSER than the domain
 * (`PostSchema`), which the service validates against afterwards. Without this
 * the client would accept a 180-character title, and the request would fail
 * server-side with a message keyed to a field the form never flagged:
 *  - `title`: HTTP allows 5–200, the domain caps at 150.
 *  - `summary`: HTTP allows 10–500, the domain caps at 300.
 *
 * `content` needs no override — the HTTP schema's 100–10000 is the stricter of
 * the two (the domain allows up to 50000), so it is already the binding limit.
 */
export const PostEditFormSchema = PostUpdateHttpSchema.extend({
    title: z
        .string()
        .min(5, { message: 'zodError.post.title.min' })
        .max(150, { message: 'zodError.post.title.max' })
        .optional(),
    summary: z
        .string()
        .min(10, { message: 'zodError.post.summary.min' })
        .max(300, { message: 'zodError.post.summary.max' })
        .optional(),
    /*
     * `PostCreateHttpSchema` types this as `z.coerce.number()`, which turns an
     * explicit `null` (the author clearing the field) into `0` — a value that
     * then passes every bounds check it should not. Widening to `.nullable()`
     * keeps the clear intact so the server sees what the author did.
     */
    readingTimeMinutes: z.number().int().min(1).nullable().optional()
});

/** Props for {@link PostEditor}. */
export interface PostEditorProps {
    readonly locale: SupportedLocale;
    /** The post being edited, as returned by the protected `getById`. */
    readonly initialData: PostEditDetail;
    /** Destination catalog for the optional related-destination select. */
    readonly destinations?: readonly PostDestinationOption[];
    /**
     * Holder of `post.publish.own` (or the broad `post.publish.toggle`) —
     * resolved SSR from `Astro.locals.user.permissions`, never from roles: the
     * "trusted editor" is two per-user grants on the plain `EDITOR` role
     * (HOS-374 OQ-1), so no role can answer this.
     */
    readonly canPublish?: boolean;
    /** Holder of `post.delete.own` (or the broad `post.delete`). */
    readonly canDelete?: boolean;
    /**
     * `true` when the moderation verdict locks this post against edits by its
     * author (HOS-374 §7.6.3): `moderationState === 'APPROVED'` and the actor
     * holds neither `post.publish.own` nor the broad `post.update`.
     *
     * The server enforces this in `checkCanUpdatePost`; surfacing it here is
     * what stops the author from writing a full revision only to collect a 403
     * on save.
     */
    readonly isEditLocked?: boolean;
}

/**
 * Post editor form orchestrator.
 *
 * @param props - See {@link PostEditorProps}.
 */
export function PostEditor({
    locale,
    initialData,
    destinations = [],
    canPublish = false,
    canDelete = false,
    isEditLocked = false
}: PostEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [formData, setFormData] = useState<PostEditFormData>(() =>
        buildPostEditFormData({ detail: initialData })
    );
    /*
     * The PATCH diff is computed against this MUTABLE baseline, resynced to the
     * persisted values after every successful save (HOS-190 F6). Diffing
     * against the load-time `initialData` prop instead would make reverting a
     * just-saved field produce an empty diff while the DB still held the new
     * value — the author could not undo their own change without a full reload.
     */
    const [baseline, setBaseline] = useState<PostEditFormData>(() =>
        buildPostEditFormData({ detail: initialData })
    );
    const [visibility, setVisibility] = useState<EditorContentVisibility>(initialData.visibility);
    const [isSaving, setIsSaving] = useState(false);

    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({
            schema: PostEditFormSchema,
            t,
            fieldIdPrefix: POST_FIELD_PREFIX,
            fieldIdSuffixes: POST_FIELD_ID_SUFFIXES
        });

    const handleTextFieldChange = useCallback(
        (field: 'title' | 'summary' | 'category', value: string) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(field);
        },
        [clearError]
    );

    const handleContentChange = useCallback(
        (value: string) => {
            setFormData((prev) => ({ ...prev, content: value }));
            clearError('content');
        },
        [clearError]
    );

    const handleReadingTimeChange = useCallback(
        (value: number | null) => {
            setFormData((prev) => ({ ...prev, readingTimeMinutes: value }));
            clearError('readingTimeMinutes');
        },
        [clearError]
    );

    const handleDestinationChange = useCallback(
        (value: string) => {
            setFormData((prev) => ({ ...prev, relatedDestinationId: value }));
            clearError('destinationId');
        },
        [clearError]
    );

    const patchPayload = useMemo(
        () => buildPostPatchPayload({ current: formData, baseline }),
        [formData, baseline]
    );

    const isDirty = Object.keys(patchPayload).length > 0;

    useUnsavedChangesGuard({
        isDirty,
        message: t(
            'account.myContent.posts.editor.unsavedChanges',
            'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
        )
    });

    const handleSubmit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setFormError(null);

            if (!isDirty) {
                // Never save silently (HOS-190): "Save" always visibly does
                // something, even when there is nothing to persist.
                addToast({
                    type: 'info',
                    message: t(
                        'account.myContent.posts.editor.toast.noChanges',
                        'No hay cambios para guardar'
                    )
                });
                return;
            }

            // Only the CHANGED fields are validated, so a pre-existing invalid
            // value the author is not touching never blocks an unrelated save.
            const parsed = validate(patchPayload);
            if (!parsed.success) {
                return;
            }

            // Snapshot what this request persists, so the baseline resync below
            // records exactly that even if the author keeps typing in flight.
            const persisted = formData;

            setIsSaving(true);
            const result = await postEditApi.update({ id: initialData.id, data: patchPayload });
            setIsSaving(false);

            if (result.ok) {
                setBaseline(persisted);
                addToast({
                    type: 'success',
                    message: t('account.myContent.posts.editor.toast.saved', 'Cambios guardados')
                });
                return;
            }

            handleApiError(
                result.error,
                t(
                    'account.myContent.posts.editor.error.saveFailed',
                    'No se pudieron guardar los cambios.'
                )
            );
        },
        [isDirty, patchPayload, formData, initialData.id, validate, handleApiError, setFormError, t]
    );

    const handleCancel = useCallback(() => {
        window.location.href = buildUrl({ locale, path: 'mi-cuenta/publicaciones' });
    }, [locale]);

    /**
     * Entity-specific copy for the shared `PublicationSection`. Resolved here,
     * key by key, because that component is shared with the event editor and
     * takes pre-translated strings (see its `PublicationSectionLabels` doc).
     */
    const publicationLabels = useMemo<PublicationSectionLabels>(
        () => ({
            sectionTitle: t('account.myContent.posts.editor.section.publication', 'Publicación'),
            explainer: t(
                'account.myContent.posts.editor.publicationExplainer',
                'Tu nota se ve en el sitio público solo cuando está aprobada, pública y activa a la vez.'
            ),
            publish: t('account.myContent.posts.editor.action.publish', 'Publicar'),
            unpublish: t('account.myContent.posts.editor.action.unpublish', 'Despublicar'),
            publishedToast: t(
                'account.myContent.posts.editor.toast.published',
                'Publicación publicada'
            ),
            unpublishedToast: t(
                'account.myContent.posts.editor.toast.unpublished',
                'Publicación despublicada'
            ),
            publishErrorToast: t(
                'account.myContent.posts.editor.toast.publishError',
                'No se pudo cambiar la publicación.'
            ),
            blockedByUnsaved: t(
                'account.myContent.posts.editor.publishBlockedByUnsaved',
                'Guardá los cambios antes de cambiar la publicación.'
            ),
            delete: t('account.myContent.posts.editor.action.delete', 'Eliminar'),
            deleteConfirm: t(
                'account.myContent.posts.editor.action.deleteConfirm',
                '¿Eliminar esta publicación?'
            ),
            deleteYes: t('account.myContent.posts.editor.action.deleteYes', 'Sí, eliminar'),
            deleteNo: t('account.myContent.posts.editor.action.deleteNo', 'Cancelar'),
            deleteErrorToast: t(
                'account.myContent.posts.editor.toast.deleteError',
                'No se pudo eliminar la publicación.'
            )
        }),
        [t]
    );

    const sectionLabels = useMemo(
        () => ({
            basicInfo: t('account.myContent.posts.editor.section.basicInfo', 'Información básica'),
            content: t('account.myContent.posts.editor.section.content', 'Contenido'),
            details: t('account.myContent.posts.editor.section.details', 'Detalles'),
            media: t('account.myContent.editor.media.sectionTitle', 'Fotos'),
            publication: t('account.myContent.posts.editor.section.publication', 'Publicación')
        }),
        [t]
    );

    const navSections = useMemo<EditorSectionNavItem[]>(
        () => [
            { id: 'post-editor-basicInfo', label: sectionLabels.basicInfo },
            { id: 'post-editor-content', label: sectionLabels.content },
            { id: 'post-editor-details', label: sectionLabels.details },
            { id: 'post-editor-media', label: sectionLabels.media },
            { id: 'post-editor-publication', label: sectionLabels.publication }
        ],
        [sectionLabels]
    );

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            noValidate
        >
            <div className={styles.layout}>
                <div className={styles.navSlot}>
                    <EditorSectionNav
                        locale={locale}
                        sections={navSections}
                    />
                </div>

                <div className={styles.cardsColumn}>
                    {isEditLocked && (
                        <p
                            className={styles.lockNotice}
                            role="status"
                            data-testid="post-editor-lock-notice"
                        >
                            {t(
                                'account.myContent.posts.editor.lockNotice',
                                'Esta nota ya fue aprobada y publicada, así que no podés editarla. Escribile al equipo si necesitás cambiar algo.'
                            )}
                        </p>
                    )}

                    <section
                        id="post-editor-basicInfo"
                        className={styles.card}
                        aria-label={sectionLabels.basicInfo}
                    >
                        <BasicInfoSection
                            locale={locale}
                            data={formData}
                            errors={fieldErrors}
                            disabled={isEditLocked}
                            onFieldChange={handleTextFieldChange}
                        />
                    </section>

                    <section
                        id="post-editor-content"
                        className={styles.card}
                        aria-label={sectionLabels.content}
                    >
                        <ContentSection
                            locale={locale}
                            value={formData.content}
                            error={fieldErrors.content}
                            disabled={isEditLocked}
                            onChange={handleContentChange}
                        />
                    </section>

                    <section
                        id="post-editor-details"
                        className={styles.card}
                        aria-label={sectionLabels.details}
                    >
                        <DetailsSection
                            locale={locale}
                            data={formData}
                            destinations={destinations}
                            errors={fieldErrors}
                            disabled={isEditLocked}
                            onReadingTimeChange={handleReadingTimeChange}
                            onDestinationChange={handleDestinationChange}
                        />
                    </section>

                    {/*
                     * Photos persist per-operation against `post_media`
                     * (HOS-390) — they never travel in this form's PATCH diff,
                     * which is why the section takes no value/onChange and sits
                     * outside the `formData` flow entirely.
                     */}
                    <section
                        id="post-editor-media"
                        className={styles.card}
                        aria-label={sectionLabels.media}
                    >
                        <ContentMediaSection
                            locale={locale}
                            entity="post"
                            entityId={initialData.id}
                            disabled={isEditLocked}
                        />
                    </section>

                    <section
                        id="post-editor-publication"
                        className={styles.card}
                        aria-label={sectionLabels.publication}
                    >
                        <PublicationSection
                            locale={locale}
                            labels={publicationLabels}
                            listHref={buildUrl({ locale, path: 'mi-cuenta/publicaciones' })}
                            onSetPublishState={({ visibility: next }) =>
                                postEditApi.setPublishState({
                                    id: initialData.id,
                                    visibility: next
                                })
                            }
                            onDelete={() => postEditApi.softDelete({ id: initialData.id })}
                            visibility={visibility}
                            moderationState={initialData.moderationState}
                            lifecycleState={initialData.lifecycleState}
                            canPublish={canPublish}
                            canDelete={canDelete}
                            hasUnsavedChanges={isDirty}
                            onVisibilityChange={setVisibility}
                        />
                    </section>

                    {formError && (
                        <div
                            className={styles.submitError}
                            role="alert"
                        >
                            {formError}
                        </div>
                    )}

                    {/*
                     * Absent — not disabled — while the moderation lock holds:
                     * there is nothing the author can do to make saving work,
                     * so a greyed-out Save would only pose a question with no
                     * answer (the same reasoning as the publish/delete controls,
                     * HOS-374 OQ-3). Cancel still exists as the page's own
                     * "back to my posts" link.
                     */}
                    {!isEditLocked && (
                        <ActionBar
                            locale={locale}
                            isSaving={isSaving}
                            onCancel={handleCancel}
                        />
                    )}
                </div>
            </div>
        </form>
    );
}
