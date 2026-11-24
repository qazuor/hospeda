/**
 * @file PhotoUploadStatus.tsx
 * @description The upload line of both photo editors (HOS-2489): «optimizing»
 * while a large file is recompressed client-side (HOS-332), then the upload
 * with its progress and the «photo n of N» marker of a batch (HOS-122/832).
 * Built on the kit `MediaUploadStatus`.
 */

import { MediaUploadStatus } from '@/components/account/ui';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';

/** Props of {@link PhotoUploadStatus}. */
export interface PhotoUploadStatusProps {
    readonly locale: SupportedLocale;
    readonly isCompressing: boolean;
    readonly isUploading: boolean;
    /** Upload percentage, when the transport reports it (the accommodation XHR does). */
    readonly progress?: number | null;
    /** Position in a multi-file batch; `null` for a single file. */
    readonly batch: { readonly current: number; readonly total: number } | null;
}

/**
 * Renders the current upload step, or nothing when idle.
 *
 * @param props - See {@link PhotoUploadStatusProps}.
 * @returns The status line or `null`.
 */
export function PhotoUploadStatus({
    locale,
    isCompressing,
    isUploading,
    progress = null,
    batch
}: PhotoUploadStatusProps) {
    const { t } = createTranslations(locale);

    if (isCompressing) {
        return (
            <MediaUploadStatus
                label={t('host.properties.editor.photo.processingImage', 'Optimizando imagen…')}
            />
        );
    }
    if (!isUploading) return null;

    const label =
        batch && batch.total > 1
            ? t(
                  'host.properties.editor.photo.uploadingBatch',
                  'Subiendo foto {{current}} de {{total}}…',
                  {
                      current: batch.current,
                      total: batch.total
                  }
              )
            : t('host.properties.editor.photo.uploading');

    return (
        <MediaUploadStatus
            label={label}
            progress={progress}
        />
    );
}
