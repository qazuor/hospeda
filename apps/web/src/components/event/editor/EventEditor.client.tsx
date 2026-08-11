/**
 * @file EventEditor.client.tsx
 * @description Orchestrator island for the event editor at
 * `/mi-cuenta/eventos/[id]/editar` (HOS-374 Phase 2 2C-3).
 *
 * The post editor's twin (2C-2) — same state/baseline/diff shape, same shared
 * `PublicationSection`, `EditorSectionNav` and `ActionBar`. What differs is
 * genuinely different: the event PATCH persists a much smaller field set than
 * its schema accepts (see `event-edit-data.ts`), and dates carry a precision
 * that this HTTP surface cannot express (see `ScheduleSection`).
 */

import { EventUpdateHttpSchema } from '@repo/schemas';
import { type JSX, useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import { ContentMediaSection } from '@/components/account/editor/ContentMediaSection.client';
import styles from '@/components/account/editor/content-editor-layout.module.css';
import type { PublicationSectionLabels } from '@/components/account/editor/PublicationSection.client';
import { PublicationSection } from '@/components/account/editor/PublicationSection.client';
import { ActionBar } from '@/components/host/editor/ActionBar.client';
import type { EditorSectionNavItem } from '@/components/host/editor/EditorSectionNav.client';
import { EditorSectionNav } from '@/components/host/editor/EditorSectionNav.client';
import { eventEditApi } from '@/lib/api/endpoints-protected';
import type { EditorContentVisibility, EventEditDetail } from '@/lib/api/types';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { BasicInfoSection } from './BasicInfoSection.client';
import { DescriptionSection } from './DescriptionSection.client';
import type { EventEditFormData } from './event-edit-data';
import { buildEventEditFormData, buildEventPatchPayload } from './event-edit-data';
import { EVENT_FIELD_ID_SUFFIXES, EVENT_FIELD_PREFIX } from './field-ids';
import { ScheduleSection } from './ScheduleSection.client';

/**
 * PATCH-diff validation schema for the event editor.
 *
 * Extends the REAL `EventUpdateHttpSchema` — the exact schema
 * `PATCH /api/v1/protected/events/:id` validates the body against — and
 * tightens `name` to the domain's 150-character cap (the HTTP schema allows
 * 200, and `EventSchema` is what the service checks afterwards). `description`
 * needs no override: 50–2000 is already the binding range on both sides.
 */
export const EventEditFormSchema = EventUpdateHttpSchema.extend({
    name: z
        .string()
        .min(5, { message: 'zodError.event.name.min' })
        .max(150, { message: 'zodError.event.name.max' })
        .optional()
});

/** Props for {@link EventEditor}. */
export interface EventEditorProps {
    readonly locale: SupportedLocale;
    /** The event being edited, as returned by the protected `getById`. */
    readonly initialData: EventEditDetail;
    /**
     * Holder of `event.publish.own` (or the broad `event.publish.toggle`) —
     * resolved SSR from `Astro.locals.user.permissions`, never from roles
     * (HOS-374 OQ-1).
     */
    readonly canPublish?: boolean;
    /** Holder of `event.delete.own` (or the broad `event.delete`). */
    readonly canDelete?: boolean;
    /**
     * `true` when the moderation verdict locks this event against edits by its
     * author (HOS-374 §7.6.3). Mirrors `checkCanUpdateEvent`; the server
     * enforces it regardless, this just says so before the author writes a
     * revision they cannot save.
     */
    readonly isEditLocked?: boolean;
}

/**
 * Event editor form orchestrator.
 *
 * @param props - See {@link EventEditorProps}.
 */
export function EventEditor({
    locale,
    initialData,
    canPublish = false,
    canDelete = false,
    isEditLocked = false
}: EventEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    const [formData, setFormData] = useState<EventEditFormData>(() =>
        buildEventEditFormData({ detail: initialData })
    );
    /*
     * Mutable baseline, resynced after every successful save (HOS-190 F6):
     * diffing against the load-time prop would make reverting a just-saved
     * field produce an empty diff while the DB still held the new value.
     */
    const [baseline, setBaseline] = useState<EventEditFormData>(() =>
        buildEventEditFormData({ detail: initialData })
    );
    const [visibility, setVisibility] = useState<EditorContentVisibility>(initialData.visibility);
    const [isSaving, setIsSaving] = useState(false);

    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({
            schema: EventEditFormSchema,
            t,
            fieldIdPrefix: EVENT_FIELD_PREFIX,
            fieldIdSuffixes: EVENT_FIELD_ID_SUFFIXES
        });

    const isMonthPrecision = initialData.datePrecision === 'MONTH';

    const handleTextFieldChange = useCallback(
        (field: 'name' | 'category', value: string) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(field);
        },
        [clearError]
    );

    const handleDescriptionChange = useCallback(
        (value: string) => {
            setFormData((prev) => ({ ...prev, description: value }));
            clearError('description');
        },
        [clearError]
    );

    const handleDateChange = useCallback(
        (field: 'startDate' | 'endDate', value: string) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(field);
        },
        [clearError]
    );

    const patchPayload = useMemo(
        () => buildEventPatchPayload({ current: formData, baseline }),
        [formData, baseline]
    );

    const isDirty = Object.keys(patchPayload).length > 0;

    /*
     * A cleared start date is the one edit the diff cannot express: the mapper
     * only emits a `date` object when `startDate` is present, so an empty start
     * would drop out of the payload and the rest of the form would save as if
     * nothing were wrong, leaving the old date in place. Caught here instead.
     */
    const startDateCleared = formData.startDate !== baseline.startDate && formData.startDate === '';

    useUnsavedChangesGuard({
        isDirty: isDirty || startDateCleared,
        message: t(
            'account.myContent.events.editor.unsavedChanges',
            'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
        )
    });

    const handleSubmit = useCallback(
        async (event: React.FormEvent) => {
            event.preventDefault();
            setFormError(null);

            if (startDateCleared) {
                setFormError(
                    t(
                        'account.myContent.events.editor.error.startDateRequired',
                        'El evento necesita una fecha de comienzo.'
                    )
                );
                return;
            }

            if (!isDirty) {
                addToast({
                    type: 'info',
                    message: t(
                        'account.myContent.events.editor.toast.noChanges',
                        'No hay cambios para guardar'
                    )
                });
                return;
            }

            const parsed = validate(patchPayload);
            if (!parsed.success) {
                return;
            }

            const persisted = formData;

            setIsSaving(true);
            const result = await eventEditApi.update({ id: initialData.id, data: patchPayload });
            setIsSaving(false);

            if (result.ok) {
                setBaseline(persisted);
                addToast({
                    type: 'success',
                    message: t('account.myContent.events.editor.toast.saved', 'Cambios guardados')
                });
                return;
            }

            handleApiError(
                result.error,
                t(
                    'account.myContent.events.editor.error.saveFailed',
                    'No se pudieron guardar los cambios.'
                )
            );
        },
        [
            startDateCleared,
            isDirty,
            patchPayload,
            formData,
            initialData.id,
            validate,
            handleApiError,
            setFormError,
            t
        ]
    );

    const handleCancel = useCallback(() => {
        window.location.href = buildUrl({ locale, path: 'mi-cuenta/eventos' });
    }, [locale]);

    const publicationLabels = useMemo<PublicationSectionLabels>(
        () => ({
            sectionTitle: t('account.myContent.events.editor.section.publication', 'Publicación'),
            explainer: t(
                'account.myContent.events.editor.publicationExplainer',
                'Tu evento se ve en el sitio público solo cuando está aprobado, público y activo a la vez.'
            ),
            publish: t('account.myContent.events.editor.action.publish', 'Publicar'),
            unpublish: t('account.myContent.events.editor.action.unpublish', 'Despublicar'),
            publishedToast: t(
                'account.myContent.events.editor.toast.published',
                'Evento publicado'
            ),
            unpublishedToast: t(
                'account.myContent.events.editor.toast.unpublished',
                'Evento despublicado'
            ),
            publishErrorToast: t(
                'account.myContent.events.editor.toast.publishError',
                'No se pudo cambiar la publicación.'
            ),
            blockedByUnsaved: t(
                'account.myContent.events.editor.publishBlockedByUnsaved',
                'Guardá los cambios antes de cambiar la publicación.'
            ),
            delete: t('account.myContent.events.editor.action.delete', 'Eliminar'),
            deleteConfirm: t(
                'account.myContent.events.editor.action.deleteConfirm',
                '¿Eliminar este evento?'
            ),
            deleteYes: t('account.myContent.events.editor.action.deleteYes', 'Sí, eliminar'),
            deleteNo: t('account.myContent.events.editor.action.deleteNo', 'Cancelar'),
            deleteErrorToast: t(
                'account.myContent.events.editor.toast.deleteError',
                'No se pudo eliminar el evento.'
            )
        }),
        [t]
    );

    const sectionLabels = useMemo(
        () => ({
            basicInfo: t('account.myContent.events.editor.section.basicInfo', 'Información básica'),
            description: t('account.myContent.events.editor.section.description', 'Descripción'),
            schedule: t('account.myContent.events.editor.section.schedule', 'Fechas'),
            media: t('account.myContent.editor.media.sectionTitle', 'Fotos'),
            publication: t('account.myContent.events.editor.section.publication', 'Publicación')
        }),
        [t]
    );

    const navSections = useMemo<EditorSectionNavItem[]>(
        () => [
            { id: 'event-editor-basicInfo', label: sectionLabels.basicInfo },
            { id: 'event-editor-description', label: sectionLabels.description },
            { id: 'event-editor-schedule', label: sectionLabels.schedule },
            { id: 'event-editor-media', label: sectionLabels.media },
            { id: 'event-editor-publication', label: sectionLabels.publication }
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
                            data-testid="event-editor-lock-notice"
                        >
                            {t(
                                'account.myContent.events.editor.lockNotice',
                                'Este evento ya fue aprobado y publicado, así que no podés editarlo. Escribile al equipo si necesitás cambiar algo.'
                            )}
                        </p>
                    )}

                    <section
                        id="event-editor-basicInfo"
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
                        id="event-editor-description"
                        className={styles.card}
                        aria-label={sectionLabels.description}
                    >
                        <DescriptionSection
                            locale={locale}
                            value={formData.description}
                            error={fieldErrors.description}
                            disabled={isEditLocked}
                            onChange={handleDescriptionChange}
                        />
                    </section>

                    <section
                        id="event-editor-schedule"
                        className={styles.card}
                        aria-label={sectionLabels.schedule}
                    >
                        <ScheduleSection
                            locale={locale}
                            data={formData}
                            errors={fieldErrors}
                            isMonthPrecision={isMonthPrecision}
                            disabled={isEditLocked}
                            onFieldChange={handleDateChange}
                        />
                    </section>

                    {/*
                     * Photos persist per-operation against `event_media`
                     * (HOS-390) — they never travel in this form's PATCH diff,
                     * which is why the section takes no value/onChange and sits
                     * outside the `formData` flow entirely.
                     */}
                    <section
                        id="event-editor-media"
                        className={styles.card}
                        aria-label={sectionLabels.media}
                    >
                        <ContentMediaSection
                            locale={locale}
                            entity="event"
                            entityId={initialData.id}
                            disabled={isEditLocked}
                        />
                    </section>

                    <section
                        id="event-editor-publication"
                        className={styles.card}
                        aria-label={sectionLabels.publication}
                    >
                        <PublicationSection
                            locale={locale}
                            labels={publicationLabels}
                            listHref={buildUrl({ locale, path: 'mi-cuenta/eventos' })}
                            onSetPublishState={({ visibility: next }) =>
                                eventEditApi.setPublishState({
                                    id: initialData.id,
                                    visibility: next
                                })
                            }
                            onDelete={() => eventEditApi.softDelete({ id: initialData.id })}
                            visibility={visibility}
                            moderationState={initialData.moderationState}
                            lifecycleState={initialData.lifecycleState}
                            canPublish={canPublish}
                            canDelete={canDelete}
                            hasUnsavedChanges={isDirty || startDateCleared}
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
                     * nothing the author can do makes saving work, so a greyed
                     * Save would pose a question with no answer (OQ-3). The
                     * page's own back link stays as the exit.
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
