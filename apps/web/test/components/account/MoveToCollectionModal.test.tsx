/**
 * @file MoveToCollectionModal.test.tsx
 * @description Unit tests for the "+ Crear nueva colección" inline-create flow
 * inside MoveToCollectionModal (HOS-999).
 *
 * Covers:
 * - Creating a collection from the inline sub-modal broadcasts
 *   `hospeda:collection-created` with the new collection's id/name
 * - The broadcast fires even when the follow-up move-into-collection call
 *   fails — the collection row was created regardless, so
 *   CollectionUsageMeter/UserFavoritesList must still learn about it
 * - The broadcast fires BEFORE the move API call, not after it resolves
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION_CREATED_EVENT } from '../../../src/components/account/collection-created-event';
import { MoveToCollectionModal } from '../../../src/components/account/MoveToCollectionModal.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/MoveToCollectionModal.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return {
        createTranslations: (_locale: string) => ({
            t: tFromCatalog,
            tPlural: (key: string, count: number) => `${count} ${key}`
        })
    };
});

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) => fallback ?? 'Error'
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../../src/components/shared/ui/Dialog.client', () => ({
    Dialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="presentation">{children}</div> : null,
    DialogHeader: ({ children, titleId }: { children: React.ReactNode; titleId: string }) => (
        <div id={titleId}>{children}</div>
    ),
    DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

/** New collection returned by the stubbed sub-modal's "save" click. */
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderModal(overrides: Partial<React.ComponentProps<typeof MoveToCollectionModal>> = {}) {
    return render(
        <MoveToCollectionModal
            isOpen
            onClose={vi.fn()}
            locale="es"
            bookmarkId="bm-1"
            currentCollectionId={null}
            collections={[]}
            {...overrides}
        />
    );
}

/** Opens the inline create sub-modal and clicks its stubbed save button. */
function triggerInlineCreate() {
    fireEvent.click(screen.getByText('+ Crear nueva colección'));
    fireEvent.click(screen.getByTestId('stub-create-save'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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
        const event = listener.mock.calls[0][0] as CustomEvent<{ id: string; name: string }>;
        expect(event.detail).toEqual(NEW_COLLECTION);

        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });

    it('still broadcasts when the follow-up move-into-collection call fails', async () => {
        // Arrange — the collection was created; only the move fails.
        addBookmarkMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Boom' }
        });
        const listener = vi.fn();
        window.addEventListener(COLLECTION_CREATED_EVENT, listener);
        renderModal();

        // Act
        triggerInlineCreate();

        // Assert
        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        expect(listener.mock.calls[0][0].detail).toEqual(NEW_COLLECTION);

        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });

    it('broadcasts before calling the move API, not after it resolves', async () => {
        // Arrange — resolve addBookmark only after we've had a chance to
        // observe the broadcast, proving ordering rather than just presence.
        let resolveMove: (value: { ok: true; data: Record<string, never> }) => void = () =>
            undefined;
        addBookmarkMock.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveMove = resolve;
                })
        );
        const listener = vi.fn();
        window.addEventListener(COLLECTION_CREATED_EVENT, listener);
        renderModal();

        // Act
        triggerInlineCreate();

        // Assert — broadcast already happened while the move is still pending.
        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        expect(addBookmarkMock).toHaveBeenCalledTimes(1);

        // Cleanup: resolve the pending move so React doesn't warn about an
        // update after the test finishes.
        resolveMove({ ok: true, data: {} });
        window.removeEventListener(COLLECTION_CREATED_EVENT, listener);
    });
});
