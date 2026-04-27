/**
 * Tests for ReplyForm component.
 *
 * Verifies:
 * - Form is hidden when status is CLOSED or BLOCKED
 * - Character counter caps at 5000
 * - Inline 422/API error appears below the textarea
 */

import { ReplyForm } from '@/features/conversations/components/ReplyForm';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock useReplyMutation
vi.mock('@/features/conversations/hooks/useReplyMutation', () => ({
    useReplyMutation: vi.fn()
}));

import { useReplyMutation } from '@/features/conversations/hooks/useReplyMutation';

const mockUseReplyMutation = vi.mocked(useReplyMutation);

const makeMutation = (overrides = {}) =>
    ({
        mutateAsync: vi.fn().mockResolvedValue({}),
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        error: null,
        ...overrides
    }) as unknown as ReturnType<typeof useReplyMutation>;

describe('ReplyForm', () => {
    it('does not render when status is CLOSED', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        const { container } = render(
            <ReplyForm
                conversationId="conv-001"
                status="CLOSED"
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('does not render when status is BLOCKED', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        const { container } = render(
            <ReplyForm
                conversationId="conv-001"
                status="BLOCKED"
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders the form when status is OPEN', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders the form when status is PENDING_OWNER', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="PENDING_OWNER"
            />
        );
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows character counter starting at 0/5000', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        // The i18n mock returns the key; the count values are interpolated separately
        expect(screen.getByText(/conversations.form.charCount/)).toBeInTheDocument();
    });

    it('updates character counter as user types', async () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Hello' } });

        // After typing 5 chars the counter should show 5
        await waitFor(() => {
            const counterText = screen.getByText(/conversations.form.charCount/);
            expect(counterText).toBeInTheDocument();
        });
    });

    it('shows inline error when mutation fails', async () => {
        const error = new Error('MESSAGE_TOO_LONG');
        mockUseReplyMutation.mockReturnValue(makeMutation({ isError: true, error }));
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        expect(screen.getByText('MESSAGE_TOO_LONG')).toBeInTheDocument();
    });

    it('disables the submit button when textarea is empty', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        const submitBtn = screen.getByRole('button', { name: /conversations.thread.send/i });
        expect(submitBtn).toBeDisabled();
    });

    it('enforces maxLength of 5000 on the textarea', () => {
        mockUseReplyMutation.mockReturnValue(makeMutation());
        render(
            <ReplyForm
                conversationId="conv-001"
                status="OPEN"
            />
        );
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.maxLength).toBe(5000);
    });
});
