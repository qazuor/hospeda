/**
 * @file CollectionDetailActions.client.tsx
 * @description «Editar» and «Borrar» of the collection detail page, on the
 * account kit (HOS-2480).
 *
 * - Edit opens the kit create/edit dialog in EDIT mode; on save the page
 *   reloads so the header shows the new name, color and icon.
 * - Delete asks through `useConfirm` (the kit ConfirmDialog, HOS-957: never
 *   `window.confirm`). The delete runs inside the dialog, so a failure keeps it
 *   open with its error and retry; on success the user goes back to favorites.
 */

import { useState } from 'react';
import { Button, useConfirm } from '@/components/account/ui';
import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import type { CollectionForEdit } from './CreateEditCollectionModal.client';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';

/** Props of {@link CollectionDetailActions}. */
export interface CollectionDetailActionsProps {
    /** The collection to act on. */
    readonly collection: CollectionForEdit;
    /** Active locale. */
    readonly locale: SupportedLocale;
}

/**
 * Edit and Delete actions of a collection.
 *
 * @param props - See {@link CollectionDetailActionsProps}.
 * @returns The two buttons, the edit dialog and the confirmation.
 */
export function CollectionDetailActions({ collection, locale }: CollectionDetailActionsProps) {
    const t = createT(locale);
    const [editOpen, setEditOpen] = useState(false);
    const { confirm: askConfirm, confirmDialog } = useConfirm({ locale });

    async function handleDelete(): Promise<void> {
        const deleted = await askConfirm({
            title: t('account.favorites.collections.deleteDialogTitle'),
            description: t('account.favorites.collections.delete_confirm'),
            confirmLabel: t('account.favorites.collections.deleteConfirmButton'),
            onConfirm: async () => {
                const result = await userBookmarkCollectionsApi.delete({ id: collection.id });
                // A rejection keeps the dialog open with its error and retry.
                if (!result.ok) throw new Error('delete failed');
            }
        });
        if (!deleted) return;
        addToast({ type: 'success', message: t('account.favorites.collections.deleteSuccess') });
        window.location.href = buildUrl({ locale, path: 'mi-cuenta/favoritos' });
    }

    return (
        <>
            <Button
                variant="secondary"
                onClick={() => setEditOpen(true)}
                data-testid="collection-actions-edit"
            >
                {t('account.favorites.collections.edit')}
            </Button>
            <Button
                variant="danger-ghost"
                onClick={() => {
                    void handleDelete();
                }}
                data-testid="collection-actions-delete"
            >
                {t('account.favorites.collections.delete')}
            </Button>
            <CreateEditCollectionModal
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                onSaved={() => {
                    setEditOpen(false);
                    window.location.reload();
                }}
                locale={locale}
                collection={collection}
            />
            {confirmDialog}
        </>
    );
}
