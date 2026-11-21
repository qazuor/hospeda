/**
 * @file leave-warning-kit-dialog.test.tsx
 * @description The leave warning (unsaved changes) now asks its question through
 * the kit `ConfirmDialog` (HOS-2413, owner decision on `showConfirmationDialog`).
 * These tests run the REAL registry and the REAL dialog and pin that both
 * answers still reach the caller: confirm resolves true, cancel resolves false.
 */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
    __resetLeaveWarningRegistry,
    registerLeaveWarning,
    requestLeaveWarning
} from '@/lib/forms/leave-warning-registry';

const COPY = {
    title: 'Cambios sin guardar',
    message: 'Si salís ahora, se pierden.',
    confirmLabel: 'Salir y descartar',
    cancelLabel: 'Seguir editando'
} as const;

afterEach(async () => {
    __resetLeaveWarningRegistry();
    try {
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    } finally {
        document.body.innerHTML = '';
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }
});

describe('leave warning through the kit ConfirmDialog', () => {
    it('resolves true when the user confirms leaving', async () => {
        // Arrange
        let confirmed = false;
        registerLeaveWarning({
            kind: 'unsaved-changes',
            copy: COPY,
            onConfirm: () => {
                confirmed = true;
            }
        });
        // Act
        const answer = requestLeaveWarning('unsaved-changes');
        const dialog = await screen.findByRole('alertdialog', { name: COPY.title });
        expect(dialog).toHaveTextContent(COPY.message);
        fireEvent.click(screen.getByRole('button', { name: COPY.confirmLabel }));
        // Assert
        await expect(answer).resolves.toBe(true);
        expect(confirmed).toBe(true);
    });

    it('resolves false when the user chooses to keep editing, and focuses Cancel first', async () => {
        registerLeaveWarning({ kind: 'unsaved-changes', copy: COPY });
        const answer = requestLeaveWarning('unsaved-changes');
        await screen.findByRole('alertdialog');
        await waitFor(() =>
            expect(screen.getByRole('button', { name: COPY.cancelLabel })).toHaveFocus()
        );
        fireEvent.click(screen.getByRole('button', { name: COPY.cancelLabel }));
        await expect(answer).resolves.toBe(false);
    });

    it('resolves false on Escape', async () => {
        registerLeaveWarning({ kind: 'unsaved-changes', copy: COPY });
        const answer = requestLeaveWarning('unsaved-changes');
        await screen.findByRole('alertdialog');
        await waitFor(() => expect(document.documentElement.style.overflow).toBe('hidden'));
        fireEvent.keyDown(document, { key: 'Escape' });
        await expect(answer).resolves.toBe(false);
    });
});
