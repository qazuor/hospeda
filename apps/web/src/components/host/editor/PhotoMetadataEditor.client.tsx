/**
 * @file PhotoMetadataEditor.client.tsx
 * @description Per-photo text-metadata editor for the accommodation photo
 * editor (HOS-125 — the missing half of H-125: hosts had no way to WRITE
 * `alt`/`caption`/`description` on their own photos, so every one of them
 * fell back to the same generic text on the public listing).
 *
 * Shape: a single toggle button that expands an inline form BELOW the photo
 * it belongs to — never a modal, never a route change (this editor lives
 * inside the single-page photo section, per owner decision). Used by both
 * `PhotoSection.client.tsx` (the portada slot) and `PhotoGalleryItem.client.tsx`
 * (each gallery thumbnail).
 *
 * `alt` is presented as the PRIMARY field — bigger label, explanatory copy
 * in plain language, first in the form — because it's what a screen reader
 * announces and what search engines index; `caption` and `description` are
 * secondary and explicitly optional. All three are correctable, not just
 * write-once: opening the panel always shows the row's CURRENT values.
 *
 * Persistence is per-photo and per-field-aware: submitting calls
 * `onSave(item, body)` — provided by the caller, backed by
 * `usePhotoGalleryMutations`'s `handleUpdateMediaText` — which PATCHes only
 * this row's `mediaId`. A blank field is sent as `null` (clear), never `''`
 * (see `buildPhotoMetadataUpdateBody`), and lengths are validated against the
 * same Zod bounds the API enforces BEFORE the request ever fires (see
 * `validatePhotoMetadataFields`).
 */

import { type FormEvent, useState } from 'react';
import type { AccommodationMediaItem } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PhotoSection.module.css';
import {
    buildPhotoMetadataUpdateBody,
    type PhotoMetadataFieldErrors,
    type PhotoMetadataUpdateBody,
    validatePhotoMetadataFields
} from './photo-section-helpers';

export interface PhotoMetadataEditorProps {
    readonly locale: SupportedLocale;
    readonly item: AccommodationMediaItem;
    /** True while any other op is in flight, hydration is pending, or the item lacks a DB id yet. */
    readonly disabled: boolean;
    /** Accessible label for the toggle button while the panel is closed. */
    readonly toggleAriaLabel: string;
    /** Accessible label for the toggle button while the panel is open. */
    readonly closeAriaLabel: string;
    readonly onSave: (
        item: AccommodationMediaItem,
        body: PhotoMetadataUpdateBody
    ) => Promise<boolean>;
}

/**
 * Expandable per-photo panel to write/correct `alt`, `caption`, and
 * `description`. Render-only aside from its own form-local state (open/closed,
 * field values, validation errors, saving/saved status) — persistence is
 * fully owned by the `onSave` callback passed in.
 */
export function PhotoMetadataEditor({
    locale,
    item,
    disabled,
    toggleAriaLabel,
    closeAriaLabel,
    onSave
}: PhotoMetadataEditorProps) {
    const { t } = createTranslations(locale);
    const canOperate = !disabled && Boolean(item.id);

    const [isOpen, setIsOpen] = useState(false);
    const [alt, setAlt] = useState(item.alt ?? '');
    const [caption, setCaption] = useState(item.caption ?? '');
    const [description, setDescription] = useState(item.description ?? '');
    const [photographer, setPhotographer] = useState(item.attribution?.photographer ?? '');
    const [creditUrl, setCreditUrl] = useState(item.attribution?.sourceUrl ?? '');
    const [fieldErrors, setFieldErrors] = useState<PhotoMetadataFieldErrors>({});
    const [isSaving, setIsSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const handleToggle = () => {
        if (!isOpen) {
            // Re-sync from the row's current values every time the panel opens,
            // so a photo edited elsewhere (or already corrected once) always
            // shows what's really persisted — this is a CORRECTION tool, not
            // just a first-write form.
            setAlt(item.alt ?? '');
            setCaption(item.caption ?? '');
            setDescription(item.description ?? '');
            setPhotographer(item.attribution?.photographer ?? '');
            setCreditUrl(item.attribution?.sourceUrl ?? '');
            setFieldErrors({});
            setJustSaved(false);
        }
        setIsOpen((prev) => !prev);
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const values = { alt, caption, description, photographer, creditUrl };
        const errors = validatePhotoMetadataFields(values, t);
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            return;
        }

        setIsSaving(true);
        setJustSaved(false);
        // The row's existing credit is passed along so a stock import keeps its
        // provider and licence when the host only corrects the photographer.
        const ok = await onSave(item, buildPhotoMetadataUpdateBody(values, item.attribution));
        setIsSaving(false);
        if (ok) {
            setJustSaved(true);
        }
    };

    const fieldId = (name: string) => `photo-${name}-${item.id || 'pending'}`;

    return (
        <div className={styles.metadataBlock}>
            <button
                type="button"
                className={styles.metadataToggle}
                onClick={handleToggle}
                disabled={!canOperate}
                aria-expanded={isOpen}
                aria-label={isOpen ? closeAriaLabel : toggleAriaLabel}
            >
                ✎ {t('host.properties.editor.photo.editDetailsLabel', 'Editar textos')}
            </button>

            {isOpen && (
                <form
                    className={styles.metadataPanel}
                    onSubmit={handleSubmit}
                >
                    <div className={styles.formGroup}>
                        <label
                            className={styles.formLabelStrong}
                            htmlFor={fieldId('alt')}
                        >
                            {t('host.properties.editor.photo.altLabel', '¿Qué muestra la foto?')}
                        </label>
                        <p className={styles.formHint}>
                            {t(
                                'host.properties.editor.photo.altHint',
                                'Así la describe un lector de pantalla cuando el huésped no puede ver la imagen, y así la encuentran los buscadores. Sé concreto: "Dormitorio principal con cama matrimonial", no "foto1".'
                            )}
                        </p>
                        <textarea
                            id={fieldId('alt')}
                            className={styles.formTextarea}
                            value={alt}
                            onChange={(e) => setAlt(e.target.value)}
                            placeholder={t(
                                'host.properties.editor.photo.altPlaceholder',
                                'Ej: Living con sofá y ventanal al jardín'
                            )}
                            disabled={!canOperate || isSaving}
                            rows={2}
                        />
                        {fieldErrors.alt && <p className={styles.fieldError}>{fieldErrors.alt}</p>}
                    </div>

                    <div className={styles.formGroup}>
                        <label
                            className={styles.formLabel}
                            htmlFor={fieldId('caption')}
                        >
                            {t('host.properties.editor.photo.captionLabel', 'Epígrafe (opcional)')}
                        </label>
                        <input
                            id={fieldId('caption')}
                            type="text"
                            className={styles.formInput}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder={t(
                                'host.properties.editor.photo.captionPlaceholder',
                                'Ej: Vista desde el balcón'
                            )}
                            disabled={!canOperate || isSaving}
                        />
                        {fieldErrors.caption && (
                            <p className={styles.fieldError}>{fieldErrors.caption}</p>
                        )}
                    </div>

                    <div className={styles.formGroup}>
                        <label
                            className={styles.formLabel}
                            htmlFor={fieldId('description')}
                        >
                            {t(
                                'host.properties.editor.photo.descriptionLabel',
                                'Descripción (opcional)'
                            )}
                        </label>
                        <textarea
                            id={fieldId('description')}
                            className={styles.formTextarea}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t(
                                'host.properties.editor.photo.descriptionPlaceholder',
                                'Ej: Balcón con mesa para dos, ideal para el mate de la tarde'
                            )}
                            disabled={!canOperate || isSaving}
                            rows={2}
                        />
                        {fieldErrors.description && (
                            <p className={styles.fieldError}>{fieldErrors.description}</p>
                        )}
                    </div>

                    <fieldset className={styles.metadataCreditGroup}>
                        <legend className={styles.formLabel}>
                            {t(
                                'host.properties.editor.photo.creditLegend',
                                'Crédito de la foto (opcional)'
                            )}
                        </legend>
                        <p className={styles.formHint}>
                            {t(
                                'host.properties.editor.photo.creditHint',
                                'Dejalo vacío si la foto es tuya. Completalo cuando la sacó otra persona: un fotógrafo que contrataste, alguien que te la prestó, o una imagen de un banco de fotos. En esos casos suele ser una condición de uso nombrar al autor, y publicarla sin crédito puede ser un problema legal para vos. El crédito se muestra debajo de la foto en tu ficha.'
                            )}
                        </p>

                        <div className={styles.formGroup}>
                            <label
                                className={styles.formLabel}
                                htmlFor={fieldId('photographer')}
                            >
                                {t(
                                    'host.properties.editor.photo.photographerLabel',
                                    '¿Quién sacó la foto?'
                                )}
                            </label>
                            <input
                                id={fieldId('photographer')}
                                type="text"
                                className={styles.formInput}
                                value={photographer}
                                onChange={(e) => setPhotographer(e.target.value)}
                                placeholder={t(
                                    'host.properties.editor.photo.photographerPlaceholder',
                                    'Ej: Estudio Paraná'
                                )}
                                disabled={!canOperate || isSaving}
                            />
                            {fieldErrors.photographer && (
                                <p className={styles.fieldError}>{fieldErrors.photographer}</p>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label
                                className={styles.formLabel}
                                htmlFor={fieldId('creditUrl')}
                            >
                                {t(
                                    'host.properties.editor.photo.creditUrlLabel',
                                    'Link del autor (opcional)'
                                )}
                            </label>
                            <input
                                id={fieldId('creditUrl')}
                                type="url"
                                inputMode="url"
                                className={styles.formInput}
                                value={creditUrl}
                                onChange={(e) => setCreditUrl(e.target.value)}
                                placeholder="https://..."
                                disabled={!canOperate || isSaving}
                            />
                            {fieldErrors.creditUrl && (
                                <p className={styles.fieldError}>{fieldErrors.creditUrl}</p>
                            )}
                        </div>
                    </fieldset>

                    <div className={styles.metadataActions}>
                        <button
                            type="submit"
                            className={styles.metadataSaveButton}
                            disabled={!canOperate || isSaving}
                        >
                            {isSaving
                                ? t('host.properties.editor.action.saving', 'Guardando...')
                                : t('host.properties.editor.action.save', 'Guardar')}
                        </button>
                        <button
                            type="button"
                            className={styles.metadataCancelButton}
                            onClick={handleToggle}
                            disabled={isSaving}
                        >
                            {t('host.properties.editor.action.cancel', 'Cancelar')}
                        </button>
                        {justSaved && (
                            <span className={styles.metadataSavedBadge}>
                                {t(
                                    'host.properties.editor.photo.metadataSavedConfirmation',
                                    'Guardado'
                                )}
                            </span>
                        )}
                    </div>
                </form>
            )}
        </div>
    );
}
