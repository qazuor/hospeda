/**
 * @file PhotoAltBadge.tsx
 * @description The «description missing» pill laid over a photo tile whose alt
 * text is empty (HOS-2489, spec HOS-2415 §6.4: the alt-text warning is visible
 * in both photo editors, not only when leaving the page).
 */

import { StatusPill } from '@/components/account/ui';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { isPhotoAltIncomplete, type PhotoMetadataEditableItem } from './photo-section-helpers';

/**
 * Renders the warning pill when the photo has no alt text, else nothing.
 *
 * @param props - The locale and the photo.
 * @returns The pill, or `null` for a described photo or an SSR placeholder.
 */
export function PhotoAltBadge({
    locale,
    item
}: {
    readonly locale: SupportedLocale;
    readonly item: Pick<PhotoMetadataEditableItem, 'id' | 'alt'>;
}) {
    // An SSR placeholder (no id yet) carries no text at all: not a real gap.
    if (!item.id || !isPhotoAltIncomplete(item)) return null;
    const { t } = createTranslations(locale);
    return (
        <StatusPill
            tone="warning"
            dot
        >
            {t('host.properties.editor.photo.altMissing')}
        </StatusPill>
    );
}
