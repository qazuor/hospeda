/**
 * @file AiChatWidget.test.tsx
 * @description Component tests for the AI chat widget (SPEC-200 REQ-200-5, REQ-200-9).
 *
 * Tests FAB rendering, panel open/close, a11y attributes, ESC close,
 * and various chat states.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AiChatWidget } from '../../../src/components/accommodation/AiChatWidget';

// --- Mocks ---

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'accommodations.aiChat.fabLabel': 'Ask AI about this accommodation',
                'accommodations.aiChat.panelLabel': 'AI Chat — Accommodation Questions',
                'accommodations.aiChat.headerDisclaimer':
                    'Responses are AI-generated and may contain errors.',
                'accommodations.aiChat.priceDisclaimer':
                    'Prices and availability may have changed.',
                'accommodations.aiChat.placeholder': 'Type your question here…',
                'accommodations.aiChat.send': 'Send',
                'accommodations.aiChat.sending': 'Sending…',
                'accommodations.aiChat.errorDefault':
                    'Could not display the response. Please try again.',
                'accommodations.aiChat.atCapMessage': "You've reached the conversation limit.",
                'accommodations.aiChat.newConversation': 'New conversation',
                'accommodations.aiChat.close': 'Close chat'
            };
            return map[key] ?? key;
        }
    })
}));

vi.mock('@/hooks/useAccommodationChat', () => ({
    useAccommodationChat: () => ({
        state: {
            messages: [],
            currentAssistantContent: '',
            hasPartialContent: false,
            conversationId: null,
            status: 'idle',
            errorMessage: null,
            showPriceDisclaimer: false
        },
        send: vi.fn(),
        abort: vi.fn(),
        reset: vi.fn()
    })
}));

// --- Tests ---

describe('AiChatWidget', () => {
    const defaultProps = {
        accommodationId: '550e8400-e29b-41d4-a716-446655440000',
        locale: 'es' as const,
        apiUrl: 'http://localhost:3001'
    };

    it('renders the FAB button with correct aria-label', () => {
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });
        expect(fab).toBeInTheDocument();
    });

    it('opens the panel when FAB is clicked', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });
        await user.click(fab);

        // Panel should be visible with role="dialog"
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('panel has aria-label from i18n', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-label', 'AI Chat — Accommodation Questions');
    });

    it('displays the header disclaimer when panel is open', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        expect(
            screen.getByText('Responses are AI-generated and may contain errors.')
        ).toBeInTheDocument();
    });

    it('closes the panel when ESC is pressed', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the textarea with placeholder', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        const textarea = screen.getByPlaceholderText('Type your question here…');
        expect(textarea).toBeInTheDocument();
    });

    it('FAB is hidden when panel is open', async () => {
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        // FAB should not be in the document when panel is open
        expect(
            screen.queryByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        ).not.toBeInTheDocument();
    });
});
