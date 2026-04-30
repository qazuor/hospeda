// @vitest-environment jsdom
/**
 * Tests for AdminTagDeleteDialog component.
 *
 * Covers:
 * - Dialog renders impact count from prop (D-011)
 * - Confirm button calls onConfirm
 * - Cancel button closes dialog without calling onConfirm
 * - isDeleting disables both buttons
 * - Tag name shown in confirmation message
 *
 * Note: Unlike PostTagDeleteDialog, AdminTagDeleteDialog receives impactCount as
 * a prop (the parent fetches it). This keeps the dialog pure and easier to test.
 *
 * References: AC-004-01, AC-004-02, AC-004-03, D-011
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTagDeleteDialog } from '../AdminTagDeleteDialog';

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const TAG_ID = '00000000-0000-0000-0000-000000000002';
const TAG_NAME = 'Urgente';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminTagDeleteDialog', () => {
    /**
     * D-011: Impact count is shown in the confirmation message.
     */
    it('shows the impact count in the confirmation message when loaded', () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={5}
                isLoadingImpact={false}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        expect(screen.getByTestId('impact-message')).toHaveTextContent('5');
    });

    /**
     * Shows loading spinner when isLoadingImpact is true.
     */
    it('shows a loading indicator while isLoadingImpact is true', () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={0}
                isLoadingImpact={true}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        expect(screen.getByText(/calculando impacto/i)).toBeInTheDocument();
        expect(screen.queryByTestId('impact-message')).not.toBeInTheDocument();
    });

    /**
     * Tag name appears in the dialog message.
     */
    it('displays the tag name in the confirmation message', () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName="Spam"
                tagType="INTERNAL"
                impactCount={3}
                isLoadingImpact={false}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        expect(screen.getByTestId('impact-message')).toHaveTextContent('Spam');
    });

    /**
     * Clicking confirm calls onConfirm.
     */
    it('calls onConfirm when the confirm button is clicked', async () => {
        const onConfirm = vi.fn();
        const user = userEvent.setup();

        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={2}
                isLoadingImpact={false}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        await user.click(screen.getByTestId('confirm-button'));

        expect(onConfirm).toHaveBeenCalledOnce();
    });

    /**
     * Clicking cancel calls onOpenChange(false) and NOT onConfirm.
     */
    it('calls onOpenChange(false) and NOT onConfirm when cancel is clicked', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const user = userEvent.setup();

        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={0}
                isLoadingImpact={false}
                open={true}
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        await user.click(screen.getByTestId('cancel-button'));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    /**
     * Confirm button is disabled while isDeleting.
     */
    it('disables the confirm button when isDeleting is true', async () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={1}
                isLoadingImpact={false}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={true}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('confirm-button')).toBeDisabled();
        });
    });

    /**
     * Cancel button is disabled while isDeleting.
     */
    it('disables the cancel button when isDeleting is true', async () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="INTERNAL"
                impactCount={0}
                isLoadingImpact={false}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={true}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('cancel-button')).toBeDisabled();
        });
    });

    /**
     * Confirm button is also disabled while isLoadingImpact (user shouldn't confirm mid-fetch).
     */
    it('disables the confirm button while isLoadingImpact is true', async () => {
        render(
            <AdminTagDeleteDialog
                tagId={TAG_ID}
                tagName={TAG_NAME}
                tagType="SYSTEM"
                impactCount={0}
                isLoadingImpact={true}
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                isDeleting={false}
                trigger={<button type="button">Eliminar</button>}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('confirm-button')).toBeDisabled();
        });
    });
});
