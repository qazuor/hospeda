/**
 * @file CollectionBookmarkRemoveBtn.client.tsx
 * @description React island for removing a single bookmark from a collection.
 *
 * Calls DELETE /api/v1/protected/user-bookmark-collections/:collectionId/bookmarks/:bookmarkId
 * then triggers a full page reload so the SSR page re-fetches updated data.
 *
 * T-051b: collection detail page — bookmark remove action.
 */

import { useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CollectionBookmarkRemoveBtn.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CollectionBookmarkRemoveBtnProps {
    /** Collection the bookmark belongs to */
    readonly collectionId: string;
    /** Bookmark to remove */
    readonly bookmarkId: string;
    /** API base URL (PUBLIC_API_URL) */
    readonly apiBase: string;
    /** Active locale for translations */
    readonly locale: SupportedLocale;
    /** Accessible label containing entity name */
    readonly ariaLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Button that removes a bookmark from a collection.
 * On success it reloads the page so SSR data is refreshed.
 * Shows an inline error if the API call fails.
 */
export function CollectionBookmarkRemoveBtn({
    collectionId,
    bookmarkId,
    apiBase,
    locale,
    ariaLabel
}: CollectionBookmarkRemoveBtnProps) {
    const { t } = createTranslations(locale);
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleRemove() {
        const confirmMessage = t(
            'account.favorites.collections.removeConfirm',
            '¿Quitar este favorito de la colección? Seguirá guardado en tus favoritos.'
        );
        if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
            return;
        }

        setRemoving(true);
        setError(null);

        try {
            const url = `${apiBase}/api/v1/protected/user-bookmark-collections/${collectionId}/bookmarks/${bookmarkId}`;
            const response = await fetch(url, {
                method: 'DELETE',
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) {
                setError(
                    t(
                        'account.favorites.collections.removeError',
                        'Error al quitar el favorito de la colección'
                    )
                );
                setRemoving(false);
                return;
            }

            // Reload to re-fetch SSR data
            window.location.reload();
        } catch {
            setError(
                t(
                    'account.favorites.collections.removeError',
                    'Error al quitar el favorito de la colección'
                )
            );
            setRemoving(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                aria-label={
                    ariaLabel ??
                    t('account.favorites.collections.removeFromCollection', 'Quitar de colección')
                }
                className={styles.removeBtn}
            >
                {removing
                    ? t('account.favorites.collections.removing', 'Quitando...')
                    : t(
                          'account.favorites.collections.removeFromCollection',
                          'Quitar de colección'
                      )}
            </button>
            {error && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {error}
                </p>
            )}
        </div>
    );
}
