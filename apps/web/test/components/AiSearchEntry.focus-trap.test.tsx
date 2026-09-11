/**
 * @file AiSearchEntry.focus-trap.test.tsx
 * @description Regression tests for `AiSearchEntry`'s focus trap (HOS-350).
 *
 * `AiSearchEntry` used to carry its own private `FOCUSABLE_SELECTOR` constant
 * and Tab-cycling loop, wired via `onKeyDown` on the drawer `<section>`
 * itself — so once focus fell out to `<body>` (a disabled control, a tap on
 * non-focusable drawer background), the handler never even ran: `<body>` is
 * not a descendant of the section. Migrating to the shared `trapFocus`
 * (bound to `document`, like every other consumer) fixes that.
 *
 * These assertions read `defaultPrevented` on a real cancelable
 * `KeyboardEvent` rather than watching `document.activeElement`: jsdom never
 * moves focus on Tab, so "focus stayed put" cannot tell an engaged trap from
 * a no-op.
 *
 * @module test/components/AiSearchEntry.focus-trap
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiSearchEntry } from '../../src/components/ai-search/AiSearchEntry.client';
import { FOCUSABLE_SELECTORS } from '../../src/lib/focus-trap';
import { buildAuthSnapshot } from '../helpers/auth-session';

// ─── Module mocks (mirrors AiSearchEntry.test.tsx) ─────────────────────────

vi.mock('@/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    return { createTranslations: (_locale: string) => ({ t }) };
});

vi.mock('../../src/components/ai-search/SearchChatPanel.client', () => ({
    SearchChatPanel: () => <div data-testid="search-chat-panel-mock">SearchChatPanel</div>
}));

vi.mock('../../src/components/ai-search/AiSearchEntry.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

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

function renderOpenDrawer() {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
    render(
        <AiSearchEntry
            locale="es"
            apiUrl="http://localhost:3001"
            currentUrl="http://localhost:4321/es/alojamientos/"
        />
    );
    fireEvent.click(screen.getByTestId('ai-search-entry'));
    return screen.getByRole('dialog');
}

describe('AiSearchEntry focus trap (HOS-350 — migrated to shared helper)', () => {
    it('prevents Tab and pulls focus back in when focus has escaped to <body>', async () => {
        const drawer = renderOpenDrawer();

        await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));

        // The state a disabled-on-click button or a tap on dead space leaves
        // behind. The old private copy did not react at all here — its
        // listener was bound to the `<section>`, and <body> is outside it.
        (document.activeElement as HTMLElement).blur();
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(drawer.contains(document.activeElement)).toBe(true);
    });

    it('still cycles Tab between the first and last focusable', async () => {
        const drawer = renderOpenDrawer();
        await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));

        const focusables = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
        expect(focusables.length).toBeGreaterThan(1);
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        last.focus();
        const forward = dispatchTab();
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(first);

        first.focus();
        const backward = dispatchTab({ shiftKey: true });
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);
    });
});
