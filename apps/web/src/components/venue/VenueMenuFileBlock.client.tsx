/**
 * @file VenueMenuFileBlock.client.tsx
 * @description The uploaded photo / PDF of the menu (HOS-895), split out of
 * `VenueMenuManager.client.tsx` (HOS-2490).
 *
 * Not part of the carta draft: the upload request ITSELF persists the asset
 * (HOS-372 measured what deferring a real Cloudinary upload costs), so the
 * save bar never carries it.
 */

import type { JSX } from 'react';
import type { TranslationFn } from '@/lib/i18n';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import styles from './VenueMenuManager.module.css';
import { ACCEPTED_MENU_FILE_TYPES, type MenuFile } from './venue-menu-draft';

/** Props of {@link VenueMenuFileBlock}. */
export interface VenueMenuFileBlockProps {
    readonly t: TranslationFn;
    readonly file: MenuFile | null;
    /** Name of the file picked in this session (the input is cleared). */
    readonly pickedFileName: string | null;
    /** A request is in flight. */
    readonly busy: boolean;
    /** The menu entitlement is not held. */
    readonly gated: boolean;
    /** Id of the plan notice that explains the gate. */
    readonly planNoticeId: string;
    readonly onUpload: (file: File) => void;
    readonly onDelete: () => void;
}

/**
 * The file block: current file, delete, and the upload input.
 *
 * @param props - See {@link VenueMenuFileBlockProps}.
 * @returns The block.
 */
export function VenueMenuFileBlock({
    t,
    file,
    pickedFileName,
    busy,
    gated,
    planNoticeId,
    onUpload,
    onDelete
}: VenueMenuFileBlockProps): JSX.Element {
    const describedBy = gated ? planNoticeId : undefined;
    /*
     * The scheme gate (HOS-592 / F-02). `menu_file_url` reached the column
     * through more than the upload route before the write schemas were
     * narrowed, so the value is made safe no matter how it got into the row.
     * `undefined` means the link is DROPPED, never rendered with the raw value.
     */
    const safeFileHref = resolveSafeExternalUrl(file?.url);

    return (
        <div className={styles.fileBlock}>
            <h3 className={styles.subheading}>
                {t('venue.owner.editor.menuManager.fileTitle', 'Foto o PDF del menú')}
            </h3>

            {file ? (
                <div className={styles.fileRow}>
                    {/*
                     * No link when the scheme is not http(s) (HOS-592 / F-02) — and
                     * the Remove button stays: a row whose URL cannot be linked is
                     * exactly the row an owner most needs to be able to delete.
                     */}
                    {safeFileHref ? (
                        <a
                            className={styles.fileLink}
                            href={safeFileHref}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {file.kind === 'pdf'
                                ? t('venue.owner.editor.menuManager.filePdf', 'Ver el PDF')
                                : t('venue.owner.editor.menuManager.fileImage', 'Ver la foto')}
                        </a>
                    ) : (
                        <span className={styles.intro}>
                            {t(
                                'venue.owner.editor.menuManager.fileUnavailable',
                                'No se puede abrir este archivo. Eliminalo y subilo de nuevo.'
                            )}
                        </span>
                    )}
                    <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={busy || gated}
                        aria-describedby={describedBy}
                        onClick={onDelete}
                    >
                        {t('venue.owner.editor.menuManager.removeFile', 'Eliminar')}
                    </button>
                </div>
            ) : null}

            <label className={styles.uploadLabel}>
                <span className={styles.uploadButton}>
                    {file
                        ? t('venue.owner.editor.menuManager.replaceFile', 'Reemplazar el archivo')
                        : t('venue.owner.editor.menuManager.addFile', 'Subir foto o PDF')}
                </span>
                <input
                    type="file"
                    accept={ACCEPTED_MENU_FILE_TYPES}
                    disabled={busy || gated}
                    aria-describedby={describedBy}
                    onChange={(event) => {
                        const selected = event.target.files?.[0];
                        // Cleared so choosing the SAME file again still fires
                        // `change`; without it a failed upload could not be retried.
                        event.target.value = '';
                        if (selected) {
                            onUpload(selected);
                        }
                    }}
                />
                <span
                    className={styles.intro}
                    aria-live="polite"
                >
                    {pickedFileName ??
                        t('venue.owner.editor.menuManager.noFileChosen', 'Ningún archivo elegido')}
                </span>
            </label>
        </div>
    );
}
