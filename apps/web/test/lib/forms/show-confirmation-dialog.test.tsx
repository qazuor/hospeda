/**
 * @file show-confirmation-dialog.test.tsx
 * @description Coverage for the imperative confirmation dialog (HOS-783 B8).
 *
 * The helper shipped with none: its only test mocked the whole module from the
 * consumer side, so nothing exercised the real dialog. These tests render it for
 * real and pin the three properties that are invisible from the consumer —
 * the history opt-out, the deferred teardown, and the mount fallback.
 *
 * @module test/lib/forms/show-confirmation-dialog
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acquireDialogHistoryEntry = vi.fn(() => ({ release: () => undefined }));

// PARTIAL mock. `dialog-history` carries module-level listeners and several
// other exports; replacing the whole module would leave them `undefined` for
// anything that reaches for them.
vi.mock('@/lib/dialog-history', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/dialog-history')>();
    return {
        ...actual,
        acquireDialogHistoryEntry: (params: unknown) => acquireDialogHistoryEntry(params as never)
    };
});

import { showConfirmationDialog } from '@/lib/forms/show-confirmation-dialog';

const COPY = {
    message: 'Tenés cambios sin guardar.',
    title: 'Cambios sin guardar',
    confirmLabel: 'Sí, descartar',
    cancelLabel: 'Seguir editando'
} as const;

/**
 * Opens the dialog and waits for the throwaway root to paint it.
 *
 * The pending answer is returned WRAPPED. An async function that returns a
 * promise flattens it, so handing `Promise<boolean>` back directly would make
 * `await openDialog()` wait on the user's answer instead of on the paint.
 *
 * @returns The still-pending answer, boxed.
 */
async function openDialog(): Promise<{ readonly answer: Promise<boolean> }> {
    const answer = showConfirmationDialog(COPY);
    await screen.findByRole('dialog');
    return { answer };
}

describe('showConfirmationDialog', () => {
    beforeEach(() => {
        acquireDialogHistoryEntry.mockClear();
    });

    afterEach(() => {
        // The helper owns throwaway roots outside React Testing Library's
        // registry, so its auto-cleanup does not reach them. A test that leaves
        // a dialog open would otherwise make every later `getByRole('dialog')`
        // ambiguous.
        document.body.innerHTML = '';
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    });

    it('renders a real, labelled dialog with both actions', async () => {
        // Arrange / Act
        const { answer } = await openDialog();

        // Assert
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleName(COPY.title);
        expect(screen.getByText(COPY.message)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: COPY.confirmLabel })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: COPY.cancelLabel })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: COPY.cancelLabel }));
        await answer;
    });

    it('resolves true when the destructive action is pressed', async () => {
        // Arrange
        const { answer } = await openDialog();

        // Act
        fireEvent.click(screen.getByRole('button', { name: COPY.confirmLabel }));

        // Assert
        await expect(answer).resolves.toBe(true);
    });

    it('resolves false when the dismissing action is pressed', async () => {
        // Arrange
        const { answer } = await openDialog();

        // Act
        fireEvent.click(screen.getByRole('button', { name: COPY.cancelLabel }));

        // Assert
        await expect(answer).resolves.toBe(false);
    });

    it('resolves false on Escape', async () => {
        // Arrange
        const { answer } = await openDialog();

        // Act
        fireEvent.keyDown(document, { key: 'Escape' });

        // Assert
        await expect(answer).resolves.toBe(false);
    });

    // The regression this file exists for. A claimed entry is released on
    // unmount, and that release schedules a `history.go(-1)` microtask that runs
    // BEFORE the caller's `.then()` — racing the router navigation the caller is
    // about to start. See `apps/web/docs/dialog-history.md`.
    it('never claims a history entry: it resolves into a navigation', async () => {
        // Arrange
        const { answer } = await openDialog();

        // Act
        fireEvent.click(screen.getByRole('button', { name: COPY.confirmLabel }));
        await answer;

        // Assert
        expect(acquireDialogHistoryEntry).not.toHaveBeenCalled();
    });

    // The consumer navigates the moment this resolves. Tearing down first would
    // run the dialog's effect cleanups — and, with a claimed entry, its history
    // unwind — ahead of that navigation.
    it('hands the answer to the caller before tearing the dialog down', async () => {
        // Arrange
        const { answer } = await openDialog();
        let dialogStillMounted: boolean | null = null;
        const observed = answer.then((value) => {
            dialogStillMounted = screen.queryByRole('dialog') !== null;
            return value;
        });

        // Act
        fireEvent.click(screen.getByRole('button', { name: COPY.confirmLabel }));
        await observed;

        // Assert
        expect(dialogStillMounted).toBe(true);
    });

    it('tears the dialog down and releases the scroll lock after answering', async () => {
        // Arrange
        const { answer } = await openDialog();
        expect(document.documentElement.style.overflow).toBe('hidden');

        // Act
        fireEvent.click(screen.getByRole('button', { name: COPY.confirmLabel }));
        await answer;

        // Assert
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        await waitFor(() => {
            expect(document.documentElement.style.overflow).not.toBe('hidden');
        });
    });

    it('resolves false when there is no DOM to render into', async () => {
        // Arrange
        const originalDocument = globalThis.document;
        Object.defineProperty(globalThis, 'document', {
            value: undefined,
            configurable: true
        });

        try {
            // Act / Assert
            await expect(showConfirmationDialog(COPY)).resolves.toBe(false);
        } finally {
            Object.defineProperty(globalThis, 'document', {
                value: originalDocument,
                configurable: true
            });
        }
    });
});

describe('showConfirmationDialog — mount failure', () => {
    afterEach(() => {
        vi.doUnmock('react-dom/client');
        vi.resetModules();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    // Without a fallback the promise never settles, `confirmationOpenRef` stays
    // true in `useUnsavedChangesGuard`, and every later link click is
    // preventDefault-ed and dropped in silence.
    it('degrades to the native confirm when the react-dom chunk never arrives', async () => {
        // Arrange
        vi.resetModules();
        vi.doMock('react-dom/client', () => {
            throw new Error('chunk load failed');
        });
        const confirmSpy = vi.fn(() => true);
        vi.stubGlobal('confirm', confirmSpy);

        const { showConfirmationDialog: subject } = await import(
            '@/lib/forms/show-confirmation-dialog'
        );

        // Act
        const answer = await subject(COPY);

        // Assert
        expect(confirmSpy).toHaveBeenCalledWith(COPY.message);
        expect(answer).toBe(true);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
