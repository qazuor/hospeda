/**
 * @file CollectionDetailActions.test.tsx
 * @description Tests for the CollectionDetailActions React island (SPEC-228 T-019).
 *
 * Covers:
 * - Edit button renders
 * - Delete button renders with static label when idle
 * - Delete button uses LoadingButton — shows loading label while deleting
 * - No ⏳ emoji in any state
 * - aria-label changes to deletingLabel during delete
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionDetailActions } from '../../../src/components/account/CollectionDetailActions.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/CollectionDetailActions.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => ({
    createT: (_locale: string) => (key: string, fallback?: string) => fallback ?? key
}));

/**
 * HOS-957: the delete asks through the product-styled `showConfirmationDialog()`
 * instead of `window.confirm()`. Mocked rather than rendered — the dialog's own
 * behaviour belongs to `show-confirmation-dialog.test.tsx`.
 *
 * Mocking it makes the DEFAULT answer "confirmed", which is exactly what makes
 * the gate below invisible if nobody asserts it: with every test answering
 * `true`, deleting the `if (!confirmed) return` in the component changes no
 * observable behaviour and the whole suite stays green. Whatever else moves in
 * here, the "cancel blocks the delete" test has to stay.
 */
const showConfirmationDialogMock = vi.fn(async () => true);

vi.mock('@/lib/forms/show-confirmation-dialog', () => ({
    showConfirmationDialog: (...args: readonly unknown[]) => showConfirmationDialogMock(...args)
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

vi.mock('../../../src/components/account/CreateEditCollectionModal.client', () => ({
    CreateEditCollectionModal: () => null
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userBookmarkCollectionsApi: {
        delete: vi.fn()
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const COLLECTION = {
    id: 'col-1',
    name: 'Viajes soñados',
    description: null,
    color: '#4f46e5',
    icon: null
};

function renderActions() {
    return render(
        <CollectionDetailActions
            collection={COLLECTION}
            locale="es"
            lang="es"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectionDetailActions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // `clearAllMocks` wipes the implementation too, so re-arm the default
        // answer: confirmed.
        showConfirmationDialogMock.mockResolvedValue(true);
    });

    it('renders the Edit button', () => {
        renderActions();
        expect(screen.getByTestId('collection-actions-edit')).toBeInTheDocument();
        expect(screen.getByTestId('collection-actions-edit')).toHaveTextContent('Editar');
    });

    it('renders the Delete button with static label when idle', () => {
        renderActions();
        const deleteBtn = screen.getByTestId('collection-actions-delete');
        expect(deleteBtn).toBeInTheDocument();
        expect(deleteBtn).toHaveTextContent('Borrar');
        // Not loading
        expect(deleteBtn).not.toBeDisabled();
        expect(deleteBtn).toHaveAttribute('aria-busy', 'false');
    });

    it('does not render ⏳ emoji in any state', () => {
        renderActions();
        expect(document.body.textContent).not.toContain('⏳');
    });

    it('does NOT delete or navigate when the confirmation is cancelled (HOS-957)', async () => {
        const { userBookmarkCollectionsApi } = await import(
            '../../../src/lib/api/endpoints-protected'
        );
        showConfirmationDialogMock.mockResolvedValue(false);

        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));

        // The answer arrives on a microtask, so wait for it to have been ASKED
        // before asserting what did not happen — a bare synchronous expect here
        // passes even when the user confirms, simply because the handler has
        // not resumed yet.
        await waitFor(() => {
            expect(showConfirmationDialogMock).toHaveBeenCalledTimes(1);
        });

        expect(userBookmarkCollectionsApi.delete).not.toHaveBeenCalled();
        // Nor does the button pretend to be working on something.
        expect(screen.getByTestId('collection-actions-delete')).toHaveAttribute(
            'aria-busy',
            'false'
        );
        // The redirect is deliberately NOT asserted here. jsdom refuses
        // `location.href =` with "Not implemented: navigation" and leaves the
        // value untouched, so `expect(location.href).toBe(before)` passes just
        // as happily when the component DID try to navigate — a vacuous
        // assertion dressed as a strong one. The DELETE never firing is what
        // actually proves the gate held; the redirect is downstream of it.
    });

    it('deletes once the confirmation is accepted (HOS-957)', async () => {
        const { userBookmarkCollectionsApi } = await import(
            '../../../src/lib/api/endpoints-protected'
        );
        // Answered NOT-ok on purpose: the component then toasts and returns,
        // instead of reaching `location.href = …` — which jsdom cannot perform
        // and reports as an unhandled "Not implemented: navigation". The
        // request having been made is the assertion; the redirect after it is
        // not this test's subject.
        vi.mocked(userBookmarkCollectionsApi.delete).mockResolvedValue({
            ok: false,
            error: { code: 'BOOM', message: 'boom' }
        } as Awaited<ReturnType<typeof userBookmarkCollectionsApi.delete>>);

        renderActions();
        fireEvent.click(screen.getByTestId('collection-actions-delete'));

        // The other half of the gate: a cancel-blocks test alone is satisfied by
        // a component that never deletes at all.
        await waitFor(() => {
            expect(userBookmarkCollectionsApi.delete).toHaveBeenCalledWith({ id: 'col-1' });
        });
    });

    it('shows loading label and spinner while deleting (SPEC-228 T-019)', async () => {
        const { userBookmarkCollectionsApi } = await import(
            '../../../src/lib/api/endpoints-protected'
        );
        // Never resolves so we can inspect the loading state
        vi.mocked(userBookmarkCollectionsApi.delete).mockReturnValue(
            new Promise(() => undefined) as ReturnType<typeof userBookmarkCollectionsApi.delete>
        );

        renderActions();

        fireEvent.click(screen.getByTestId('collection-actions-delete'));

        await waitFor(() => {
            const deleteBtn = screen.getByTestId('collection-actions-delete');
            // Button is disabled while loading
            expect(deleteBtn).toBeDisabled();
            expect(deleteBtn).toHaveAttribute('aria-busy', 'true');
            // Label changes to deleting label
            expect(deleteBtn).toHaveAttribute('aria-label', 'Borrando...');
            // Loading text visible
            expect(deleteBtn).toHaveTextContent('Borrando...');
        });
    });

    it('delete button is idle and label is "Borrar colección" when not deleting', () => {
        renderActions();
        const deleteBtn = screen.getByTestId('collection-actions-delete');
        expect(deleteBtn).toHaveAttribute('aria-label', 'Borrar colección');
    });
});
