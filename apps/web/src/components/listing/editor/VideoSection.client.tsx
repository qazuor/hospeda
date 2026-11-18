/**
 * @file VideoSection.client.tsx
 * @description Self-contained video widget shared by the owner editors' "Fotos"
 * pages: accommodation (G7 smoke, H-121) and venue (HOS-2258).
 *
 * It knows no endpoint. The accommodation page mounts it through
 * `host/editor/VideoSection.client.tsx` and the venue page through
 * `ListingVideoSection.client.tsx`; each wrapper builds the `save` function and
 * picks the copy scope (`video-section-copy.ts`).
 *
 * Placed on the SAME page as the photo section rather than a new nav item: both
 * are "media that shows up on the photos page" from the owner's point of view.
 * It uses a DIFFERENT persistence model than the photo section on purpose, so
 * it renders its own small Save button rather than `ActionBar`, which would
 * misleadingly imply one shared save action for the whole page.
 */

import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from '../../host/editor/PhotoSection.module.css';
import {
    useVideoSection,
    type VideoEntry,
    type VideoPayload,
    type VideoRow,
    type VideoSaveResult
} from './use-video-section';
import {
    getVideoSectionCopy,
    type VideoCopyScope,
    type VideoSectionCopy
} from './video-section-copy';

/** Props for VideoSection. */
export interface VideoSectionProps {
    readonly locale: SupportedLocale;
    readonly initialVideos: readonly VideoEntry[];
    /** Persists the whole list; the caller decides the endpoint and body shape. */
    readonly save: (videos: readonly VideoPayload[]) => Promise<VideoSaveResult>;
    /** Which copy set and field-id prefix to render with. */
    readonly copyScope: VideoCopyScope;
    /** Most videos the surface accepts; absent means no cap. */
    readonly maxVideos?: number | undefined;
}

/** Field-id prefix per scope; the accommodation one predates the shared widget. */
const FIELD_PREFIX: Readonly<Record<VideoCopyScope, string>> = {
    accommodation: 'acc',
    listing: 'listing'
};

/** One editable video row. */
function VideoRowField({
    locale,
    copy,
    fieldPrefix,
    index,
    row,
    disabled,
    onChange,
    onRemove
}: {
    readonly locale: SupportedLocale;
    readonly copy: VideoSectionCopy;
    readonly fieldPrefix: string;
    readonly index: number;
    readonly row: VideoRow;
    readonly disabled: boolean;
    readonly onChange: (field: 'url' | 'caption', value: string) => void;
    readonly onRemove: () => void;
}) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.videoRow}>
            <div className={styles.videoFieldGrid}>
                <div className={styles.formGroup}>
                    <TextField
                        prefix={fieldPrefix}
                        name={`video-${index}-url`}
                        label={t(copy.urlLabel.key, copy.urlLabel.fallback)}
                        labelClassName={styles.formLabel}
                        className={styles.formInput}
                        type="url"
                        value={row.url}
                        placeholder={t(copy.urlPlaceholder.key, copy.urlPlaceholder.fallback)}
                        disabled={disabled}
                        onChange={(e) => onChange('url', e.target.value)}
                    />
                </div>
                <div className={styles.formGroup}>
                    <TextField
                        prefix={fieldPrefix}
                        name={`video-${index}-caption`}
                        label={t(copy.captionLabel.key, copy.captionLabel.fallback)}
                        labelClassName={styles.formLabel}
                        className={styles.formInput}
                        type="text"
                        value={row.caption}
                        disabled={disabled}
                        onChange={(e) => onChange('caption', e.target.value)}
                    />
                </div>
            </div>
            <div className={styles.videoRowActions}>
                <button
                    type="button"
                    className={styles.videoRemoveButton}
                    onClick={onRemove}
                    disabled={disabled}
                    aria-label={t(copy.removeAria.key, copy.removeAria.fallback, {
                        index: index + 1
                    })}
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

/**
 * Video widget: a list of embeddable video links, saved independently of the
 * photo gallery above it on the same page.
 */
export function VideoSection({
    locale,
    initialVideos,
    save,
    copyScope,
    maxVideos
}: VideoSectionProps) {
    const { t } = createTranslations(locale);
    const copy = getVideoSectionCopy({ scope: copyScope });
    const { rows, isDirty, isSaving, formError, addRow, removeRow, setRowField, handleSubmit } =
        useVideoSection({ locale, initialVideos, save, copyScope, maxVideos });
    const atCap = maxVideos !== undefined && rows.length >= maxVideos;

    return (
        <form
            className={styles.section}
            onSubmit={handleSubmit}
            noValidate
            style={{ marginTop: '2rem' }}
        >
            <h3 className={styles.sectionTitle}>
                {t(copy.sectionTitle.key, copy.sectionTitle.fallback)}
            </h3>
            <p className={styles.sectionDescription}>
                {t(copy.sectionDescription.key, copy.sectionDescription.fallback)}
            </p>

            {rows.length === 0 && (
                <p className={styles.sectionDescription}>
                    {t(copy.empty.key, copy.empty.fallback)}
                </p>
            )}

            {rows.map((row, index) => (
                <VideoRowField
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id until saved
                    key={index}
                    locale={locale}
                    copy={copy}
                    fieldPrefix={FIELD_PREFIX[copyScope]}
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

            <div className={styles.videoSectionActions}>
                <button
                    type="button"
                    className={styles.videoAddButton}
                    onClick={addRow}
                    disabled={isSaving || atCap}
                >
                    {t(copy.addButton.key, copy.addButton.fallback)}
                </button>

                <button
                    type="submit"
                    className={styles.videoSaveButton}
                    disabled={isSaving || !isDirty}
                >
                    {isSaving
                        ? t(copy.saving.key, copy.saving.fallback)
                        : t(copy.saveButton.key, copy.saveButton.fallback)}
                </button>
            </div>
        </form>
    );
}
