import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ListingContactBarProps } from '@/components/listing/contact/ListingContactBar.client';
import { ListingContactBar } from '@/components/listing/contact/ListingContactBar.client';
import { initDockAutoHide, MOBILE_DOCK_HIDDEN_ATTR } from '@/lib/mobile-dock/mobile-dock-autohide';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));
vi.mock('@/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({
        isInList: () => false,
        isLoading: false,
        maxItems: 4,
        toggle: () => ({ action: 'added', reason: null })
    })
}));

const props: ListingContactBarProps = {
    listingId: 'acc-1',
    listingName: 'Casa del Río',
    vertical: 'accommodation',
    locale: 'es',
    hasWhatsapp: true,
    price: {
        amount: 155500,
        currency: 'ARS',
        unitLabelKey: 'accommodations.detail.listingContact.units.perNight',
        onRequest: false
    },
    panelId: 'listing-panel',
    primary: { kind: 'inquire' },
    phoneHref: 'tel:+5493442000000',
    shareUrl: 'https://hospeda.test/es/alojamientos/casa-del-rio/',
    compare: { gatePlanNames: [] }
};

/** The poorest listing of each vertical: nothing to contact, nothing to compare. */
const bareListings: readonly (readonly [string, ListingContactBarProps])[] = [
    [
        'accommodation (the inquiry form always exists)',
        { ...props, hasWhatsapp: false, phoneHref: null, price: null, compare: null }
    ],
    [
        'venue with no menu, socials or WhatsApp',
        {
            ...props,
            vertical: 'venue',
            listingId: 'ven-1',
            listingName: 'bar-smoke-1107',
            price: null,
            primary: null,
            hasWhatsapp: false,
            venueWhatsapp: null,
            phoneHref: null,
            compare: null,
            fallbackHref: '#venue-contact'
        }
    ],
    [
        'experience with no channel',
        {
            ...props,
            vertical: 'experience',
            listingId: 'exp-1',
            listingName: 'Kayak',
            price: null,
            primary: null,
            hasWhatsapp: false,
            phoneHref: null,
            compare: null,
            fallbackHref: '#experience-contact'
        }
    ]
];

const renderInDock = (barProps: ListingContactBarProps) =>
    render(
        <div data-mobile-dock>
            <div data-mobile-dock-slot="contact" />
            <ListingContactBar {...barProps} />
        </div>
    );

describe('ListingContactBar', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('server renders ARS for an accommodation with an amount but no currency', () => {
        const html = renderToString(
            <ListingContactBar
                {...props}
                locale="en"
                price={{ ...props.price, currency: null } as ListingContactBarProps['price']}
            />
        );

        expect(html).toContain('ARS');
        expect(html).toContain('155,500');
    });

    it('puts the price line (muted prefix, amount, muted unit) above the action row', () => {
        const { container } = render(<ListingContactBar {...props} />);
        const price = container.querySelector('p');
        const row = container.querySelector('[data-action-row]');

        expect(price).not.toBeNull();
        if (!price || !row) throw new Error('Missing price or action row');
        expect(within(price).getByText('Desde')).toBeInTheDocument();
        expect(price.querySelector('strong')?.textContent).toMatch(/155\.500/);
        expect(within(price).getByText('/noche')).toBeInTheDocument();
        expect(price.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('omits the prefix when there is no unit (experience without price unit)', () => {
        const { container } = render(
            <ListingContactBar
                {...props}
                vertical="experience"
                compare={null}
                price={{ ...props.price, unitLabelKey: null } as ListingContactBarProps['price']}
            />
        );

        expect(container.querySelector('p strong')).not.toBeNull();
        expect(screen.queryByText('Desde')).not.toBeInTheDocument();
    });

    it.each([
        { amount: null, onRequest: false },
        { amount: 155500, onRequest: true }
    ])('shows a quote CTA for $amount / onRequest=$onRequest', (price) => {
        render(
            <ListingContactBar
                {...props}
                price={{ ...props.price, ...price } as ListingContactBarProps['price']}
            />
        );

        expect(screen.getByText('Consultar precio')).toBeInTheDocument();
        expect(screen.queryByText(/155\.500|\/noche/)).not.toBeInTheDocument();
    });

    it('HOS-2607: «Consultar precio» is a light status label, never the bold amount', () => {
        // Arrange
        const { container } = render(
            <ListingContactBar
                {...props}
                price={{ ...props.price, onRequest: true } as ListingContactBarProps['price']}
            />
        );
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../src/components/listing/contact/ListingContactBar.module.css'
            ),
            'utf8'
        );
        const ruleOf = (cls: string): string =>
            css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

        // Act
        const line = container.querySelector('p');
        const label = screen.getByText('Consultar precio');

        // Assert: it is not the <strong> amount, and carries the on-request state.
        expect(line).toHaveAttribute('data-price-state', 'on-request');
        expect(line?.querySelector('strong')).toBeNull();
        expect(label.tagName).toBe('SPAN');
        expect(label.className).toMatch(/onRequest/);
        // Lighter and smaller than the amount, on the amount's line box (same bar height).
        const onRequest = ruleOf('onRequest');
        const amount = ruleOf('amount');
        expect(onRequest).toMatch(/font-size:\s*var\(--text-sm\)/);
        expect(onRequest).toMatch(/font-weight:\s*600/);
        expect(onRequest).toMatch(/color:\s*var\(--core-muted-foreground\)/);
        expect(onRequest).toMatch(/line-height:\s*calc\(var\(--text-lg\)\s*\*\s*1\.1\)/);
        expect(amount).toMatch(/font-size:\s*var\(--text-lg\)/);
        expect(amount).toMatch(/line-height:\s*1\.1/);
    });

    it('HOS-2607: a priced line keeps the amount state', () => {
        const { container } = render(<ListingContactBar {...props} />);

        expect(container.querySelector('p')).toHaveAttribute('data-price-state', 'amount');
        expect(container.querySelector('[data-price-state="on-request"]')).toBeNull();
    });

    it('HOS-2607: the listing dock is opaque in BOTH themes, with a stronger edge', () => {
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../src/components/listing/contact/ListingContactBar.module.css'
            ),
            'utf8'
        ).replace(/\/\*[\s\S]*?\*\//g, '');
        const rules = [...css.matchAll(/([^{}]*mobile-dock__row[^{}]*)\{([^{}]*)\}/g)];
        const surface = rules.find(([, , body]) => /background/.test(body ?? ''));

        expect(surface).toBeDefined();
        const [, selector = '', body = ''] = surface ?? [];
        // One rule for both themes: no theme qualifier on the selector.
        expect(selector).not.toMatch(/data-theme|prefers-color-scheme/);
        expect(body).toMatch(/background:\s*var\(--core-card\)\s*;/);
        expect(body).toMatch(/backdrop-filter:\s*none/);
        expect(body).toMatch(/border-block-start-color:\s*var\(--core-foreground-a15\)/);
        expect(body).toMatch(/box-shadow:\s*var\(--shadow-dock\)/);
        // Nothing translucent left for the listing dock.
        expect(css).not.toMatch(/core-card-a\d+|frost-bg/);
    });

    it('HOS-2607: every dock-row override outranks the dock own scoped rule, whatever the load order', () => {
        // The dock's row rule is Astro-scoped, `.mobile-dock__row[data-astro-cid-…]`,
        // (0,2,0). A tie loses whenever the dock stylesheet loads last, which is
        // what staging served on the experience page: the ai-chat button stayed
        // centred, 17px above the action row. `html` lifts each override to (0,2,1).
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../src/components/listing/contact/ListingContactBar.module.css'
            ),
            'utf8'
        ).replace(/\/\*[\s\S]*?\*\//g, '');
        const overrides = [...css.matchAll(/([^{}]*mobile-dock__row[^{}]*)\{([^{}]*)\}/g)];

        expect(overrides.length).toBeGreaterThanOrEqual(2);
        for (const [, selector = ''] of overrides) {
            expect(selector.trim()).toMatch(/^:global\(html \.mobile-dock__row\)/);
        }
        expect(overrides.some(([, , body]) => /align-items:\s*flex-end/.test(body ?? ''))).toBe(
            true
        );
    });

    it('server renders the nightly price and portals a measurable item into the contact slot', () => {
        const html = renderToString(<ListingContactBar {...props} />);
        const { container } = renderInDock(props);

        expect(html).toContain('155.500');
        const item = container.querySelector<HTMLElement>(
            '[data-mobile-dock-slot="contact"] [data-dock-item]'
        );
        expect(item).not.toBeNull();
        if (!item) throw new Error('Missing dock item');
        expect(within(item).getByText('/noche')).toBeInTheDocument();
        expect(within(item).getByRole('link', { name: 'Consultar' })).toBeInTheDocument();
    });

    it.each(
        bareListings
    )('owner criterion (24/11): a bare %s still renders Favorito and Compartir (and Consultar only with a channel) in the contact slot', (_name, barProps) => {
        const { container } = renderInDock(barProps);

        const item = container.querySelector<HTMLElement>(
            '[data-mobile-dock-slot="contact"] [data-dock-item]'
        );
        expect(item).not.toBeNull();
        if (!item) throw new Error('Missing dock item');
        const actions = Array.from(item.querySelectorAll<HTMLElement>('[data-action]')).map(
            (node) => node.dataset.action
        );
        expect(actions.filter((action) => action !== 'primary')).toEqual(['favorite', 'share']);
        expect(actions.includes('primary')).toBe(barProps.vertical === 'accommodation');
    });

    it.each(
        bareListings
    )('owner criterion (24/11): a bare %s keeps the dock pinned through a 2000px scroll', (_name, barProps) => {
        const { container } = renderInDock(barProps);
        const dock = container.querySelector<HTMLElement>('[data-mobile-dock]');
        const item = container.querySelector<HTMLElement>(
            '[data-mobile-dock-slot="contact"] [data-dock-item]'
        );
        if (!dock || !item) throw new Error('Missing dock or dock item');
        // jsdom has no layout: a rendered (display: flex) item reports one client rect.
        vi.spyOn(item, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
        const frames: FrameRequestCallback[] = [];
        const win = {
            scrollY: 0,
            innerHeight: 740,
            document: { documentElement: { scrollHeight: 6000 } },
            addEventListener: window.addEventListener.bind(window),
            removeEventListener: window.removeEventListener.bind(window),
            requestAnimationFrame: (callback: FrameRequestCallback) => frames.push(callback),
            cancelAnimationFrame: () => undefined
        } as unknown as Window;
        const media = {
            matches: true,
            addEventListener: () => undefined,
            removeEventListener: () => undefined
        } as unknown as MediaQueryList;
        const { cleanup } = initDockAutoHide({ dock, win, matchMedia: () => media });
        try {
            Object.defineProperty(win, 'scrollY', { configurable: true, value: 2000 });
            window.dispatchEvent(new Event('scroll'));
            for (const frame of frames.splice(0)) frame(0);

            expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
        } finally {
            cleanup();
        }
    });

    it('rejects invalid island props and only displays the bar inside the mobile dock (AC-37)', () => {
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../src/components/listing/contact/ListingContactBar.module.css'
            ),
            'utf8'
        );
        const html = renderToString(
            <ListingContactBar
                {...props}
                price={
                    { ...props.price, currency: 'bad currency' } as ListingContactBarProps['price']
                }
            />
        );

        expect(html).toBe('');
        expect(css).toMatch(/\.bar\s*\{\s*display:\s*none/);
        expect(css).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*:global\(\[data-mobile-dock\]\) \.bar\s*\{[^}]*display:\s*flex;\s*position:\s*static/
        );
    });

    it.each([
        ['a non-anchor fallback', { fallbackHref: 'https://evil.test' }],
        ['a non-tel phone href', { phoneHref: 'javascript:alert(1)' }],
        ['a non-URL menu', { primary: { kind: 'menu', href: 'not a url' } }]
    ] as const)('rejects %s', (_name, override) => {
        const { container } = render(
            <ListingContactBar
                {...props}
                {...(override as Partial<ListingContactBarProps>)}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
