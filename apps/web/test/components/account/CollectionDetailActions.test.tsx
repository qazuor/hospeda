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
        // Reset window.confirm to return true by default
        vi.spyOn(window, 'confirm').mockReturnValue(true);
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
