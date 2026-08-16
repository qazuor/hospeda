/**
 * @file PhotoGalleryItem.client.tsx
 * @description One gallery thumbnail in the accommodation photo editor
 * (HOS-122), with its per-photo action row: remove, promote to portada, and
 * keyboard-operable move up / move down for manual reordering.
 *
 * Extracted from `PhotoSection.client.tsx` to keep that file under the
 * repo's 500-line ceiling once multi-select upload, drag & drop, and reorder
 * actions were added.
 *
 * Reordering here is BUTTON-driven, not drag-and-drop (owner decision,
 * HOS-122): the editor's audience is largely non-technical hosts, and a
 * pointer-only drag gesture excludes keyboard and screen-reader users. Plain
 * `<button>` elements get full keyboard operability (Tab + Enter/Space) for
 * free, which a custom drag implementation would have to build by hand.
 */

import type { AccommodationMediaItem } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PhotoSection.module.css';

export interface PhotoGalleryItemProps {
    readonly locale: SupportedLocale;
    readonly item: AccommodationMediaItem;
    /** 1-based position in the gallery — used for alt text and aria-labels. */
    readonly position: number;
    readonly isFirst: boolean;
    readonly isLast: boolean;
    /** True while any op is in flight, hydration is pending, or the item lacks a DB id yet. */
    readonly disabled: boolean;
    readonly onRemove: (item: AccommodationMediaItem) => void;
    readonly onPromote: (item: AccommodationMediaItem) => void;
    readonly onMoveUp: (item: AccommodationMediaItem) => void;
    readonly onMoveDown: (item: AccommodationMediaItem) => void;
}

/**
 * Renders one gallery photo: the thumbnail, a remove button, and a toolbar
 * with move-up / move-down / promote-to-portada actions.
 */
export function PhotoGalleryItem({
    locale,
    item,
    position,
    isFirst,
    isLast,
    disabled,
    onRemove,
    onPromote,
    onMoveUp,
    onMoveDown
}: PhotoGalleryItemProps) {
    const { t } = createTranslations(locale);
    const canOperate = !disabled && Boolean(item.id);

    return (
        <div className={styles.galleryItem}>
            <img
                src={item.url}
                alt={
                    item.alt ??
                    t('host.properties.editor.photo.galleryAlt', undefined, { index: position })
                }
                className={styles.galleryItemImage}
            />
            <div className={styles.galleryItemActions}>
                <button
                    type="button"
                    className={styles.previewButton}
                    onClick={() => onRemove(item)}
                    disabled={!canOperate}
                    aria-label={t('host.properties.editor.photo.remove', 'Eliminar')}
                >
                    ✕
                </button>
            </div>
            <div className={styles.galleryItemToolbar}>
                <button
                    type="button"
                    className={styles.toolbarButton}
                    onClick={() => onMoveUp(item)}
                    disabled={!canOperate || isFirst}
                    aria-label={t(
                        'host.properties.editor.photo.moveUpAria',
                        'Mover foto {{index}} hacia arriba',
                        { index: position }
                    )}
                >
                    ↑
                </button>
                <button
                    type="button"
                    className={styles.toolbarButton}
                    onClick={() => onMoveDown(item)}
                    disabled={!canOperate || isLast}
                    aria-label={t(
                        'host.properties.editor.photo.moveDownAria',
                        'Mover foto {{index}} hacia abajo',
                        { index: position }
                    )}
                >
                    ↓
                </button>
                <button
                    type="button"
                    className={styles.toolbarButtonPromote}
                    onClick={() => onPromote(item)}
                    disabled={!canOperate}
                    aria-label={t(
                        'host.properties.editor.photo.promoteToFeaturedAria',
                        'Usar foto {{index}} como portada',
                        { index: position }
                    )}
                >
                    {t('host.properties.editor.photo.promoteToFeaturedShort', 'Portada')}
                </button>
            </div>
        </div>
    );
}
