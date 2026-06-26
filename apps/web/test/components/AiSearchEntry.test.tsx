/**
 * @file AiSearchEntry.test.tsx
 * @description Component tests for AiSearchEntry (SPEC-265 D — hybrid layout).
 *
 * Tests the entry point CTA + drawer overlay behavior:
 * - Entry button renders with triggerLabel text
 * - Clicking entry button opens the drawer
 * - Drawer header shows panelTitle
 * - Close button closes the drawer
 * - Clicking the overlay backdrop closes the drawer
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSearchEntry } from '../../src/components/ai-search/AiSearchEntry.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    const translations = { t };
    return {
        createTranslations: (_locale: string) => translations
    };
});

// Mock SearchChatPanel to avoid rendering the full panel inside tests
vi.mock('../../src/components/ai-search/SearchChatPanel.client', () => ({
    SearchChatPanel: () => <div data-testid="search-chat-panel-mock">SearchChatPanel</div>
}));

// CSS module proxy
vi.mock('../../src/components/ai-search/AiSearchEntry.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderEntry(overrides: Partial<Parameters<typeof AiSearchEntry>[0]> = {}) {
    const props = {
        locale: 'es' as const,
        apiUrl: 'http://localhost:3001',
        isAuthenticated: true,
        currentUrl: 'http://localhost:4321/es/alojamientos/',
        ...overrides
    };
    render(<AiSearchEntry {...props} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AiSearchEntry (SPEC-265 D — hybrid layout)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Entry point ───────────────────────────────────────────────────────────

    describe('entry point CTA', () => {
        it('renders the entry button with triggerLabel text', () => {
            renderEntry();
            const entryButton = screen.getByTestId('ai-search-entry');
            expect(entryButton).toBeInTheDocument();
            expect(entryButton.textContent).toContain('Buscá con IA');
        });

        it('entry button is a <button> with type="button"', () => {
            renderEntry();
            const entryButton = screen.getByTestId('ai-search-entry');
            expect(entryButton.tagName).toBe('BUTTON');
            expect(entryButton).toHaveAttribute('type', 'button');
        });

        it('entry button has an aria-label', () => {
            renderEntry();
            const entryButton = screen.getByTestId('ai-search-entry');
            expect(entryButton).toHaveAttribute('aria-label');
        });
    });

    // ── Drawer open/close ─────────────────────────────────────────────────────

    describe('drawer open/close', () => {
        it('does not render the drawer overlay before clicking entry', () => {
            renderEntry();
            expect(screen.queryByTestId('ai-search-overlay')).toBeNull();
        });

        it('opens the drawer when entry button is clicked', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();
        });

        it('renders panelTitle in the drawer header', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            // The mock t() returns the fallback, which is 'Búsqueda inteligente'
            expect(screen.getByText('Búsqueda inteligente')).toBeInTheDocument();
        });

        it('renders the SearchChatPanel inside the drawer', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('search-chat-panel-mock')).toBeInTheDocument();
        });

        it('closes the drawer when close button is clicked', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();

            // Find and click the close button (aria-label contains 'Cerrar')
            const closeButton = screen.getByRole('button', { name: /cerrar/i });
            fireEvent.click(closeButton);

            expect(screen.queryByTestId('ai-search-overlay')).toBeNull();
        });

        it('closes the drawer when Escape key is pressed', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();

            fireEvent.keyDown(window, { key: 'Escape' });

            expect(screen.queryByTestId('ai-search-overlay')).toBeNull();
        });

        it('closes the drawer when overlay backdrop is clicked', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();

            // Click the overlay itself (not a child)
            const overlay = screen.getByTestId('ai-search-overlay');
            fireEvent.click(overlay);

            expect(screen.queryByTestId('ai-search-overlay')).toBeNull();
        });

        it('does not close the drawer when clicking inside the drawer body', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));

            // Click inside the mocked SearchChatPanel
            fireEvent.click(screen.getByTestId('search-chat-panel-mock'));

            expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();
        });
    });

    // ── Props forwarding ──────────────────────────────────────────────────────

    describe('props forwarding', () => {
        it('renders without crashing when optional props are omitted', () => {
            renderEntry();
            fireEvent.click(screen.getByTestId('ai-search-entry'));
            expect(screen.getByTestId('search-chat-panel-mock')).toBeInTheDocument();
        });
    });
});
