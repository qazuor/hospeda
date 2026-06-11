/**
 * @file AiChatWidget.test.tsx
 * @description Component tests for the AI chat widget (SPEC-200 REQ-200-5, REQ-200-9).
 *
 * Tests FAB rendering, panel open/close, a11y attributes, ESC close,
 * focus-return-to-FAB (FIX-2), expand/collapse aria-labels (FIX-4),
 * conditional send-button aria-label during streaming (FIX-4),
 * and composer textarea autofocus on open (W14).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
                'accommodations.aiChat.close': 'Close chat',
                'accommodations.aiChat.expand': 'Expand panel',
                'accommodations.aiChat.collapse': 'Collapse panel'
            };
            return map[key] ?? key;
        }
    })
}));

const mockUseAccommodationChat = vi.fn();

vi.mock('@/hooks/useAccommodationChat', () => ({
    useAccommodationChat: (...args: unknown[]) => mockUseAccommodationChat(...args)
}));

/** Default idle state returned by most tests. */
const idleChatState = {
    state: {
        messages: [],
        currentAssistantContent: '',
        hasPartialContent: false,
        conversationId: null,
        status: 'idle' as const,
        errorMessage: null,
        showPriceDisclaimer: false
    },
    send: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn()
};

// --- Tests ---

describe('AiChatWidget', () => {
    const defaultProps = {
        accommodationId: '550e8400-e29b-41d4-a716-446655440000',
        locale: 'es' as const,
        apiUrl: 'http://localhost:3001'
    };

    beforeEach(() => {
        mockUseAccommodationChat.mockReturnValue(idleChatState);
    });

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

    it('does NOT steal focus to the FAB on initial mount (no-steal guard)', () => {
        // Arrange + Act: just render — do NOT interact with the widget
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });

        // Assert: focus must NOT be on the FAB immediately after mount.
        // If the focus-return effect fired on initial render it would have called
        // fabRef.current?.focus(), making the FAB the active element.
        expect(document.activeElement).not.toBe(fab);
    });

    it('returns focus to FAB button after a real open→close transition (FIX-2 a11y)', async () => {
        // Arrange: open the panel, then close it via ESC
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });

        // Precondition: focus is not on the FAB before we do anything
        expect(document.activeElement).not.toBe(fab);

        // Act: open the dialog
        await user.click(fab);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Act: close via ESC (triggers the open→close transition)
        await user.keyboard('{Escape}');

        // Assert: dialog is gone …
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        // … and the FAB has received focus (WCAG dialog focus-return pattern).
        const fabAfterClose = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });
        expect(document.activeElement).toBe(fabAfterClose);
    });

    it('expand button uses i18n aria-label (FIX-4)', async () => {
        // Arrange: open the panel
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        // Assert: expand button has the i18n-driven label (not hardcoded Spanish)
        const expandBtn = screen.getByRole('button', { name: 'Expand panel' });
        expect(expandBtn).toBeInTheDocument();

        // Act: click to expand
        await user.click(expandBtn);

        // Assert: label switches to collapse
        expect(screen.getByRole('button', { name: 'Collapse panel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Expand panel' })).not.toBeInTheDocument();
    });

    it('send button aria-label is "Sending…" while streaming and "Send" otherwise (FIX-4)', async () => {
        // Arrange: render with streaming state
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                status: 'streaming' as const
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        await user.click(
            screen.getByRole('button', {
                name: 'Ask AI about this accommodation'
            })
        );

        // Assert: send button aria-label reflects streaming state
        const sendBtn = screen.getByRole('button', { name: 'Sending…' });
        expect(sendBtn).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    });

    // ─── W14: Autofocus composer textarea on open ────────────────────────────

    it('W14: composer textarea receives focus (not the expand button) when panel opens', async () => {
        // This is the core W14 fix: previously focusables[0] (the expand button)
        // received focus. Now the composerTextareaRef targets the textarea directly
        // with a synchronous focus call inside the useEffect.
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });

        await user.click(fab);

        const textarea = screen.getByPlaceholderText('Type your question here…');
        expect(document.activeElement).toBe(textarea);
    });

    it('W14: focus-return-to-FAB still works after textarea-focused open→close', async () => {
        // Verify that fixing the initial focus (textarea, not expand button)
        // does not break the existing WCAG focus-return-to-FAB behavior.
        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);

        const fab = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });

        await user.click(fab);
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        const fabAfterClose = screen.getByRole('button', {
            name: 'Ask AI about this accommodation'
        });
        expect(document.activeElement).toBe(fabAfterClose);
    });
});
