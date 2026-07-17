/**
 * @file DestinationPOIFilter.test.tsx
 * @description RTL tests for the HOS-147 thematic POI filter chip island.
 *
 * Covers:
 * - Renders one chip per present category; no `aria-current` when inactive (AC-7).
 * - Clicking a chip updates the URL `?categories=` (pushState), sets
 *   `aria-current`, hides non-matching SSR cards, and shows matching ones (AC-3, AC-5).
 * - Multiple chips apply OR/any-of semantics (AC-4).
 * - A deep-link (`?categories=` already set) is honored on mount.
 * - An empty selection matching zero cards reveals the empty state (AC-6).
 * - A live filter change is broadcast to the map via the shared CustomEvent (R-3).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POI_CATEGORY_FILTER_EVENT } from '../../../src/lib/filters/poi-category-filter-event';

// ─── Module mocks ──────────────────────────────────────────────────────────

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/destination/DestinationPOIFilter.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('@repo/icons', () => ({
    getPoiCategoryIcon: () => () => null,
    getPoiCategoryColorScheme: () => ({ fill: '#000000' }),
    XCircleIcon: () => null
}));

import { DestinationPOIFilter } from '../../../src/components/destination/DestinationPOIFilter.client';

const CATEGORIES = [
    { slug: 'termas', nameI18n: { es: 'Termas', en: 'Thermal', pt: 'Termas' }, displayWeight: 80 },
    { slug: 'museos', nameI18n: { es: 'Museos', en: 'Museums', pt: 'Museus' }, displayWeight: 50 }
];

/** Inject a fake SSR POI card grid the island will filter. */
function seedCards(): void {
    const grid = document.createElement('div');
    grid.id = 'test-grid';
    grid.innerHTML = `
        <div data-poi-card data-poi-categories="termas,gastronomia" id="card-a"></div>
        <div data-poi-card data-poi-categories="museos" id="card-b"></div>
        <p data-poi-empty hidden id="empty"></p>
    `;
    document.body.appendChild(grid);
}

const card = (id: string) => document.getElementById(id) as HTMLElement;

beforeEach(() => {
    window.history.pushState({}, '', '/es/destinos/colon/');
    seedCards();
});

afterEach(() => {
    document.getElementById('test-grid')?.remove();
});

describe('DestinationPOIFilter (HOS-147)', () => {
    it('renders one chip per category with no aria-current when inactive', () => {
        render(
            <DestinationPOIFilter
                categories={CATEGORIES}
                locale="es"
            />
        );

        const termas = screen.getByRole('link', { name: 'Termas' });
        const museos = screen.getByRole('link', { name: 'Museos' });
        // aria-current is absent (undefined) when inactive — never "aria-pressed",
        // never a literal "false" (the a11y sweep forbids stray ARIA state).
        expect(termas.getAttribute('aria-current')).toBeNull();
        expect(museos.getAttribute('aria-current')).toBeNull();
        expect(termas.getAttribute('aria-pressed')).toBeNull();
    });

    it('toggling a chip updates the URL, sets aria-current, and filters the cards', () => {
        render(
            <DestinationPOIFilter
                categories={CATEGORIES}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('link', { name: 'Termas' }));

        // URL reflects the selection.
        expect(new URLSearchParams(window.location.search).get('categories')).toBe('termas');
        // aria-current set on the active chip.
        expect(screen.getByRole('link', { name: 'Termas' }).getAttribute('aria-current')).toBe(
            'true'
        );
        // card-a (termas,gastronomia) visible; card-b (museos) hidden.
        expect(card('card-a').hidden).toBe(false);
        expect(card('card-b').hidden).toBe(true);
        // Some visible → empty state stays hidden.
        expect(card('empty').hidden).toBe(true);
    });

    it('applies OR semantics across two selected chips', () => {
        render(
            <DestinationPOIFilter
                categories={CATEGORIES}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('link', { name: 'Termas' }));
        fireEvent.click(screen.getByRole('link', { name: 'Museos' }));

        // Both categories active → both cards visible (union).
        expect(card('card-a').hidden).toBe(false);
        expect(card('card-b').hidden).toBe(false);
        const active = new URLSearchParams(window.location.search).get('categories') ?? '';
        expect(active.split(',').sort()).toEqual(['museos', 'termas']);
    });

    it('honors a deep-link (?categories=) on mount', () => {
        window.history.pushState({}, '', '/es/destinos/colon/?categories=museos');

        render(
            <DestinationPOIFilter
                categories={CATEGORIES}
                locale="es"
            />
        );

        expect(card('card-a').hidden).toBe(true);
        expect(card('card-b').hidden).toBe(false);
        expect(screen.getByRole('link', { name: 'Museos' }).getAttribute('aria-current')).toBe(
            'true'
        );
    });

    it('reveals the empty state when the selection matches zero cards', () => {
        // A category present as a chip but on no card in this seeded grid.
        const cats = [
            { slug: 'playas', nameI18n: { es: 'Playas', en: 'Beaches', pt: 'Praias' } },
            ...CATEGORIES
        ];
        render(
            <DestinationPOIFilter
                categories={cats}
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('link', { name: 'Playas' }));

        expect(card('card-a').hidden).toBe(true);
        expect(card('card-b').hidden).toBe(true);
        expect(card('empty').hidden).toBe(false);
    });

    it('broadcasts the active selection to the map via the shared CustomEvent', () => {
        const received: string[][] = [];
        const handler = (event: Event) => {
            received.push((event as CustomEvent<{ categories: string[] }>).detail.categories);
        };
        window.addEventListener(POI_CATEGORY_FILTER_EVENT, handler);

        render(
            <DestinationPOIFilter
                categories={CATEGORIES}
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('link', { name: 'Termas' }));

        window.removeEventListener(POI_CATEGORY_FILTER_EVENT, handler);
        // Last broadcast carries the active selection.
        expect(received.at(-1)).toEqual(['termas']);
    });
});
