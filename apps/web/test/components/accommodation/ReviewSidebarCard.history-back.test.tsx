/**
 * @file ReviewSidebarCard.history-back.test.tsx
 * @description Regression tests for HOS-334: with the review dialog open on
 * the accommodation detail page, the system back button must close the
 * dialog instead of navigating away from the page — and the text the visitor
 * already typed must not be lost to that navigation.
 *
 * This form uses a native `<dialog showModal>` (not the shared `Dialog`), so
 * it wires `useDialogHistoryBack` directly. The router-level invariant (a
 * claimed entry must never make ClientRouter swap the document) is pinned in
 * `test/lib/dialog-history.test.ts`; here the concern is the component seam:
 * claim on open, close and unclaim on a real `popstate`, page stays mounted.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    acquireDialogHistoryEntry,
    resetDialogHistoryForTests
} from '../../../src/lib/dialog-history';
import { buildAuthSnapshot } from '../../helpers/auth-session';
import { __setNavigateImpl } from '../../stubs/astro-transitions-client';

// ---------------------------------------------------------------------------
// Module mocks — same shape as ReviewSidebarCard.test.tsx
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { error: unknown; locale: string; fallback: string }) =>
        fallback
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

vi.mock('@/components/accommodation/ReviewSidebarCard.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => ({
        conversationId: 'conv-1',
        hasConversation: true,
        isResolving: false
    })
}));

// Imported after the mocks so the module graph picks them up.
import { ReviewSidebarCard } from '@/components/accommodation/ReviewSidebarCard.client';

const PAGE_URL = 'http://localhost:3000/es/alojamientos/cabana-del-lago/';

/**
 * Minimal stand-in for the router's `navigate()` on its hash fast path.
 * Injected through the shared stub because `vitest.config.ts` resolves
 * `astro:transitions/client` through an alias that `vi.mock` cannot intercept.
 * Without it the module refuses to claim and none of these tests mean anything.
 */
let routerIndex = 0;
function fakeNavigate(href: string, options?: unknown): void {
    const state = (options as { state?: Record<string, unknown> } | undefined)?.state;
    routerIndex += 1;
    window.history.pushState({ ...state, index: routerIndex, scrollX: 0, scrollY: 0 }, '', href);
}

function enableClientRouter(): void {
    for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
        meta.remove();
    }
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'astro-view-transitions-enabled');
    document.head.appendChild(meta);
}

function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 30));
}

function nextPopState(): Promise<void> {
    return new Promise((resolve) => {
        window.addEventListener('popstate', () => resolve(), { once: true });
    });
}

/** Mock showModal so it also sets the `open` attribute on the element,
 *  which is necessary for JSDOM to expose dialog children in the a11y tree. */
function setupDialogMocks() {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open');
    });
}

const DEFAULT_PROPS = {
    accommodationId: 'acc-123',
    accommodationName: 'Cabaña del Lago',
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    children: <div data-testid="signin-cta">Iniciá sesión para opinar</div>
};

describe('ReviewSidebarCard — back button closes the dialog (HOS-334)', () => {
    beforeAll(async () => {
        __setNavigateImpl(fakeNavigate);
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        acquireDialogHistoryEntry({ onPopped: vi.fn() }).release();
        await settle();
    });

    beforeEach(async () => {
        mockReadCachedAuthMe.mockReset();
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        setupDialogMocks();
        enableClientRouter();
        window.history.replaceState({ index: 0, scrollX: 0, scrollY: 0 }, '', PAGE_URL);
        resetDialogHistoryForTests();
        await settle();
    });

    afterEach(() => {
        resetDialogHistoryForTests();
        vi.restoreAllMocks();
    });

    afterAll(() => {
        __setNavigateImpl(null);
        for (const meta of document.querySelectorAll('[name="astro-view-transitions-enabled"]')) {
            meta.remove();
        }
    });

    it('closes the dialog on back instead of navigating off the page, keeping typed content', async () => {
        const user = userEvent.setup();
        render(<ReviewSidebarCard {...DEFAULT_PROPS} />);

        await user.click(screen.getByRole('button', { name: /dejar reseña/i }));
        const dialog = await screen.findByRole('dialog');
        expect(window.location.hash).toBe('#hospeda-dialog-1');

        const contentField = within(dialog).getByPlaceholderText(
            /comparte tu experiencia en detalle/i
        );
        fireEvent.change(contentField, { target: { value: 'una estadía inolvidable' } });
        expect(contentField).toHaveValue('una estadía inolvidable');

        const popped = nextPopState();
        window.history.back();
        await popped;

        // The dialog is gone (closed via handleClose, which calls dlg.close())…
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        // …and the page itself was never left: the CTA that opened it is still
        // mounted, and the URL is back on the plain page (no swap, no navigation).
        expect(screen.getByRole('button', { name: /dejar reseña/i })).toBeInTheDocument();
        expect(window.location.pathname).toBe('/es/alojamientos/cabana-del-lago/');
        expect(window.location.hash).toBe('');
    });
});
