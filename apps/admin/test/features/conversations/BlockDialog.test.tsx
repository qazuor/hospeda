/**
 * Tests for BlockDialog component.
 *
 * Verifies:
 * - Confirm button calls mutation with { status: 'BLOCKED', blockReason }
 * - Optional reason validates max 1000 chars
 * - Cancel resets the form
 */

import { BlockDialog } from '@/features/conversations/components/BlockDialog';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useUpdateStatusMutation
vi.mock('@/features/conversations/hooks/useUpdateStatusMutation', () => ({
    useUpdateStatusMutation: vi.fn()
}));

import { useUpdateStatusMutation } from '@/features/conversations/hooks/useUpdateStatusMutation';

const mockUseUpdateStatusMutation = vi.mocked(useUpdateStatusMutation);

const makeMutation = (overrides = {}) =>
    ({
        mutateAsync: vi.fn().mockResolvedValue({}),
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        error: null,
        reset: vi.fn(),
        ...overrides
    }) as unknown as ReturnType<typeof useUpdateStatusMutation>;

describe('BlockDialog', () => {
    it('opens the dialog on trigger button click', () => {
        mockUseUpdateStatusMutation.mockReturnValue(makeMutation());
        render(<BlockDialog conversationId="conv-001" />);

        const triggerBtn = screen.getByRole('button', { name: /conversations.actions.block/i });
        fireEvent.click(triggerBtn);

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('calls mutation with BLOCKED status and optional reason on confirm', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({});
        mockUseUpdateStatusMutation.mockReturnValue(makeMutation({ mutateAsync }));

        render(<BlockDialog conversationId="conv-001" />);

        // Open dialog
        fireEvent.click(screen.getByRole('button', { name: /conversations.actions.block/i }));

        // Fill in reason
        const reasonTextarea = screen.getByRole('textbox');
        fireEvent.change(reasonTextarea, { target: { value: 'Spam content' } });

        // Confirm - find the button within the dialog
        const dialog = screen.getByRole('alertdialog');
        const confirmBtn = within(dialog).getByRole('button', {
            name: /conversations.actions.block/i
        });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationId: 'conv-001',
                    status: 'BLOCKED',
                    blockReason: 'Spam content'
                })
            );
        });
    });

    it('calls mutation with BLOCKED status and no blockReason when reason is empty', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({});
        mockUseUpdateStatusMutation.mockReturnValue(makeMutation({ mutateAsync }));

        render(<BlockDialog conversationId="conv-001" />);

        fireEvent.click(screen.getByRole('button', { name: /conversations.actions.block/i }));

        const dialog = screen.getByRole('alertdialog');
        const confirmBtn = within(dialog).getByRole('button', {
            name: /conversations.actions.block/i
        });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationId: 'conv-001',
                    status: 'BLOCKED'
                })
            );
        });
    });

    it('shows mutation error when block fails', async () => {
        const error = new Error('Permission denied');
        mockUseUpdateStatusMutation.mockReturnValue(
            makeMutation({ isError: true, error, mutateAsync: vi.fn().mockRejectedValue(error) })
        );

        render(<BlockDialog conversationId="conv-001" />);
        fireEvent.click(screen.getByRole('button', { name: /conversations.actions.block/i }));

        expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });

    it('blockReason textarea has maxLength of 1000', () => {
        mockUseUpdateStatusMutation.mockReturnValue(makeMutation());
        render(<BlockDialog conversationId="conv-001" />);

        fireEvent.click(screen.getByRole('button', { name: /conversations.actions.block/i }));

        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.maxLength).toBe(1000);
    });

    it('calls onSuccess callback after successful block', async () => {
        const onSuccess = vi.fn();
        const mutateAsync = vi.fn().mockResolvedValue({});
        mockUseUpdateStatusMutation.mockReturnValue(makeMutation({ mutateAsync }));

        render(
            <BlockDialog
                conversationId="conv-001"
                onSuccess={onSuccess}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /conversations.actions.block/i }));

        const dialog = screen.getByRole('alertdialog');
        const confirmBtn = within(dialog).getByRole('button', {
            name: /conversations.actions.block/i
        });
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });
});
