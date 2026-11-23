import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { ListingSectionTabs } from '@/components/listing/ListingSectionTabs.client';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import { buildListingSectionTabs } from '@/lib/listing-section-tabs';

vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
interface FakeObserver {
    readonly callback: ObserverCallback;
    readonly options: IntersectionObserverInit | undefined;
    readonly observed: Element[];
}

const observers: FakeObserver[] = [];

const tabs = buildListingSectionTabs({
    present: {
        photos: true,
        details: true,
        amenities: true,
        location: true,
        reviews: true,
        host: true
    },
    hideOnDesktop: ['host']
});

const props = {
    tabs,
    locale: 'es',
    vertical: 'accommodation',
    listingId: 'acc-1',
    price: {
        amount: 155500,
        currency: 'ARS',
        unitLabelKey: 'accommodations.detail.listingContact.units.perNight',
        onRequest: false
    },
    panelId: 'listing-panel',
    primaryLabelKey: 'accommodations.detail.listingContact.bar.inquire',
    galleryId: 'listing-photos'
} as const;

function mountSections(): void {
    for (const tab of tabs) {
        const section = document.createElement('section');
        section.id = tab.id;
        // jsdom has no layout: make the sections count as rendered.
        section.getClientRects = () => [{}] as unknown as DOMRectList;
        section.scrollIntoView = vi.fn();
        document.body.append(section);
    }
}

beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            readonly #record: FakeObserver;
            constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
                this.#record = { callback, options, observed: [] };
                observers.push(this.#record);
            }
            observe(element: Element): void {
                this.#record.observed.push(element);
            }
            disconnect(): void {}
        }
    );
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    mountSections();
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('ListingSectionTabs', () => {
    it('server renders a nav of plain anchors, so it works without JS', () => {
        const html = renderToString(<ListingSectionTabs {...props} />);

        expect(html).toContain('<nav');
        for (const tab of tabs) expect(html).toContain(`href="#${tab.id}"`);
        expect(html).toContain('Fotos');
        expect(html).toContain('Anfitrión');
    });

    it('renders a tab only for the sections that exist (AC-2.1)', () => {
        const only = buildListingSectionTabs({ present: { photos: true, location: true } });
        render(
            <ListingSectionTabs
                {...props}
                tabs={only}
            />
        );
        const nav = screen.getByRole('navigation', { name: 'Secciones del alojamiento' });

        expect(nav.querySelectorAll('a[data-tab-id]')).toHaveLength(2);
        expect(screen.getByRole('link', { name: 'Ubicación' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Reseñas' })).not.toBeInTheDocument();
    });

    it('renders nothing for invalid props or an empty tab list', () => {
        expect(
            renderToString(
                <ListingSectionTabs
                    {...props}
                    tabs={[]}
                />
            )
        ).toBe('');
        expect(
            renderToString(
                <ListingSectionTabs
                    {...props}
                    listingId=""
                />
            )
        ).toBe('');
    });

    it('marks the current tab with aria-current and follows the scroll (AC-2.1)', () => {
        render(<ListingSectionTabs {...props} />);
        expect(screen.getByRole('link', { name: 'Fotos' })).toHaveAttribute(
            'aria-current',
            'location'
        );

        const sectionObserver = observers[0];
        if (!sectionObserver) throw new Error('Missing section observer');
        const reviews = document.getElementById('listing-reviews');
        act(() => {
            sectionObserver.callback([{ target: reviews as Element, isIntersecting: true }]);
        });

        expect(screen.getByRole('link', { name: 'Reseñas' })).toHaveAttribute(
            'aria-current',
            'location'
        );
        expect(screen.getByRole('link', { name: 'Fotos' })).not.toHaveAttribute('aria-current');
        expect(sectionObserver.observed.map((element) => element.id)).toContain('listing-reviews');
    });

    it('observes only sections laid out in the current layout', () => {
        const host = document.getElementById('listing-host');
        if (!host) throw new Error('Missing host section');
        host.getClientRects = () => [] as unknown as DOMRectList;

        render(<ListingSectionTabs {...props} />);

        expect(observers[0]?.observed.map((element) => element.id)).not.toContain('listing-host');
    });

    it('scrolls to the section on click without leaving the page (AC-2.1)', () => {
        render(<ListingSectionTabs {...props} />);
        const comodidades = document.getElementById('listing-amenities') as HTMLElement;

        fireEvent.click(screen.getByRole('link', { name: 'Comodidades' }));

        expect(comodidades.scrollIntoView).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'start'
        });
        expect(window.location.hash).toBe('#listing-amenities');
        expect(screen.getByRole('link', { name: 'Comodidades' })).toHaveAttribute(
            'aria-current',
            'location'
        );
    });

    it('lets the browser handle modified clicks', () => {
        render(<ListingSectionTabs {...props} />);
        const target = document.getElementById('listing-amenities') as HTMLElement;

        fireEvent.click(screen.getByRole('link', { name: 'Comodidades' }), { ctrlKey: true });

        expect(target.scrollIntoView).not.toHaveBeenCalled();
    });

    it('hides price and Consultar until the gallery is out of view, then opens the panel (AC-2.2)', () => {
        const received = vi.fn();
        const unsubscribe = onListingContactPanelOpen(received);
        const clearReady = markListingContactPanelReady({ panelId: props.panelId });
        try {
            const { container } = render(<ListingSectionTabs {...props} />);
            const cta = container.querySelector<HTMLElement>('[data-listing-section-cta]');
            if (!cta) throw new Error('Missing CTA group');
            expect(cta).toHaveAttribute('hidden');

            const galleryObserver = observers[1];
            if (!galleryObserver) throw new Error('Missing gallery observer');
            act(() => {
                galleryObserver.callback([
                    { isIntersecting: false, boundingClientRect: { top: -400 } as DOMRectReadOnly }
                ]);
            });

            expect(cta).not.toHaveAttribute('hidden');
            expect(cta).toHaveTextContent(/155\.500.*noche/);
            fireEvent.click(screen.getByRole('link', { name: 'Consultar' }));
            expect(received).toHaveBeenCalledWith({ origin: 'bar', focus: undefined });

            act(() => {
                galleryObserver.callback([
                    { isIntersecting: true, boundingClientRect: { top: 10 } as DOMRectReadOnly }
                ]);
            });
            expect(cta).toHaveAttribute('hidden');
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });

    it('keeps the price band off mobile and the sticky offsets in CSS', () => {
        const css = readFileSync(
            resolve(__dirname, '../../../src/components/listing/ListingSectionTabs.module.css'),
            'utf8'
        );

        expect(css).toMatch(/\.nav\s*\{[^}]*position:\s*sticky/);
        expect(css).toMatch(/--tabs-top:\s*calc\(var\(--navbar-height[^;]*--wave-bar-compact/);
        expect(css).toMatch(
            /:global\(\.wave-header--hidden\)\s*\.nav\s*\{\s*--tabs-top:\s*var\(--navbar-height/
        );
        expect(css).toMatch(/\.list\s*\{[^}]*overflow-x:\s*auto/);
        expect(css).toMatch(/\.cta\s*\{\s*display:\s*none/);
        expect(css).toMatch(/\.link:focus-visible\s*\{[^}]*outline:/);
    });
});
