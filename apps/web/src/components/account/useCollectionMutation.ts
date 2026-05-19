/**
 * @file useCollectionMutation.ts
 * @description Hook encapsulating the create/update API calls for bookmark collections.
 *
 * Handles:
 * - POST /api/v1/protected/user-bookmark-collections  (create mode)
 * - PATCH /api/v1/protected/user-bookmark-collections/:id  (edit mode)
 * - Inline field error for 409 NAME_TAKEN
 * - Toast for 403 LIMIT_REACHED and generic errors
 *
 * Extracted from CreateEditCollectionModal.client.tsx to keep that file under 500 lines.
 */

import {
    type BookmarkCollectionItem,
    userBookmarkCollectionsApi
} from '@/lib/api/endpoints-protected';
import { addToast } from '@/store/toast-store';
import { useCallback, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Fields submitted by the collection form */
export interface CollectionFormInput {
    readonly name: string;
    readonly description: string;
    readonly color: string;
    readonly icon: string;
}

/** Result callbacks passed by the modal */
export interface CollectionMutationCallbacks {
    /** Called after a successful save with the returned collection */
    readonly onSaved?: (collection: { id: string; name: string }) => void;
    /** Called to close the modal after a successful save or LIMIT_REACHED */
    readonly onClose: () => void;
    /** Called to set an inline error on the name field */
    readonly setNameError: (message: string | null) => void;
}

/** Return value of the hook */
export interface UseCollectionMutationResult {
    /** Whether a request is in flight */
    readonly isSubmitting: boolean;
    /**
     * Submit the form. Validates locally before making the API call.
     * Returns `true` if the request succeeded, `false` otherwise.
     */
    readonly submit: (input: CollectionFormInput) => Promise<boolean>;
}

// ─── Error code constants ─────────────────────────────────────────────────────

const HTTP_CONFLICT = 409;
const HTTP_FORBIDDEN = 403;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Encapsulates the create / update mutation for a bookmark collection.
 *
 * @param params - Optional existing collection ID (triggers PATCH when present)
 *   and the callbacks the modal exposes for feedback.
 * @returns Submitting state and submit handler.
 */
export function useCollectionMutation({
    collectionId,
    callbacks
}: {
    readonly collectionId?: string;
    readonly callbacks: CollectionMutationCallbacks;
}): UseCollectionMutationResult {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = useCallback(
        async (input: CollectionFormInput): Promise<boolean> => {
            const { onSaved, onClose, setNameError } = callbacks;

            // Clear previous field error
            setNameError(null);

            setIsSubmitting(true);

            try {
                const trimmedInput = {
                    name: input.name.trim(),
                    description: input.description.trim() || undefined,
                    color: input.color.trim() || undefined,
                    icon: input.icon.trim() || undefined
                };

                const result =
                    collectionId !== undefined
                        ? await userBookmarkCollectionsApi.update({
                              id: collectionId,
                              input: trimmedInput
                          })
                        : await userBookmarkCollectionsApi.create(trimmedInput);

                if (result.ok) {
                    const saved: BookmarkCollectionItem = result.data;
                    onSaved?.({ id: saved.id, name: saved.name });
                    onClose();
                    return true;
                }

                // Handle known error codes
                const { status, code } = result.error;

                if (status === HTTP_CONFLICT || code === 'NAME_TAKEN') {
                    setNameError('Ese nombre ya está en uso');
                    return false;
                }

                if (status === HTTP_FORBIDDEN || code === 'LIMIT_REACHED') {
                    onClose();
                    addToast({
                        type: 'error',
                        message: 'Ya alcanzaste el máximo de colecciones'
                    });
                    return false;
                }

                // Generic error
                addToast({
                    type: 'error',
                    message: result.error.message ?? 'Ocurrió un error. Intentá de nuevo.'
                });
                return false;
            } finally {
                setIsSubmitting(false);
            }
        },
        [collectionId, callbacks]
    );

    return { isSubmitting, submit };
}
