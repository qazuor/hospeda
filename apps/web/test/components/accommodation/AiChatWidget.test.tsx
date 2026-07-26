/**
 * @file AiChatWidget.test.tsx
 * @description Component tests for the AI chat widget (SPEC-200 REQ-200-5, REQ-200-9).
 *
 * Tests FAB rendering, panel open/close, a11y attributes, ESC close,
 * focus-return-to-FAB (FIX-2), expand/collapse aria-labels (FIX-4),
 * conditional send-button aria-label during streaming (FIX-4),
 * and composer textarea autofocus on open (W14).
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatWidget } from '../../../src/components/accommodation/AiChatWidget';

// --- Mocks ---

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => {
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
                'accommodations.aiChat.thinking': 'Thinking…',
                'accommodations.aiChat.errorDefault':
                    'Could not display the response. Please try again.',
                'accommodations.aiChat.atCapMessage': "You've reached the conversation limit.",
                'accommodations.aiChat.newConversation': 'New conversation',
                'accommodations.aiChat.close': 'Close chat',
                'accommodations.aiChat.expand': 'Expand panel',
                'accommodations.aiChat.collapse': 'Collapse panel',
                // The API sends these two as i18n KEYS in `error.message`, and
                // they are the pair that must stay distinguishable: both arrive
                // under the same `LIMIT_REACHED` code.
                'accommodations.aiChat.unavailable':
                    'AI chat is not available for this accommodation',
                'accommodations.aiChat.consumerLimitReached':
                    'You reached your monthly AI chat limit. Upgrade for more access.'
            };
            return map[key] ?? fallback ?? key;
        }
    })
}));

vi.mock('@/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/accommodation/AiChatWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
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
        errorCode: null,
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

    // ─── T-009: send button shows Spinner, no emoji while streaming ──────────

    it('T-009: send button shows Spinner (not emoji) while streaming', async () => {
        // Arrange: streaming state
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                status: 'streaming' as const,
                currentAssistantContent: 'Hello'
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        // No literal emoji text in the send button area
        expect(document.body.textContent).not.toContain('⏳');

        // The send button should be present (disabled, aria-label 'Sending…')
        const sendBtn = screen.getByRole('button', { name: 'Sending…' });
        expect(sendBtn).toBeDisabled();
    });

    it('T-009: send button shows arrow icon when idle (not streaming)', async () => {
        // Arrange: idle state
        mockUseAccommodationChat.mockReturnValue(idleChatState);

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        // Arrow icon text should be present
        const sendBtn = screen.getByRole('button', { name: 'Send' });
        expect(sendBtn).toBeInTheDocument();
        expect(sendBtn.textContent).toContain('↑');
    });

    it('T-009: shows thinking indicator when streaming with no assistant content yet', async () => {
        // Arrange: streaming but no currentAssistantContent → showThinking = true
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                status: 'streaming' as const,
                currentAssistantContent: ''
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        // The thinking indicator <output> has aria-label with the i18n text
        const thinkingEl = document.querySelector('output[aria-label="Thinking…"]');
        expect(thinkingEl).not.toBeNull();
        expect(thinkingEl?.textContent).toContain('Thinking…');
    });

    it('T-009: thinking indicator is hidden once assistant content arrives', async () => {
        // Arrange: streaming WITH content — showThinking should be false
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                status: 'streaming' as const,
                currentAssistantContent: 'Here is my answer…'
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        const thinkingEl = document.querySelector('output[aria-label="Thinking…"]');
        expect(thinkingEl).toBeNull();
    });

    // ─── Assistant markdown rendering (bug fix) ──────────────────────────────
    //
    // Regression coverage: assistant replies used to render as a plain React
    // text child, so markdown markers (**bold**) showed up literally instead
    // of being interpreted. Mirrors the equivalent SearchChatPanel coverage.

    it('renders markdown emphasis in a completed assistant message as HTML, not literal asterisks', async () => {
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                messages: [{ role: 'assistant', content: 'Tiene **wifi gratis** y pileta.' }]
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        const bubble = document.querySelector('.assistantBubble');
        expect(bubble?.innerHTML).toContain('<strong>wifi gratis</strong>');
        expect(bubble?.textContent).not.toContain('**');
    });

    it('does NOT render markdown for a user message (kept as plain text)', async () => {
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                messages: [{ role: 'user', content: 'tiene **wifi**?' }]
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        expect(screen.getByText('tiene **wifi**?')).toBeInTheDocument();
    });

    it('renders markdown emphasis in the live-streamed assistant content as HTML', async () => {
        mockUseAccommodationChat.mockReturnValue({
            ...idleChatState,
            state: {
                ...idleChatState.state,
                status: 'streaming' as const,
                currentAssistantContent: 'Sí, tiene **pileta climatizada**'
            }
        });

        const user = userEvent.setup();
        render(<AiChatWidget {...defaultProps} />);
        await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));

        const bubble = document.querySelector('.streaming');
        expect(bubble?.innerHTML).toContain('<strong>pileta climatizada</strong>');
    });

    describe('error copy (HOS-292)', () => {
        /** Opens the panel with the chat hook parked in a given error state. */
        async function renderWithError(error: {
            readonly errorCode: string | null;
            readonly errorMessage: string | null;
        }) {
            mockUseAccommodationChat.mockReturnValue({
                ...idleChatState,
                state: { ...idleChatState.state, status: 'error' as const, ...error }
            });
            const user = userEvent.setup();
            render(<AiChatWidget {...defaultProps} />);
            await user.click(
                screen.getByRole('button', { name: 'Ask AI about this accommodation' })
            );
        }

        it('never shows a raw i18n key — the bug as reported in prod', async () => {
            // SMOKE-23-07 produced a red bubble reading literally
            // "accommodations.aiChat.unavailable". The API sends the key as the
            // message, and `t()` returns the key verbatim for a miss in
            // production, so rendering either one unresolved shows this.
            await renderWithError({
                errorCode: 'ENTITLEMENT_REQUIRED',
                errorMessage: 'accommodations.aiChat.unavailable'
            });

            expect(screen.queryByText(/accommodations\.aiChat\./)).not.toBeInTheDocument();
            expect(
                screen.getByText('AI chat is not available for this accommodation')
            ).toBeInTheDocument();
        });

        it('keeps the consumer quota message distinct from the owner-side one', async () => {
            // Both arrive as LIMIT_REACHED; only the message tells them apart,
            // and only the consumer one is actionable by the person reading it.
            await renderWithError({
                errorCode: 'LIMIT_REACHED',
                errorMessage: 'accommodations.aiChat.consumerLimitReached'
            });

            expect(
                screen.getByText('You reached your monthly AI chat limit. Upgrade for more access.')
            ).toBeInTheDocument();
        });

        it('falls back to localized copy for the code when the message is API prose', async () => {
            // The owner-side quota path sends Spanish prose rather than a key,
            // which must not be shown verbatim to an English reader.
            await renderWithError({
                errorCode: 'LIMIT_REACHED',
                errorMessage: 'El propietario ha alcanzado el límite mensual de chats de IA.'
            });

            expect(screen.queryByText(/El propietario/)).not.toBeInTheDocument();
            expect(
                screen.getByText(
                    'El chat de IA no está disponible para este alojamiento en este momento.'
                )
            ).toBeInTheDocument();
        });

        it('shows the generic message when there is nothing to resolve', async () => {
            await renderWithError({ errorCode: null, errorMessage: null });

            expect(
                screen.getByText('Could not display the response. Please try again.')
            ).toBeInTheDocument();
        });

        it('shows network copy when the transport failed', async () => {
            await renderWithError({
                errorCode: 'NETWORK_INTERRUPTED',
                errorMessage: 'HTTP 502'
            });

            expect(screen.queryByText('HTTP 502')).not.toBeInTheDocument();
            expect(screen.getByText('Se cortó la conexión. Reintentá.')).toBeInTheDocument();
        });
    });

    describe('mobile keyboard (HOS-309)', () => {
        const LAYOUT_HEIGHT = 844;
        let viewport: {
            height: number;
            offsetTop: number;
            addEventListener: (t: string, f: () => void) => void;
            removeEventListener: (t: string, f: () => void) => void;
        };
        let resizeListeners: Array<() => void>;
        /** Restored in afterEach so a stubbed viewport cannot outlive its test. */
        let originalInnerHeight: PropertyDescriptor | undefined;

        beforeEach(() => {
            originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
            resizeListeners = [];
            viewport = {
                height: LAYOUT_HEIGHT,
                offsetTop: 0,
                addEventListener: (type, fn) => {
                    if (type === 'resize') resizeListeners.push(fn);
                },
                removeEventListener: () => undefined
            };
            Object.defineProperty(window, 'visualViewport', {
                configurable: true,
                value: viewport
            });
            Object.defineProperty(window, 'innerHeight', {
                configurable: true,
                value: LAYOUT_HEIGHT
            });
        });

        afterEach(() => {
            Reflect.deleteProperty(window, 'visualViewport');
            if (originalInnerHeight) {
                Object.defineProperty(window, 'innerHeight', originalInnerHeight);
            } else {
                Reflect.deleteProperty(window, 'innerHeight');
            }
        });

        async function openPanel() {
            const user = userEvent.setup();
            render(<AiChatWidget {...defaultProps} />);
            await user.click(
                screen.getByRole('button', { name: 'Ask AI about this accommodation' })
            );
            return screen.getByRole('dialog');
        }

        it('sizes itself to the visible viewport, not the layout one', async () => {
            const panel = await openPanel();

            expect(panel.style.getPropertyValue('--chat-visible-height')).toBe('844px');
            expect(panel.style.getPropertyValue('--chat-keyboard-inset')).toBe('0px');
            expect(panel).not.toHaveAttribute('data-keyboard-open');
        });

        it('lifts clear of the keyboard when it opens', async () => {
            const panel = await openPanel();

            await act(async () => {
                viewport.height = LAYOUT_HEIGHT - 336;
                for (const fn of resizeListeners) fn();
            });

            // The layout viewport is still 844 here, which is why `100vh` left
            // the composer buried under the keyboard.
            expect(panel.style.getPropertyValue('--chat-keyboard-inset')).toBe('336px');
            expect(panel.style.getPropertyValue('--chat-visible-height')).toBe('508px');
            expect(panel).toHaveAttribute('data-keyboard-open', 'true');
        });

        it('treats a small inset as browser chrome rather than a keyboard', async () => {
            const panel = await openPanel();

            await act(async () => {
                viewport.height = LAYOUT_HEIGHT - 60;
                for (const fn of resizeListeners) fn();
            });

            // A collapsing toolbar must not make the panel jump up.
            expect(panel).not.toHaveAttribute('data-keyboard-open');
            expect(panel.style.getPropertyValue('--chat-keyboard-inset')).toBe('60px');
        });

        it('falls back cleanly when the browser has no visualViewport', async () => {
            Reflect.deleteProperty(window, 'visualViewport');

            const panel = await openPanel();

            // No inline height at all, so the stylesheet's `100dvh` applies.
            expect(panel.style.getPropertyValue('--chat-visible-height')).toBe('');
            expect(panel.style.getPropertyValue('--chat-keyboard-inset')).toBe('0px');
        });
    });
});
