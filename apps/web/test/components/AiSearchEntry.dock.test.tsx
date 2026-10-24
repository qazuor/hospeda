import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiSearchEntry } from '../../src/components/ai-search/AiSearchEntry.client';

const CSS_SOURCE = readFileSync(
    resolve(__dirname, '../../src/components/ai-search/AiSearchEntry.module.css'),
    'utf8'
);

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({ t: (_key: string, fallback?: string) => fallback ?? '' })
}));
vi.mock('../../src/components/ai-search/SearchChatPanel.client', () => ({
    SearchChatPanel: () => <div data-testid="search-chat-panel" />
}));
vi.mock('../../src/components/ai-search/AiSearchEntry.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, prop) => String(prop) })
}));

describe('AiSearchEntry mobile dock (TEST:1768:18)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('portals the visible FAB while keeping the drawer overlay outside the slot', async () => {
        document.body.innerHTML = '<div data-mobile-dock-slot="ai-search"></div>';
        let observerCallback: IntersectionObserverCallback | undefined;
        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: IntersectionObserverCallback) {
                    observerCallback = callback;
                }
                observe = vi.fn();
                disconnect = vi.fn();
            }
        );

        render(
            <AiSearchEntry
                locale="es"
                apiUrl="http://localhost:3001"
                currentUrl="/es/alojamientos/"
            />
        );
        act(() => {
            observerCallback?.(
                [{ isIntersecting: false } as IntersectionObserverEntry],
                {} as IntersectionObserver
            );
        });

        const slot = document.querySelector<HTMLElement>('[data-mobile-dock-slot="ai-search"]');
        if (!slot) throw new Error('AI search dock slot was not mounted');
        await waitFor(() => expect(within(slot).getByTestId('ai-search-fab')).toBeInTheDocument());
        expect(within(slot).queryByTestId('ai-search-overlay')).not.toBeInTheDocument();

        fireEvent.click(within(slot).getByTestId('ai-search-fab'));
        expect(screen.getByTestId('ai-search-overlay')).toBeInTheDocument();
        expect(within(slot).queryByTestId('ai-search-overlay')).not.toBeInTheDocument();
    });

    it('preserves desktop FAB positioning and uses a static mobile dock rule', () => {
        expect(CSS_SOURCE).toContain('bottom: 5rem;');
        expect(CSS_SOURCE).not.toContain('12.5rem');
        expect(CSS_SOURCE).toContain('@media (max-width: 767px)');
        expect(CSS_SOURCE).toContain(':global([data-mobile-dock]) .fab');
        expect(CSS_SOURCE).toContain('position: static;');
    });
});
