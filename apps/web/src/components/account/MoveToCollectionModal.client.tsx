/**
 * @file MoveToCollectionModal.client.tsx
 * @description Move a bookmark into a collection, or out of every collection,
 * in the kit `Dialog` (HOS-2480).
 *
 * A radio list of the user's collections plus «Sin colección». «+ Crear nueva
 * colección» is offered ONLY when the collections gate allows creating; when
 * it does not, the dialog says why with the same sentence «Crear colección»
 * shows (HOS-2414 AC-6). Creating from here moves the bookmark into the new
 * collection in the same gesture.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Radio, RadioGroup } from '@/components/account/ui';
import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';
import { COLLECTION_CREATED_EVENT } from './collection-created-event';
import {
    type CollectionsGate,
    canCreateCollection,
    collectionsLockText
} from './favorites/collections-gate';

/** One collection of the radio list. */
export interface CollectionOption {
    readonly id: string;
    readonly name: string;
    readonly color?: string | null;
    readonly icon?: string | null;
    readonly bookmarkCount?: number;
}

/** Props of {@link MoveToCollectionModal}. Fully controlled. */
export interface MoveToCollectionModalProps {
    /** Whether the dialog is open. */
    readonly isOpen: boolean;
    /** Called when the user asks to close. */
    readonly onClose: () => void;
    /**
     * Called after a successful move with the new collection id (null =
     * uncollected) and its name (null when uncollected or unknown).
     */
    readonly onSaved?: (params: {
        readonly newCollectionId: string | null;
        readonly newCollectionName: string | null;
    }) => void;
    /** Locale for i18n. */
    readonly locale: SupportedLocale;
    /** The bookmark being moved. */
    readonly bookmarkId: string;
    /** Its current collection; null means uncollected. */
    readonly currentCollectionId?: string | null;
    /** The user's collections. */
    readonly collections: readonly CollectionOption[];
    /** The collections gate: decides whether «+ Crear nueva colección» is offered. */
    readonly gate: CollectionsGate;
    /** Catalog names of the plans that carry collections (entitlement toast). */
    readonly gatePlanNames?: readonly string[];
}

/** Radio value of «Sin colección». */
const NO_COLLECTION_VALUE = '__none__';

/**
 * The move-to-collection dialog.
 *
 * @param props - See {@link MoveToCollectionModalProps}.
 * @returns The kit Dialog and, when opened, the nested create dialog.
 */
export function MoveToCollectionModal({
    isOpen,
    onClose,
    onSaved,
    locale,
    bookmarkId,
    currentCollectionId = null,
    collections,
    gate,
    gatePlanNames
}: MoveToCollectionModalProps) {
    const { t, tPlural } = createTranslations(locale);
    const [selected, setSelected] = useState<string>(currentCollectionId ?? NO_COLLECTION_VALUE);
    const [createOpen, setCreateOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const canCreate = canCreateCollection({ gate });
    const lockText = collectionsLockText({ gate, t });

    useEffect(() => {
        if (isOpen) setSelected(currentCollectionId ?? NO_COLLECTION_VALUE);
    }, [isOpen, currentCollectionId]);

    const handleClose = useCallback(() => {
        if (createOpen) return;
        onClose();
    }, [onClose, createOpen]);

    /**
     * Persists the move. Moving INTO a collection is one update that sets the
     * target whatever the previous value, so a failure never leaves the
     * bookmark uncollected; moving out removes it from its current one.
     */
    const moveTo = useCallback(
        async (target: string | null): Promise<boolean> => {
            if (target === currentCollectionId) return true;
            const result =
                target === null
                    ? currentCollectionId === null
                        ? null
                        : await userBookmarkCollectionsApi.removeBookmark({
                              collectionId: currentCollectionId,
                              bookmarkId
                          })
                    : await userBookmarkCollectionsApi.addBookmark({
                          collectionId: target,
                          bookmarkId
                      });
            if (result && !result.ok) {
                addToast({ type: 'error', message: translateApiError({ error: result.error, t }) });
                return false;
            }
            return true;
        },
        [currentCollectionId, bookmarkId, t]
    );

    const handleSave = useCallback(async () => {
        const target = selected === NO_COLLECTION_VALUE ? null : selected;
        if (target === currentCollectionId) {
            onClose();
            return;
        }
        setSubmitting(true);
        try {
            if (!(await moveTo(target))) return;
            const name =
                target === null ? null : (collections.find((c) => c.id === target)?.name ?? null);
            onSaved?.({ newCollectionId: target, newCollectionName: name });
            onClose();
        } finally {
            setSubmitting(false);
        }
    }, [selected, currentCollectionId, moveTo, onSaved, onClose, collections]);

    const handleCreated = useCallback(
        async (collection: { id: string; name: string }) => {
            setCreateOpen(false);
            setSelected(collection.id);
            // The collection exists whatever happens to the move below: tell the
            // page now, so its list and gate learn about it (HOS-999).
            window.dispatchEvent(
                new CustomEvent(COLLECTION_CREATED_EVENT, {
                    detail: { id: collection.id, name: collection.name }
                })
            );
            setSubmitting(true);
            try {
                if (!(await moveTo(collection.id))) return;
                onSaved?.({ newCollectionId: collection.id, newCollectionName: collection.name });
                onClose();
            } finally {
                setSubmitting(false);
            }
        },
        [moveTo, onSaved, onClose]
    );

    const unchanged = selected === (currentCollectionId ?? NO_COLLECTION_VALUE);
    const title = t('account.favorites.collections.move_to');

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(next) => {
                    if (!next) handleClose();
                }}
                title={title}
                locale={locale}
                dismissible={!createOpen}
                footer={
                    <>
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            data-testid="move-bookmark-confirm"
                            onClick={() => {
                                void handleSave();
                            }}
                            loading={submitting}
                            disabled={unchanged}
                        >
                            {t('account.favorites.collections.move')}
                        </Button>
                    </>
                }
            >
                <div data-testid="move-bookmark-modal">
                    <RadioGroup
                        legend={t('account.favorites.collections.assignPrompt')}
                        locale={locale}
                        value={selected}
                        onValueChange={setSelected}
                    >
                        <Radio
                            value={NO_COLLECTION_VALUE}
                            label={t('account.favorites.collections.no_collection')}
                            data-testid="move-bookmark-collection-option-uncollected"
                        />
                        {collections.map((collection) => (
                            <Radio
                                key={collection.id}
                                value={collection.id}
                                label={collection.name}
                                description={
                                    collection.bookmarkCount === undefined
                                        ? undefined
                                        : tPlural(
                                              'account.favorites.bookmarks.count',
                                              collection.bookmarkCount,
                                              { count: collection.bookmarkCount }
                                          )
                                }
                                data-testid={`move-bookmark-collection-option-${collection.id}`}
                            />
                        ))}
                    </RadioGroup>
                    {canCreate ? (
                        <Button
                            variant="quiet"
                            onClick={() => setCreateOpen(true)}
                        >
                            {t('account.favorites.collections.new_collection')}
                        </Button>
                    ) : (
                        <p data-testid="move-bookmark-create-locked">{lockText}</p>
                    )}
                </div>
            </Dialog>
            <CreateEditCollectionModal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                onSaved={(collection) => {
                    void handleCreated(collection);
                }}
                locale={locale}
                lockedReason={lockText}
                gatePlanNames={gatePlanNames}
            />
        </>
    );
}
