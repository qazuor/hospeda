/**
 * @file VideoSection.client.tsx
 * @description Self-contained video widget for the accommodation editor's
 * "Fotos" page (G7 smoke, H-121).
 *
 * The backend already accepts and renders videos — `media.videos` on the
 * PATCH body (`HttpMediaUpdateSchema`, mapped by `httpMediaToDomainVideos`)
 * and the public `/alojamientos/{slug}/fotos` subpage. Only the editor
 * control was missing (0 of 7 production accommodations have one loaded).
 *
 * Placed on the SAME page as `PhotoSection` rather than a new nav item: both
 * are "media that shows up on the fotos subpage" from the host's point of
 * view, and unlike SEO there was no natural alternative page for it. It uses
 * a DIFFERENT persistence model than PhotoSection on purpose — see
 * `use-video-section.ts`'s file doc for why a shared form engine was not the
 * right fit — so it renders its own small Save button rather than
 * `ActionBar`, which would misleadingly imply one shared save action for
 * the whole page.
 *
 * No plan/entitlement gate is shown here: `CAN_EMBED_VIDEO` only strips
 * YouTube/Vimeo/Dailymotion embeds typed inline in free-text `description`
 * (`gateVideoEmbed()` middleware) — it does not touch this dedicated
 * `media.videos` field at read or write time. Promising a gate the backend
 * does not enforce here would be its own kind of lie, so the copy makes no
 * claim about plan tiers.
 */

import { TextField } from '@/components/ui/TextField';
import type { AccommodationVideoEntry } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PhotoSection.module.css';
import { useVideoSection, type VideoRow } from './use-video-section';

/** Props for VideoSection. */
export interface VideoSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialVideos: readonly AccommodationVideoEntry[];
}

/** One editable video row. */
function VideoRowField({
    locale,
    index,
    row,
    disabled,
    onChange,
    onRemove
}: {
    readonly locale: SupportedLocale;
    readonly index: number;
    readonly row: VideoRow;
    readonly disabled: boolean;
    readonly onChange: (field: 'url' | 'caption', value: string) => void;
    readonly onRemove: () => void;
}) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.preview}>
            <TextField
                prefix="acc"
                name={`video-${index}-url`}
                label={t('host.properties.editor.video.urlLabel', 'Enlace del video')}
                type="url"
                value={row.url}
                placeholder={t(
                    'host.properties.editor.video.urlPlaceholder',
                    'https://youtube.com/watch?v=...'
                )}
                disabled={disabled}
                onChange={(e) => onChange('url', e.target.value)}
            />
            <TextField
                prefix="acc"
                name={`video-${index}-caption`}
                label={t('host.properties.editor.video.captionLabel', 'Título (opcional)')}
                type="text"
                value={row.caption}
                disabled={disabled}
                onChange={(e) => onChange('caption', e.target.value)}
            />
            <button
                type="button"
                className={styles.previewButton}
                onClick={onRemove}
                disabled={disabled}
                aria-label={t(
                    'host.properties.editor.video.removeAria',
                    'Eliminar video {{index}}',
                    {
                        index: index + 1
                    }
                )}
            >
                ✕
            </button>
        </div>
    );
}

/**
 * Video widget: a list of embeddable video links, saved independently of the
 * photo gallery above it on the same page.
 */
export function VideoSection({ locale, accommodationId, initialVideos }: VideoSectionProps) {
    const { t } = createTranslations(locale);
    const { rows, isDirty, isSaving, formError, addRow, removeRow, setRowField, handleSubmit } =
        useVideoSection({ locale, accommodationId, initialVideos });

    return (
        <form
            className={styles.section}
            onSubmit={handleSubmit}
            noValidate
            style={{ marginTop: '2rem' }}
        >
            <h3 className={styles.sectionTitle}>
                {t('host.properties.editor.video.sectionTitle', 'Videos')}
            </h3>
            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.video.sectionDescription',
                    'Agregá enlaces a videos de YouTube, Vimeo o Dailymotion que muestren tu propiedad.'
                )}
            </p>

            {rows.length === 0 && (
                <p className={styles.sectionDescription}>
                    {t('host.properties.editor.video.empty', 'Todavía no cargaste ningún video.')}
                </p>
            )}

            {rows.map((row, index) => (
                <VideoRowField
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id until saved
                    key={index}
                    locale={locale}
                    index={index}
                    row={row}
                    disabled={isSaving}
                    onChange={(field, value) => setRowField(index, field, value)}
                    onRemove={() => removeRow(index)}
                />
            ))}

            {formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </div>
            )}

            <button
                type="button"
                className={styles.galleryAddButton}
                onClick={addRow}
                disabled={isSaving}
            >
                {t('host.properties.editor.video.addButton', 'Agregar video')}
            </button>

            <button
                type="submit"
                className={styles.uploadTextStrong}
                disabled={isSaving || !isDirty}
                style={{ display: 'block', marginTop: '1rem', cursor: 'pointer' }}
            >
                {isSaving
                    ? t('host.properties.editor.action.saving', 'Guardando...')
                    : t('host.properties.editor.video.saveButton', 'Guardar videos')}
            </button>
        </form>
    );
}
