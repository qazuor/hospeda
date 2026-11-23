/**
 * @file MoveToCollectionModal.test.tsx
 * @description Tests for the «Mover» dialog on the kit Dialog (HOS-999,
 * HOS-2480).
 *
 * Covers:
 * - Inline create broadcasts `hospeda:collection-created` (HOS-999), before
 *   the move call and even when the move fails.
 * - The collections gate decides «+ Crear nueva colección»: offered when
 *   creating is open, replaced by the reason when there is no plan or the
 *   limit is reached (HOS-2414 AC-6, same sentence as «Crear colección»).
 * - Moving into a collection calls `addBookmark` and reports the new one.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_CREATED_EVENT } from '../../../src/components/account/collection-created-event';
import type { CollectionsGate } from '../../../src/components/account/favorites/collections-gate';
import { MoveToCollectionModal } from '../../../src/components/account/MoveToCollectionModal.client';

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

/** New collection returned by the stubbed create dialog's "save" click. */
const NEW_COLLECTION = { id: 'new-col-1', name: 'Recién creada' };

vi.mock('../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: ({
        isOpen,
        onSaved
    }: {
        isOpen: boolean;
        onSaved?: (collection: { id: string; name: string }) => void;
    }) =>
        isOpen ? (
            <button
                type="button"
                data-testid="stub-create-save"
                onClick={() => onSaved?.(NEW_COLLECTION)}
            >
                Save new collection
            </button>
        ) : null
}));

const addBookmarkMock = vi.fn();
const removeBookmarkMock = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        addBookmark: (...args: unknown[]) => addBookmarkMock(...args),
        removeBookmark: (...args: unknown[]) => removeBookmarkMock(...args)
    }
}));

const OPEN_GATE: CollectionsGate = { kind: 'open', usage: { current: 1, max: 10 } };

function renderModal(overrides: Partial<React.ComponentProps<typeof MoveToCollectionModal>> = {}) {
    const onSaved = vi.fn();
    const utils = render(
        <MoveToCollectionModal
            isOpen
            onClose={vi.fn()}
            onSaved={onSaved}
            locale="es"
            bookmarkId="bm-1"
            currentCollectionId={null}
            collections={[{ id: 'col-a', name: 'Verano', bookmarkCount: 2 }]}
            gate={OPEN_GATE}
            {...overrides}
        />
    );
    return { ...utils, onSaved };
}

/** Opens the inline create dialog and clicks its stubbed save button. */
function triggerInlineCreate() {
    fireEvent.click(screen.getByRole('button', { name: '+ Crear nueva colección' }));
    fireEvent.click(screen.getByTestId('stub-create-save'));
}

describe('MoveToCollectionModal — inline create broadcast (HOS-999)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addBookmarkMock.mockResolvedValue({ ok: true, data: {} });
    });

    it('broadcasts hospeda:collection-created with the new collection id/name', async () => {
        // Arrange
        const listener = vi.fn();
        window.addEventListener(COLLECTION_CREATED_EVENT, listener);
        renderModal();

        // Act
        triggerInlineCreate();

        // Assert
        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        const event = listener.mock.calls[0]?.[0] as CustomEvent<{ id: string; name: string }>;
        expect(event.detail).toEqual(NEW_COLLECTION);
        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });

    it('still broadcasts when the follow-up move-into-collection call fails', async () => {
        // Arrange: the collection was created; only the move fails.
        addBookmarkMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Boom' }
        });
        const listener = vi.fn();
        window.addEventListener(COLLECTION_CREATED_EVENT, listener);
        const { onSaved } = renderModal();

        // Act
        triggerInlineCreate();

        // Assert
        await waitFor(() => expect(addBookmarkMock).toHaveBeenCalledTimes(1));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(onSaved).not.toHaveBeenCalled();
        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });

    it('broadcasts before calling the move API, not after it resolves', async () => {
        // Arrange
        const order: string[] = [];
        const listener = () => order.push('broadcast');
        addBookmarkMock.mockImplementation(async () => {
            order.push('move');
            return { ok: true, data: {} };
        });
        window.addEventListener(COLLECTION_CREATED_EVENT, listener);
        renderModal();

        // Act
        triggerInlineCreate();

        // Assert
        await waitFor(() => expect(order).toEqual(['broadcast', 'move']));
        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });
});

describe('MoveToCollectionModal — the collections gate (HOS-2480)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        addBookmarkMock.mockResolvedValue({ ok: true, data: {} });
    });

    it('offers «+ Crear nueva colección» when creating is open', () => {
        renderModal({ gate: OPEN_GATE });
        expect(screen.getByRole('button', { name: '+ Crear nueva colección' })).toBeEnabled();
        expect(screen.queryByTestId('move-bookmark-create-locked')).not.toBeInTheDocument();
    });

    it('without the plan: no create entry, and the reason is said', () => {
        renderModal({ gate: { kind: 'noPlan' } });
        expect(
            screen.queryByRole('button', { name: '+ Crear nueva colección' })
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('move-bookmark-create-locked')).toHaveTextContent(
            'Tu plan no incluye colecciones.'
        );
    });

    it('at the limit: no create entry, and the limit is said', () => {
        renderModal({ gate: { kind: 'atLimit', usage: { current: 3, max: 3 } } });
        expect(
            screen.queryByRole('button', { name: '+ Crear nueva colección' })
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('move-bookmark-create-locked')).toHaveTextContent(
            'Ya alcanzaste el máximo de 3 colecciones'
        );
    });

    it('moves into the chosen collection and reports it', async () => {
        const { onSaved } = renderModal();
        fireEvent.click(screen.getByTestId('move-bookmark-collection-option-col-a'));
        fireEvent.click(screen.getByTestId('move-bookmark-confirm'));

        await waitFor(() =>
            expect(onSaved).toHaveBeenCalledWith({
                newCollectionId: 'col-a',
                newCollectionName: 'Verano'
            })
        );
        expect(addBookmarkMock).toHaveBeenCalledWith({ collectionId: 'col-a', bookmarkId: 'bm-1' });
    });
});
