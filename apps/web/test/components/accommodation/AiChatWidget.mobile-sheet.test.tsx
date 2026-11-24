/**
 * @file AiChatWidget.mobile-sheet.test.tsx
 * @description Below the mobile breakpoint the chat opens in the shared
 * `Dialog` bottom sheet (like the listing contact panel); on desktop the
 * original fixed panel is unchanged (HOS-2520 smoke item 12).
 *
 * @module test/components/accommodation/AiChatWidget.mobile-sheet
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function setViewport({ mobile }: { readonly mobile: boolean }): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches: mobile && query.includes('max-width: 767px'),
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false
            }) as MediaQueryList
    );
}

async function openChat() {
    mockUseAccommodationChat.mockReturnValue(idleChatState);
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    render(
        <AiChatWidget
            entityType="accommodation"
            entityId="550e8400-e29b-41d4-a716-446655440000"
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ask AI about this accommodation' }));
    return { user, dialog: await screen.findByRole('dialog') };
}

describe('AiChatWidget mobile sheet (HOS-2520)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('opens inside the shared Dialog sheet variant on mobile', async () => {
        setViewport({ mobile: true });
        const { dialog } = await openChat();

        expect(dialog.getAttribute('data-variant')).toBe('sheet');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-label')).toBe('AI Chat — Accommodation Questions');
        expect(screen.getByPlaceholderText('Type your question here…')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Expand panel' })).toBeNull();
    });

    it('closes the sheet with Escape and returns focus to the FAB', async () => {
        setViewport({ mobile: true });
        const { user } = await openChat();

        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Ask AI about this accommodation' })
            )
        );
    });

    it('closes the sheet from its header close button', async () => {
        setViewport({ mobile: true });
        const { user } = await openChat();

        await user.click(screen.getByRole('button', { name: 'Close chat' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('keeps the original fixed panel on desktop', async () => {
        setViewport({ mobile: false });
        const { dialog } = await openChat();

        expect(dialog.getAttribute('data-variant')).toBeNull();
        expect(dialog.className).toContain('panel');
        expect(screen.getByRole('button', { name: 'Expand panel' })).toBeTruthy();
    });
});
