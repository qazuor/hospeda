/**
 * @file CreateCollectionAction.tsx
 * @description «Agregar colección», the page-header action of the favorites
 * page (HOS-2480). Replaces `CreateCollectionCTA` and its upsell variant.
 *
 * It reads the collections gate. When creating is locked the button is
 * disabled AND the reason is visible next to it (and tied to it with
 * `aria-describedby`), with the very sentence the «Mover» dialog shows: it is
 * never a silently disabled button. The plan upsell itself lives only in the
 * collections Section's `LockedState`.
 */

import { AddIcon } from '@repo/icons';
import { useId, useState } from 'react';
import { Button } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { CreateEditCollectionModal } from '../CreateEditCollectionModal.client';
import { COLLECTION_CREATED_EVENT } from '../collection-created-event';
import { type CollectionsGate, canCreateCollection, collectionsLockText } from './collections-gate';
import styles from './FavoritesView.module.css';

/** Props of {@link CreateCollectionAction}. */
export interface CreateCollectionActionProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** The collections gate. */
    readonly gate: CollectionsGate;
    /** Catalog names of the plans that carry collections (entitlement toast). */
    readonly gatePlanNames: readonly string[];
}

/**
 * The header «Agregar colección» action and its create dialog.
 *
 * @param props - See {@link CreateCollectionActionProps}.
 * @returns The button, the visible lock reason when locked, and the dialog.
 */
export function CreateCollectionAction({
    locale,
    gate,
    gatePlanNames
}: CreateCollectionActionProps) {
    const t = createT(locale);
    const reasonId = useId();
    const [open, setOpen] = useState(false);
    const canCreate = canCreateCollection({ gate });
    const lockText = collectionsLockText({ gate, t });

    function handleSaved(collection: { id: string; name: string }): void {
        setOpen(false);
        // The list and the gate re-read on this broadcast (HOS-999): no reload.
        window.dispatchEvent(
            new CustomEvent(COLLECTION_CREATED_EVENT, {
                detail: { id: collection.id, name: collection.name }
            })
        );
        addToast({
            type: 'success',
            message: t('account.favorites.collections.createSuccess', undefined, {
                name: collection.name
            })
        });
    }

    return (
        <div className={styles.createAction}>
            <Button
                variant="primary"
                disabled={!canCreate}
                aria-describedby={lockText ? reasonId : undefined}
                data-testid="create-collection-button"
                onClick={() => setOpen(true)}
            >
                <AddIcon
                    size="sm"
                    aria-hidden="true"
                />
                {t('account.favorites.collections.add')}
            </Button>
            {lockText ? (
                <p
                    id={reasonId}
                    className={styles.lockReason}
                >
                    {lockText}
                </p>
            ) : null}
            <CreateEditCollectionModal
                isOpen={open}
                onClose={() => setOpen(false)}
                onSaved={handleSaved}
                locale={locale}
                lockedReason={lockText}
                gatePlanNames={gatePlanNames}
            />
        </div>
    );
}
