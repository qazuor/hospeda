/**
 * @file MoveToCollectionModal.client.tsx
 * @description React island modal for moving a bookmark into a collection (or removing it
 * from any collection). Renders a radio list of the user's existing collections plus a
 * "Sin colección" option and a "+ Crear nueva colección" trigger.
 *
 * API wiring implemented in T-048b.
 *
 * Inline-create flow: when the user taps "+ Crear nueva colección" and saves the
 * sub-modal, the bookmark is moved into the freshly created collection in the
 * same gesture (see `handleCreateModalSaved`). The parent receives the new
 * collection via `onSaved` and is expected to refetch its collections list so
 * the next opening of the modal includes the new entry.
 *
 * Hydration: caller must use `client:load`.
 */

import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import { translateApiError } from '@/lib/api-errors';
import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useState } from 'react';
import { CreateEditCollectionModal } from './CreateEditCollectionModal.client';
import styles from './MoveToCollectionModal.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A single collection item shown in the radio list.
 */
export interface CollectionOption {
    readonly id: string;
    readonly name: string;
    readonly color?: string | null;
    readonly icon?: string | null;
    readonly bookmarkCount?: number;
}

/**
 * Props for the MoveToCollectionModal component.
 *
 * The modal is fully controlled: the parent manages `isOpen` and calls `onClose`
 * to dismiss it. Pass `currentCollectionId` to pre-select the matching radio option.
 */
export interface MoveToCollectionModalProps {
    /** Whether the modal is open. Controlled. */
    readonly isOpen: boolean;
    /** Called when the user requests to close (Escape, click outside, X button, Cancel). */
    readonly onClose: () => void;
    /**
     * Called after a successful save. Receives the new collection id
     * (null means "uncollected") and the collection name (null when uncollected
     * or when no matching collection is found in `collections`). The name lets
     * the parent show a toast with the destination collection name.
     */
    readonly onSaved?: (params: {
        readonly newCollectionId: string | null;
        readonly newCollectionName: string | null;
    }) => void;
    /** Locale for i18n. */
    readonly locale: SupportedLocale;
    /** The bookmark being moved. */
    readonly bookmarkId: string;
    /**
     * The current collection id of the bookmark — pre-selects this option.
     * null (or undefined) means the bookmark is currently uncollected.
     */
    readonly currentCollectionId?: string | null;
    /**
     * The user's existing collections. Should be fetched by the parent before opening.
     * Passed as readonly to enforce immutability at the call site.
     */
    readonly collections: readonly CollectionOption[];
    /**
     * When true, the "+ Crear nueva colección" button is disabled and shows a
     * tooltip-level hint. The 403 fallback in T-048b handles actual enforcement.
     */
    readonly isAtLimit?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Value used to represent the "no collection" (uncollected) radio option. */
const NO_COLLECTION_VALUE = '__none__' as const;

/** Stable ID for the modal title element used by aria-labelledby. */
const MODAL_TITLE_ID = 'move-to-collection-modal-title';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal for moving a bookmark to one of the user's collections, or removing it
 * from any collection ("Sin colección").
 */
export function MoveToCollectionModal({
    isOpen,
    onClose,
    onSaved,
    locale,
    bookmarkId,
    currentCollectionId = null,
    collections,
    isAtLimit = false
}: MoveToCollectionModalProps) {
    const t = createT(locale);

    // ── State ──────────────────────────────────────────────────────────────

    /**
     * The currently selected radio value.
     * Initialised from currentCollectionId (null → NO_COLLECTION_VALUE).
     */
    const [selectedValue, setSelectedValue] = useState<string>(
        currentCollectionId ?? NO_COLLECTION_VALUE
    );

    /** Controls whether the CreateEditCollectionModal sub-modal is open. */
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    /** True while an API call is in-flight. Disables the Save button. */
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sync selected value when modal opens or currentCollectionId changes
    useEffect(() => {
        if (isOpen) {
            setSelectedValue(currentCollectionId ?? NO_COLLECTION_VALUE);
        }
    }, [isOpen, currentCollectionId]);

    const handleClose = useCallback(() => {
        // Don't close while the sub-modal is open
        if (isCreateModalOpen) return;
        onClose();
    }, [onClose, isCreateModalOpen]);

    // ── Save handler ──────────────────────────────────────────────────────

    /**
     * Persist the move from `currentCollectionId` to `targetCollectionId`.
     * Handles the four transitions: no-op, add, remove, move. Returns true on
     * success so callers can decide what to do next (toast, close, refresh).
     *
     * Extracted so both the "Save" button and the inline "create + auto-move"
     * flow can share the API sequencing.
     */
    const moveBookmarkTo = useCallback(
        async (targetCollectionId: string | null): Promise<boolean> => {
            if (targetCollectionId === currentCollectionId) {
                return true;
            }

            if (currentCollectionId === null && targetCollectionId !== null) {
                const result = await userBookmarkCollectionsApi.addBookmark({
                    collectionId: targetCollectionId,
                    bookmarkId
                });
                if (!result.ok) {
                    addToast({
                        type: 'error',
                        message: translateApiError({ error: result.error, t })
                    });
                    return false;
                }
                return true;
            }

            if (currentCollectionId !== null && targetCollectionId === null) {
                const result = await userBookmarkCollectionsApi.removeBookmark({
                    collectionId: currentCollectionId,
                    bookmarkId
                });
                if (!result.ok) {
                    addToast({
                        type: 'error',
                        message: translateApiError({ error: result.error, t })
                    });
                    return false;
                }
                return true;
            }

            if (currentCollectionId !== null && targetCollectionId !== null) {
                // Move: remove from old, add to new (sequential — no atomic endpoint)
                const removeResult = await userBookmarkCollectionsApi.removeBookmark({
                    collectionId: currentCollectionId,
                    bookmarkId
                });
                if (!removeResult.ok) {
                    addToast({
                        type: 'error',
                        message: translateApiError({ error: removeResult.error, t })
                    });
                    return false;
                }
                const addResult = await userBookmarkCollectionsApi.addBookmark({
                    collectionId: targetCollectionId,
                    bookmarkId
                });
                if (!addResult.ok) {
                    addToast({
                        type: 'error',
                        message: translateApiError({ error: addResult.error, t })
                    });
                    return false;
                }
                return true;
            }

            return true;
        },
        [currentCollectionId, bookmarkId, t]
    );

    const handleSave = useCallback(async (): Promise<void> => {
        // Derive the selected collection id: __none__ maps to null
        const newCollectionId = selectedValue === NO_COLLECTION_VALUE ? null : selectedValue;

        // No-op: selection unchanged
        if (newCollectionId === currentCollectionId) {
            onClose();
            return;
        }

        setIsSubmitting(true);

        try {
            const ok = await moveBookmarkTo(newCollectionId);
            if (!ok) return;

            const newCollectionName =
                newCollectionId === null
                    ? null
                    : (collections.find((c) => c.id === newCollectionId)?.name ?? null);
            onSaved?.({ newCollectionId, newCollectionName });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedValue, currentCollectionId, moveBookmarkTo, onSaved, onClose, collections]);

    // ESC, focus trap, scroll lock, click outside, focus management — all
    // owned by the shared <Dialog> wrapper. Nothing to wire here.

    function handleRadioChange(value: string): void {
        setSelectedValue(value);
    }

    function handleNewCollectionClick(): void {
        if (!isAtLimit) setIsCreateModalOpen(true);
    }

    function handleCreateModalClose(): void {
        setIsCreateModalOpen(false);
    }

    /**
     * Called after the inline "+ Crear nueva colección" sub-modal saves a new
     * collection. We auto-complete the move flow into that collection so the
     * user does not have to reopen the parent modal and re-select.
     */
    const handleCreateModalSaved = useCallback(
        async (collection: { id: string; name: string }): Promise<void> => {
            // Close the create sub-modal first so the user sees the move land.
            setIsCreateModalOpen(false);
            setSelectedValue(collection.id);

            setIsSubmitting(true);
            try {
                const ok = await moveBookmarkTo(collection.id);
                if (!ok) return;

                onSaved?.({ newCollectionId: collection.id, newCollectionName: collection.name });
                onClose();
            } finally {
                setIsSubmitting(false);
            }
        },
        [moveBookmarkTo, onSaved, onClose]
    );

    // ── Derived labels ─────────────────────────────────────────────────────

    const modalTitle = t('account.favorites.collections.move_to', 'Mover a colección');
    const noCollectionLabel = t('account.favorites.collections.no_collection', 'Sin colección');
    const newCollectionLabel = t(
        'account.favorites.collections.new_collection',
        '+ Crear nueva colección'
    );
    const cancelLabel = t('common.cancel', 'Cancelar');
    const saveLabel = t('account.favorites.collections.move', 'Mover');

    // ── JSX ────────────────────────────────────────────────────────────────

    return (
        <>
            <Dialog
                isOpen={isOpen}
                onClose={handleClose}
                size="md"
                ariaLabelledBy={MODAL_TITLE_ID}
                closeOnEscape={!isCreateModalOpen}
                closeOnOverlayClick={!isCreateModalOpen}
            >
                <div data-testid="move-bookmark-modal">
                    <DialogHeader
                        titleId={MODAL_TITLE_ID}
                        onClose={handleClose}
                        closeLabel={t('common.auth.close', 'Cerrar')}
                    >
                        {modalTitle}
                    </DialogHeader>

                    <DialogBody>
                        {/* Radio group — one option per collection + "Sin colección" */}
                        <div
                            className={styles.radioGroup}
                            role="radiogroup"
                            aria-label={modalTitle}
                        >
                            {/* "Sin colección" option — always first */}
                            <label
                                data-testid="move-bookmark-collection-option-uncollected"
                                className={`${styles.radioRow}${selectedValue === NO_COLLECTION_VALUE ? ` ${styles.radioRowSelected}` : ''}`}
                            >
                                <span
                                    className={styles.radioControl}
                                    aria-hidden="true"
                                >
                                    <input
                                        type="radio"
                                        className={styles.radioInput}
                                        name="collection-select"
                                        value={NO_COLLECTION_VALUE}
                                        checked={selectedValue === NO_COLLECTION_VALUE}
                                        onChange={() => handleRadioChange(NO_COLLECTION_VALUE)}
                                        aria-label={noCollectionLabel}
                                    />
                                    <span
                                        className={styles.radioIndicator}
                                        aria-hidden="true"
                                    />
                                </span>

                                {/* Color swatch placeholder (no color for "none") */}
                                <span
                                    className={`${styles.colorDot} ${styles.colorDotNone}`}
                                    aria-hidden="true"
                                />

                                <span className={styles.radioLabel}>{noCollectionLabel}</span>
                            </label>

                            {/* Existing collections */}
                            {collections.map((collection) => {
                                const isSelected = selectedValue === collection.id;
                                return (
                                    <label
                                        key={collection.id}
                                        data-testid={`move-bookmark-collection-option-${collection.id}`}
                                        className={`${styles.radioRow}${isSelected ? ` ${styles.radioRowSelected}` : ''}`}
                                    >
                                        <span
                                            className={styles.radioControl}
                                            aria-hidden="true"
                                        >
                                            <input
                                                type="radio"
                                                className={styles.radioInput}
                                                name="collection-select"
                                                value={collection.id}
                                                checked={isSelected}
                                                onChange={() => handleRadioChange(collection.id)}
                                                aria-label={collection.name}
                                            />
                                            <span
                                                className={styles.radioIndicator}
                                                aria-hidden="true"
                                            />
                                        </span>

                                        {/* Color dot */}
                                        {collection.color ? (
                                            <span
                                                className={styles.colorDot}
                                                style={{ backgroundColor: collection.color }}
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <span
                                                className={`${styles.colorDot} ${styles.colorDotNone}`}
                                                aria-hidden="true"
                                            />
                                        )}

                                        {/* Icon + name */}
                                        <span className={styles.collectionInfo}>
                                            <span className={styles.radioLabel}>
                                                {collection.name}
                                            </span>
                                            {collection.bookmarkCount !== undefined && (
                                                <span
                                                    className={styles.countBadge}
                                                    aria-label={t(
                                                        'account.favorites.collections.bookmark_count',
                                                        '{{count}} alojamientos',
                                                        { count: collection.bookmarkCount }
                                                    )}
                                                >
                                                    {collection.bookmarkCount}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>

                        {/* ── "+ Crear nueva colección" ────────────────── */}
                        <button
                            type="button"
                            className={styles.newCollectionBtn}
                            onClick={handleNewCollectionClick}
                            disabled={isAtLimit}
                            aria-disabled={isAtLimit}
                            title={
                                isAtLimit
                                    ? t(
                                          'account.favorites.collections.limit_reached_short',
                                          'Límite de colecciones alcanzado'
                                      )
                                    : undefined
                            }
                        >
                            {newCollectionLabel}
                        </button>
                    </DialogBody>

                    <DialogFooter>
                        <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={handleClose}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={handleSave}
                            data-testid="move-bookmark-confirm"
                            disabled={
                                isSubmitting ||
                                selectedValue === (currentCollectionId ?? NO_COLLECTION_VALUE)
                            }
                            aria-disabled={
                                isSubmitting ||
                                selectedValue === (currentCollectionId ?? NO_COLLECTION_VALUE)
                            }
                        >
                            {saveLabel}
                        </button>
                    </DialogFooter>
                </div>
            </Dialog>

            {/* ── Sub-modal: CreateEditCollectionModal ─────────────────── */}
            <CreateEditCollectionModal
                isOpen={isCreateModalOpen}
                onClose={handleCreateModalClose}
                onSaved={handleCreateModalSaved}
                locale={locale}
                isAtLimit={isAtLimit}
            />
        </>
    );
}
