import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatWidget } from '../../../src/components/accommodation/AiChatWidget';
import { buildAuthSnapshot } from '../../helpers/auth-session';

const CSS_SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/AiChatFab.module.css'),
    'utf8'
);

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) =>
            ({
                'accommodations.aiChat.fabLabel': 'Ask AI about this accommodation',
                'accommodations.aiChat.panelLabel': 'AI Chat — Accommodation Questions',
                'accommodations.aiChat.close': 'Close chat'
            })[key] ??
            fallback ??
            key
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
            errorCode: null,
            showPriceDisclaimer: false
        },
        send: vi.fn(),
        abort: vi.fn(),
        reset: vi.fn()
    })
}));
vi.mock('@/hooks/useDialogHistoryBack', () => ({
    useDialogHistoryBack: () => ({ isTopmost: true })
}));
vi.mock('@/hooks/useVisualViewportInset', () => ({
    useVisualViewportInset: () => ({ height: null, bottomInset: 0 })
}));
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => buildAuthSnapshot({ isAuthenticated: true }),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));
vi.mock('../../../src/components/accommodation/AiChatWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));
vi.mock('../../../src/components/accommodation/AiChatFab.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));

describe('AiChatWidget mobile dock (TEST:1768:19)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div data-mobile-dock-slot="ai-chat"></div>';
    });

    it('keeps the FAB portal mounted while the panel is open and restores focus on close', async () => {
        const user = userEvent.setup();
        render(
            <AiChatWidget
                entityType="accommodation"
                entityId="550e8400-e29b-41d4-a716-446655440000"
                locale="es"
                apiUrl="http://localhost:3001"
            />
        );

        const slot = document.querySelector<HTMLElement>('[data-mobile-dock-slot="ai-chat"]');
        if (!slot) throw new Error('AI chat dock slot was not mounted');
        const label = 'Ask AI about this accommodation';
        await waitFor(() =>
            expect(within(slot).getByRole('button', { name: label })).toBeInTheDocument()
        );
        await user.click(within(slot).getByRole('button', { name: label }));

        const panel = screen.getByRole('dialog');
        expect(slot).not.toContainElement(panel);
        await user.click(screen.getByRole('button', { name: 'Close chat' }));

        const fab = within(slot).getByRole('button', { name: label });
        await waitFor(() => expect(document.activeElement).toBe(fab));
    });

    it('preserves desktop FAB positioning and uses a static mobile dock rule', () => {
        expect(CSS_SOURCE).toContain('position: fixed;');
        expect(CSS_SOURCE).toContain('@media (max-width: 767px)');
        expect(CSS_SOURCE).toContain(':global([data-mobile-dock]) .fab');
        expect(CSS_SOURCE).toContain('position: static;');
    });
});
