/**
 * @file confirm-photo-removal.ts
 * @description Shared confirmation for deleting a photo from an editor
 * (HOS-2429). Photo deletes hit the API at once, so the dialog is the only
 * chance to back out. Both the accommodation editor and the venue/experience
 * editor call it, so the copy and the "cancel means nothing happened" rule
 * live in one place.
 */

import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';
import type { TranslationFn } from '@/lib/i18n';

/**
 * Asks the user to confirm deleting a photo.
 *
 * @param params.t - The caller's translation function.
 * @returns `true` only when the user confirmed; `false` on cancel, Escape or
 * when there is no DOM (the safe answer for a destructive action).
 */
export async function confirmPhotoRemoval({ t }: { readonly t: TranslationFn }): Promise<boolean> {
    return showConfirmationDialog({
        title: t('common.confirmations.removePhoto.title', 'Eliminar foto'),
        message: t(
            'common.confirmations.removePhoto.message',
            '¿Eliminar esta foto? Esta acción no se puede deshacer.'
        ),
        confirmLabel: t('common.confirmations.removePhoto.confirm', 'Eliminar'),
        cancelLabel: t('common.cancel', 'Cancelar')
    });
}
