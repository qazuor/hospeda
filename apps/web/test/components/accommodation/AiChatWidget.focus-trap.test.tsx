/**
 * @file AiChatWidget.focus-trap.test.tsx
 * @description Regression tests for `AiChatWidget`'s focus trap (HOS-350).
 *
 * `AiChatWidget` used to carry its own private Tab-cycling loop, bound to the
 * PANEL element rather than `document`. That was worse than the
 * boundary-only bug the shared `@/lib/focus-trap` helper already fixed
 * elsewhere: once focus fell out to `<body>` (a disabled control, a tap on
 * non-focusable panel background), a panel-scoped `keydown` listener never
 * even runs, because `<body>` is not a descendant of the panel. Migrating to
 * the shared `trapFocus` (bound to `document`, like every other consumer)
 * fixes both defects at once.
 *
 * These assertions read `defaultPrevented` on a real cancelable
 * `KeyboardEvent` rather than watching `document.activeElement`: jsdom never
 * moves focus on Tab, so "focus stayed put" cannot tell an engaged trap from
 * a no-op.
 *
 * @module test/components/accommodation/AiChatWidget.focus-trap
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildAuthSnapshot } from '../../helpers/auth-session';

// ─── Module mocks (mirrors AiChatWidget.test.tsx) ──────────────────────────

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => {
            const map: Record<string, string> = {
                'accommodations.aiChat.fabLabel': 'Ask AI about this accommodation',
                'accommodations.aiChat.panelLabel': 'AI Chat — Accommodation Questions',
                'accommodations.aiChat.headerDisclaimer':
                    'Responses are AI-generated and may contain errors.',
                'accommodations.aiChat.placeholder': 'Type your question here…',
                'accommodations.aiChat.send': 'Send',
                'accommodations.aiChat.expand': 'Expand panel',
                'accommodations.aiChat.collapse': 'Collapse panel',
                'accommodations.aiChat.close': 'Close chat'
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

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

// Imported after the mocks so the module graph picks them up.
import { AiChatWidget } from '../../../src/components/accommodation/AiChatWidget';

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

/** Dispatches a real cancelable Tab keydown on `document`. */
function dispatchTab(options: { readonly shiftKey?: boolean } = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        shiftKey: options.shiftKey ?? false,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(event);
    return event;
}

async function renderOpenPanel() {
    mockUseAccommodationChat.mockReturnValue(idleChatState);
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    render(
        <AiChatWidget
            accommodationId="550e8400-e29b-41d4-a716-446655440000"
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));
    return screen.getByRole('dialog');
}

describe('AiChatWidget focus trap (HOS-350 — migrated to shared helper)', () => {
    it('prevents Tab and pulls focus back in when focus has escaped to <body>', async () => {
        const panel = await renderOpenPanel();

        // W14 focuses the composer textarea directly on open.
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

        // The state a disabled-on-click button or a tap on dead space leaves
        // behind. The old private copy did not react at all here — its
        // listener was bound to the panel, and <body> is outside it.
        (document.activeElement as HTMLElement).blur();
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(panel.contains(document.activeElement)).toBe(true);
    });

    it('wraps Tab from the last focusable (the composer, empty draft disables Send) back to the first', async () => {
        const panel = await renderOpenPanel();
        // W14 focuses the composer textarea on open. With an empty draft the
        // Send button is `disabled` (excluded from the focus ring), so the
        // textarea IS the last focusable — Tab from here must wrap, not leak
        // out to the page behind the panel.
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

        const expandButton = screen.getByRole('button', { name: 'Expand panel' });

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(expandButton);
    });
});
