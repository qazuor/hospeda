/**
 * @file CollectionDetailActions.client.tsx
 * @description React island that renders the Edit and Delete action buttons for a
 * bookmark collection detail page.
 *
 * - Edit: opens the CreateEditCollectionModal in EDIT mode pre-filled with the
 *   collection data. On save, reloads the page so the header reflects any changes.
 * - Delete: shows a window.confirm() dialog (MVP). On confirm, calls the delete
 *   API and redirects to the favorites page. On error, shows an error toast.
 *
 * Hydration: caller must use `client:load`.
 */

import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useState } from 'react';
import styles from './CollectionDetailActions.module.css';
import type { CollectionForEdit } from './CreateEditCollectionModal.client';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The collection data passed to this island.
 * All fields match what is available from the collection detail API.
 */
export interface CollectionDetailActionsProps {
    /** The collection to act on. */
    readonly collection: CollectionForEdit;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
    /** URL language segment (e.g. "es") used to build the redirect path. */
    readonly lang: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders Editar and Borrar buttons for a collection detail page.
 * Manages the edit modal and delete confirmation flow.
 */
export function CollectionDetailActions({
    collection,
    locale,
    lang
}: CollectionDetailActionsProps) {
    const t = createT(locale);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Edit handlers ─────────────────────────────────────────────────────

    function handleEditOpen(): void {
        setIsEditModalOpen(true);
    }

    function handleEditClose(): void {
        setIsEditModalOpen(false);
    }

    function handleEditSaved(): void {
        setIsEditModalOpen(false);
        // Reload the page so the header reflects the updated name/color/icon
        window.location.reload();
    }

    // ── Delete handler ────────────────────────────────────────────────────

    async function handleDelete(): Promise<void> {
        const confirmMessage = t(
            'account.favorites.collections.delete_confirm',
            '¿Estás seguro de que querés borrar esta colección?'
        );

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setIsDeleting(true);

        try {
            const result = await userBookmarkCollectionsApi.delete({ id: collection.id });

            if (!result.ok) {
                addToast({
                    type: 'error',
                    message: t(
                        'account.favorites.collections.deleteError',
                        'No se pudo borrar la colección. Intentá de nuevo.'
                    )
                });
                return;
            }

            // Redirect to the favorites page on success
            window.location.href = `/${lang}/mi-cuenta/favoritos/`;
        } finally {
            setIsDeleting(false);
        }
    }

    // ── JSX ───────────────────────────────────────────────────────────────

    const editLabel = t('account.favorites.collections.edit', 'Editar');
    const deleteLabel = t('account.favorites.collections.delete', 'Borrar');

    return (
        <div className={styles.actions}>
            <button
                type="button"
                className={`${styles.btn} ${styles.editBtn}`}
                onClick={handleEditOpen}
                disabled={isDeleting}
                aria-label={t('account.favorites.collections.edit', 'Editar colección')}
            >
                {editLabel}
            </button>

            <button
                type="button"
                className={`${styles.btn} ${styles.deleteBtn}`}
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                aria-label={t('account.favorites.collections.delete', 'Borrar colección')}
                aria-busy={isDeleting}
            >
                {deleteLabel}
            </button>

            <CreateEditCollectionModal
                isOpen={isEditModalOpen}
                onClose={handleEditClose}
                onSaved={handleEditSaved}
                locale={locale}
                collection={collection}
            />
        </div>
    );
}
