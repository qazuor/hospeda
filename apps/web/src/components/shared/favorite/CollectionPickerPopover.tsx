/**
 * @file CollectionPickerPopover.tsx
 * @description Lightweight popover anchored to a FavoriteButton that lets the
 * user (optionally) assign a freshly-saved bookmark to one of their
 * collections, without leaving the current page.
 *
 * The popover is fully optional: the bookmark is already persisted by the
 * time it appears. Dismissing the popover (Escape, click outside, X) leaves
 * the bookmark uncollected. Clicking a collection chip fires the assignment
 * in the background and closes the popover with a confirmation toast.
 */

import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { BookmarkCollectionItem } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import styles from './CollectionPickerPopover.module.css';

/** Auto-dismiss the popover after this many milliseconds of inactivity. */
const AUTO_DISMISS_MS = 8000;

export interface CollectionPickerPopoverProps {
    /** Bookmark to assign. The popover only opens after a successful save. */
    readonly bookmarkId: string;
    /** User's existing collections (cached at module level). */
    readonly collections: readonly BookmarkCollectionItem[];
    /** Locale for the labels and the toast message. */
    readonly locale: SupportedLocale;
    /** Called when the user dismisses or auto-dismiss fires. */
    readonly onClose: () => void;
    /**
     * Called once a collection has been successfully assigned. Receives the
     * collection id so the parent can update its own toast (e.g. point the
     * "Ver favoritos" link at the collection detail page).
     */
    readonly onAssigned?: (params: { readonly collectionId: string }) => void;
}

export const CollectionPickerPopover: FC<CollectionPickerPopoverProps> = ({
    bookmarkId,
    collections,
    locale,
    onClose,
    onAssigned
}) => {
    const t = createT(locale);
    const [busyId, setBusyId] = useState<string | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    // Auto-dismiss after AUTO_DISMISS_MS so a forgotten popover doesn't linger.
    useEffect(() => {
        const timer = setTimeout(onClose, AUTO_DISMISS_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    // Close on Escape.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // Close on click outside.
    useEffect(() => {
        const onClickOutside = (e: MouseEvent): void => {
            const node = rootRef.current;
            if (node && e.target instanceof Node && !node.contains(e.target)) {
                onClose();
            }
        };
        // Defer so the click that opened us doesn't immediately close us.
        const handle = setTimeout(() => {
            document.addEventListener('click', onClickOutside);
        }, 0);
        return () => {
            clearTimeout(handle);
            document.removeEventListener('click', onClickOutside);
        };
    }, [onClose]);

    const handlePick = useCallback(
        async (collection: BookmarkCollectionItem): Promise<void> => {
            if (busyId !== null) return;
            setBusyId(collection.id);
            try {
                const result = await userBookmarkCollectionsApi.addBookmark({
                    collectionId: collection.id,
                    bookmarkId
                });
                if (!result.ok) {
                    addToast({
                        type: 'error',
                        message:
                            result.error.message ??
                            t(
                                'account.favorites.collections.assignFailed',
                                'No se pudo asignar a la colección'
                            )
                    });
                    return;
                }
                onAssigned?.({ collectionId: collection.id });
                addToast({
                    type: 'success',
                    message: t('account.favorites.collections.assignSuccess', 'Movido a {{name}}', {
                        name: collection.name
                    }),
                    action: {
                        label: t('account.favorites.toast.view', 'Ver favoritos'),
                        href: `/${locale}/mi-cuenta/favoritos/colecciones/${collection.id}/`
                    }
                });
                onClose();
            } finally {
                setBusyId(null);
            }
        },
        [bookmarkId, busyId, locale, onAssigned, onClose, t]
    );

    return (
        <div
            ref={rootRef}
            className={styles.root}
            // biome-ignore lint/a11y/useSemanticElements: inline popover anchored to a button, not a modal dialog — native <dialog> requires showModal()/close() and blocks the page, which is wrong for this UX.
            role="dialog"
            aria-label={t('account.favorites.collections.assignPrompt', 'Asignar a una colección')}
        >
            <div className={styles.header}>
                <p className={styles.title}>
                    {t('account.favorites.collections.assignPrompt', 'Asignar a una colección')}
                </p>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label={t('common.auth.close', 'Cerrar')}
                >
                    ×
                </button>
            </div>
            <ul className={styles.list}>
                {collections.map((collection) => (
                    <li key={collection.id}>
                        <button
                            type="button"
                            className={styles.chip}
                            onClick={() => {
                                void handlePick(collection);
                            }}
                            disabled={busyId !== null}
                        >
                            <span
                                className={styles.colorDot}
                                style={
                                    collection.color
                                        ? { backgroundColor: collection.color }
                                        : undefined
                                }
                                aria-hidden="true"
                            />
                            <span className={styles.chipName}>{collection.name}</span>
                            {typeof collection.bookmarkCount === 'number' && (
                                <span className={styles.chipCount}>{collection.bookmarkCount}</span>
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
