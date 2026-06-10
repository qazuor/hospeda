/**
 * DeleteConfirmDialog tests — relocated from entity-form/fields to shared (SPEC-190, T-009).
 *
 * Covers:
 * 1. Dialog renders with title, description, cancel and confirm buttons.
 * 2. Cancel button calls onOpenChange(false).
 * 3. Confirm button calls onConfirm.
 * 4. Dialog is not visible when open=false.
 * 5. Import path resolves from new shared location.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';

const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete image?',
    description: 'This action cannot be undone.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete',
    onConfirm: vi.fn()
};

describe('DeleteConfirmDialog', () => {
    it('renders title, description, and buttons when open', () => {
        render(<DeleteConfirmDialog {...defaultProps} />);
        expect(screen.getByText('Delete image?')).toBeInTheDocument();
        expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('does not render when open=false', () => {
        render(
            <DeleteConfirmDialog
                {...defaultProps}
                open={false}
            />
        );
        expect(screen.queryByText('Delete image?')).not.toBeInTheDocument();
    });

    it('calls onOpenChange(false) when cancel is clicked', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
            <DeleteConfirmDialog
                {...defaultProps}
                onOpenChange={onOpenChange}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('calls onConfirm when confirm button is clicked', async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(
            <DeleteConfirmDialog
                {...defaultProps}
                onConfirm={onConfirm}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Delete' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('has testid for programmatic testing', () => {
        render(<DeleteConfirmDialog {...defaultProps} />);
        expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('delete-confirm-cancel')).toBeInTheDocument();
        expect(screen.getByTestId('delete-confirm-confirm')).toBeInTheDocument();
    });
});
