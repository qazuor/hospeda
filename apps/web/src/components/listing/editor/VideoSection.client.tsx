/**
 * @file VideoSection.client.tsx
 * @description Self-contained video widget shared by the owner editors' "Fotos"
 * pages: accommodation (G7 smoke, H-121) and venue (HOS-2258).
 *
 * It knows no endpoint. The accommodation page mounts it through
 * `host/editor/VideoSection.client.tsx` and the venue page through
 * `ListingVideoWidget.client.tsx`; each wrapper builds the `save` function and
 * picks the copy scope (`video-section-copy.ts`).
 *
 * Placed on the SAME page as the photo section rather than a new nav item: both
 * are "media that shows up on the photos page" from the owner's point of view.
 * Its persistence differs from the photos' (the list travels in the entity
 * PATCH), but since HOS-2489 it follows the page's `auto` save model like the
 * photos do: no Save button or action bar of its own, a save on blur / Enter /
 * remove, reported to the shell's auto-save chip (see `use-video-section.ts`).
 */

import { AddIcon, DeleteIcon } from '@repo/icons';
import { useId } from 'react';
import { Alert, Button, Field, TextInput } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import fieldStyles from './editor-fields.module.css';
import {
    useVideoSection,
    type VideoEntry,
    type VideoPayload,
    type VideoRow,
    type VideoSaveResult
} from './use-video-section';
import styles from './VideoSection.module.css';
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
    onCommit,
    onRemove
}: {
    readonly locale: SupportedLocale;
    readonly copy: VideoSectionCopy;
    readonly fieldPrefix: string;
    readonly index: number;
    readonly row: VideoRow;
    readonly disabled: boolean;
    readonly onChange: (field: 'url' | 'caption', value: string) => void;
    readonly onCommit: () => void;
    readonly onRemove: () => void;
}) {
    const { t } = createTranslations(locale);

    return (
        <li className={styles.row}>
            <div className={styles.fields}>
                <Field
                    locale={locale}
                    label={t(copy.urlLabel.key, copy.urlLabel.fallback)}
                    idParts={{ prefix: fieldPrefix, name: `video-${index}-url` }}
                >
                    <TextInput
                        type="url"
                        inputMode="url"
                        value={row.url}
                        placeholder={t(copy.urlPlaceholder.key, copy.urlPlaceholder.fallback)}
                        disabled={disabled}
                        onChange={(e) => onChange('url', e.target.value)}
                        onBlur={onCommit}
                    />
                </Field>
                <Field
                    locale={locale}
                    label={t(copy.captionLabel.key, copy.captionLabel.fallback)}
                    idParts={{ prefix: fieldPrefix, name: `video-${index}-caption` }}
                >
                    <TextInput
                        type="text"
                        value={row.caption}
                        disabled={disabled}
                        onChange={(e) => onChange('caption', e.target.value)}
                        onBlur={onCommit}
                    />
                </Field>
            </div>
            <Button
                variant="danger-ghost"
                size="lg"
                iconOnly
                className={styles.remove}
                onClick={onRemove}
                disabled={disabled}
                aria-label={t(copy.removeAria.key, copy.removeAria.fallback, {
                    index: index + 1
                })}
            >
                <DeleteIcon
                    size="sm"
                    aria-hidden="true"
                />
            </Button>
        </li>
    );
}

/**
 * Video widget: a list of embeddable video links on the «Fotos» page, saved
 * on its own (no Save button: the page is an `auto` section, HOS-2489) and
 * reported to the shell's auto-save chip.
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
    const { rows, isSaving, formError, addRow, removeRow, setRowField, commit, handleSubmit } =
        useVideoSection({ locale, initialVideos, save, copyScope, maxVideos });
    const titleId = useId();
    const atCap = maxVideos !== undefined && rows.length >= maxVideos;

    return (
        <div className={styles.root}>
            <section
                className={fieldStyles.section}
                aria-labelledby={titleId}
            >
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className={styles.form}
                >
                    <h3
                        id={titleId}
                        className={styles.title}
                    >
                        {t(copy.sectionTitle.key, copy.sectionTitle.fallback)}
                    </h3>
                    <p className={styles.description}>
                        {t(copy.sectionDescription.key, copy.sectionDescription.fallback)}
                    </p>

                    {rows.length === 0 ? (
                        <p className={styles.description}>
                            {t(copy.empty.key, copy.empty.fallback)}
                        </p>
                    ) : (
                        <ul className={styles.list}>
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
                                    onCommit={commit}
                                    onRemove={() => removeRow(index)}
                                />
                            ))}
                        </ul>
                    )}

                    {formError && (
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {formError}
                        </Alert>
                    )}

                    <div className={styles.actions}>
                        <Button
                            variant="secondary"
                            size="lg"
                            onClick={addRow}
                            disabled={isSaving || atCap}
                        >
                            <AddIcon
                                size="sm"
                                aria-hidden="true"
                            />
                            {t(copy.addButton.key, copy.addButton.fallback)}
                        </Button>
                    </div>
                </form>
            </section>
        </div>
    );
}
