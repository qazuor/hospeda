/**
 * @file ListingActionBarButtons.test.tsx
 * @description HOS-2579 US-9 (§6.10): the icon-only mobile action bar.
 * AC-27 (accommodation order + names + primary), AC-28 (experience: no WhatsApp,
 * no Comparar), AC-29 (venue WhatsApp modes), AC-30 (unit half: the accommodation
 * WhatsApp only asks the panel to open, with no network call; the upsell itself
 * is E2E), AC-31 (absent channels are not rendered), AC-32 (venue «Ver carta»),
 * AC-35 (one event per tap, schema-valid) and AC-36 (favorite synced through the
 * shared store).
 *
 * Widths, tap-target sizes and the dock height (AC-33/34) cannot be computed in
 * jsdom; they are E2E (`apps/e2e/tests/guest/guest-13-listing-detail-standard.spec.ts`).
 */
import { AnalyticsEventSchemas } from '@repo/analytics';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingActionBarButtonsProps } from '@/components/listing/contact/ListingActionBarButtons';
import { ListingActionBarButtons } from '@/components/listing/contact/ListingActionBarButtons';
import { markListingContactPanelReady } from '@/components/listing/contact/listing-contact-readiness';
import { FavoriteButton } from '@/components/shared/favorite/FavoriteButton.client';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import { initContactLinkTracking } from '@/lib/listing-contact/track-contact-links';
import { resetFavoritesStore } from '@/store/favorites-store';

const { trackEvent, readCachedAuthMe, toggle, checkBulk, compareState } = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    readCachedAuthMe: vi.fn(),
    toggle: vi.fn(),
    checkBulk: vi.fn(),
    compareState: { selected: false }
}));

vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent }));
vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => readCachedAuthMe(),
    fetchAuthMe: () => Promise.resolve(readCachedAuthMe()),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    userBookmarksApi: { toggle, checkBulk }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/hooks/useCompareGuard', () => ({
    useCompareGuard: () => ({
        isInList: () => compareState.selected,
        isLoading: false,
        maxItems: 4,
        toggle: () => ({ action: 'added', reason: null })
    })
}));

const accommodation: ListingActionBarButtonsProps = {
    vertical: 'accommodation',
    listingId: 'acc-1',
    listingName: 'Casa del Río',
    locale: 'es',
    panelId: 'listing-contact-panel',
    fallbackHref: '#contact',
    primary: { kind: 'inquire' },
    hasWhatsapp: true,
    venueWhatsapp: null,
    phoneHref: 'tel:+5493442000000',
    shareUrl: 'https://hospeda.test/es/alojamientos/casa-del-rio/',
    compare: { gatePlanNames: [] }
};

const experience: ListingActionBarButtonsProps = {
    ...accommodation,
    vertical: 'experience',
    listingId: 'exp-1',
    listingName: 'Kayak al atardecer',
    hasWhatsapp: false,
    compare: null,
    fallbackHref: '#experience-contact'
};

const venue: ListingActionBarButtonsProps = {
    ...accommodation,
    vertical: 'venue',
    listingId: 'ven-1',
    listingName: 'Bar del Puerto',
    hasWhatsapp: false,
    compare: null,
    phoneHref: null,
    fallbackHref: '#venue-contact'
};

const actionsOf = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-action]')).map(
        (node) => node.dataset.action ?? ''
    );

/** jsdom cannot navigate to `tel:`/`https:`; the delegated listener still sees the click. */
const blockNavigation = (): void => {
    document.addEventListener('click', (event) => event.preventDefault(), { once: true });
};

const guest = () => ({
    isAuthenticated: false,
    user: null,
    permissions: [],
    roles: [],
    cachedAt: Date.now()
});
const signedIn = () => ({
    isAuthenticated: true,
    user: { id: 'user-1', name: 'Ana', email: 'ana@example.com' },
    permissions: [],
    roles: ['USER'],
    cachedAt: Date.now()
});

beforeEach(() => {
    trackEvent.mockClear();
    resetFavoritesStore();
    compareState.selected = false;
    readCachedAuthMe.mockReturnValue(guest());
    checkBulk.mockImplementation(({ entityIds }: { entityIds: readonly string[] }) =>
        Promise.resolve({
            ok: true,
            data: {
                checks: Object.fromEntries(
                    entityIds.map((id) => [id, { isBookmarked: false, bookmarkId: null }])
                )
            }
        })
    );
    toggle.mockResolvedValue({ ok: true, data: { toggled: true, bookmark: { id: 'bm-1' } } });
    document.documentElement.dataset.locale = 'es';
    initContactLinkTracking({ document });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('ListingActionBarButtons: render rules', () => {
    it('AC-27: accommodation renders the six actions in order, named, with Consultar primary', () => {
        const { container } = render(<ListingActionBarButtons {...accommodation} />);

        expect(actionsOf(container)).toEqual([
            'primary',
            'whatsapp',
            'call',
            'favorite',
            'share',
            'compare'
        ]);
        const consultar = screen.getByRole('link', { name: 'Consultar' });
        expect(consultar).toHaveAttribute('data-action', 'primary');
        // HOS-2607: white with orange, never the orange gradient on the dock.
        expect(consultar.className).not.toContain('btn-gradient');
        expect(consultar.className).toMatch(/primary/);
        expect(screen.getByRole('link', { name: 'Escribir por WhatsApp' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Llamar' })).toHaveAttribute(
            'href',
            'tel:+5493442000000'
        );
        expect(screen.getByRole('button', { name: 'Compartir' })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Agregar a la comparación/ })
        ).toBeInTheDocument();
        for (const control of container.querySelectorAll('a, button')) {
            const name = control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '';
            expect(name.length).toBeGreaterThan(0);
        }
    });

    it('AC-27: favorite and compare labels follow their pressed state', async () => {
        compareState.selected = true;
        render(<ListingActionBarButtons {...accommodation} />);

        const compare = screen.getByRole('button', { name: /Quitar de la comparación/ });
        expect(compare).toHaveAttribute('aria-pressed', 'true');
        const favorite = await screen.findByRole('button', { name: 'Guardar en favoritos' });
        expect(favorite).toHaveAttribute('aria-pressed', 'false');
    });

    it('AC-28: an experience shows Consultar, Llamar, Favorito and Compartir, never WhatsApp or Comparar', () => {
        const { container } = render(<ListingActionBarButtons {...experience} />);

        expect(actionsOf(container)).toEqual(['primary', 'call', 'favorite', 'share']);
        expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
        expect(container.innerHTML).not.toMatch(/wa\.me|whatsapp/i);
    });

    it('AC-28: an experience never shows WhatsApp even if a caller passes the flag', () => {
        const { container } = render(
            <ListingActionBarButtons
                {...experience}
                hasWhatsapp
                venueWhatsapp={{ mode: 'PUBLIC', number: '+5493442111111' }}
            />
        );

        expect(actionsOf(container)).not.toContain('whatsapp');
    });

    it('AC-29: a PUBLIC venue WhatsApp is a direct wa.me anchor, tracked by attributes only', () => {
        render(
            <ListingActionBarButtons
                {...venue}
                venueWhatsapp={{ mode: 'PUBLIC', number: '+54 9 3442 111111' }}
            />
        );

        const link = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
        expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5493442111111\?text=/);
        expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('Bar del Puerto');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('data-contact-channel', 'whatsapp');
        expect(link).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
    });

    it('HOS-314: the bar WhatsApp glyph is inked by the channel foreground (currentColor)', () => {
        render(<ListingActionBarButtons {...accommodation} />);

        const link = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
        expect(link.className).toContain('whatsapp');
        expect(link.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    });

    it('AC-29: a LOGGED_IN_ONLY venue WhatsApp opens the channels panel on the WhatsApp row', () => {
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: venue.panelId });
        try {
            render(
                <ListingActionBarButtons
                    {...venue}
                    venueWhatsapp={{ mode: 'LOGGED_IN_ONLY' }}
                />
            );
            const button = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
            expect(button).toHaveAttribute('href', '#venue-contact');
            expect(button).not.toHaveAttribute('data-contact-channel');
            fireEvent.click(button);

            expect(receive).toHaveBeenCalledWith({ origin: 'bar', focus: 'whatsapp' });
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });

    it('AC-29: a venue with no WhatsApp state has no WhatsApp button', () => {
        const { container } = render(<ListingActionBarButtons {...venue} />);

        expect(actionsOf(container)).not.toContain('whatsapp');
    });

    it('AC-30: the accommodation WhatsApp asks the panel to open on WhatsApp and makes no request', () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
        const receive = vi.fn();
        const unsubscribe = onListingContactPanelOpen(receive);
        const clearReady = markListingContactPanelReady({ panelId: accommodation.panelId });
        try {
            render(<ListingActionBarButtons {...accommodation} />);
            fireEvent.click(screen.getByRole('link', { name: 'Escribir por WhatsApp' }));

            expect(receive).toHaveBeenCalledWith({ origin: 'bar', focus: 'whatsapp' });
            expect(fetchSpy).not.toHaveBeenCalledWith(
                expect.stringMatching(/\/protected\/accommodations\/.+\/whatsapp/),
                expect.anything()
            );
            expect(fetchSpy.mock.calls.some(([url]) => String(url).includes('/whatsapp'))).toBe(
                false
            );
        } finally {
            unsubscribe();
            act(clearReady);
        }
    });

    it('AC-31: without a phone there is no Llamar; without any channel there is no Consultar', () => {
        const { container } = render(
            <ListingActionBarButtons
                {...experience}
                primary={null}
                phoneHref={null}
            />
        );

        expect(actionsOf(container)).toEqual(['favorite', 'share']);
        expect(screen.queryByRole('link', { name: 'Llamar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Consultar' })).not.toBeInTheDocument();
    });

    it('AC-31: no bar-owned control is disabled or aria-disabled', () => {
        const { container } = render(<ListingActionBarButtons {...accommodation} />);

        const owned = container.querySelectorAll(
            '[data-action="primary"], [data-action="whatsapp"], [data-action="call"]'
        );
        expect(owned).toHaveLength(3);
        for (const control of owned) {
            expect(control).not.toHaveAttribute('disabled');
            expect(control).not.toHaveAttribute('aria-disabled');
        }
    });

    it('AC-32: a venue with a menu has «Ver carta» in position 1, primary and tagged as the menu', () => {
        const { container } = render(
            <ListingActionBarButtons
                {...venue}
                primary={{ kind: 'menu', href: 'https://bar.test/carta' }}
            />
        );

        expect(actionsOf(container)[0]).toBe('primary');
        const menu = screen.getByRole('link', { name: 'Ver carta' });
        expect(menu).toHaveAttribute('data-action', 'primary');
        expect(menu.className).not.toContain('btn-gradient');
        expect(menu.className).toMatch(/primary/);
        expect(menu).toHaveAttribute('data-contact-channel', 'menu');
        expect(menu).toHaveAttribute('href', 'https://bar.test/carta');
        expect(screen.queryByRole('link', { name: 'Consultar' })).not.toBeInTheDocument();
    });

    it('owner counters: every venue bar link carries the channel and kind the page block uses', () => {
        render(
            <ListingActionBarButtons
                {...venue}
                primary={{ kind: 'menu', href: 'https://bar.test/carta' }}
                venueWhatsapp={{ mode: 'PUBLIC', number: '+54 9 3442 111111' }}
                phoneHref="tel:+5493442222222"
            />
        );

        const call = screen.getByRole('link', { name: 'Llamar' });
        expect(call).toHaveAttribute('data-contact-channel', 'phone');
        expect(call).toHaveAttribute('data-interaction-kind', 'PHONE_CLICK');
        const whatsapp = screen.getByRole('link', { name: 'Escribir por WhatsApp' });
        expect(whatsapp).toHaveAttribute('data-contact-channel', 'whatsapp');
        expect(whatsapp).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
        // The page's menu button carries no interaction kind (no MENU counter exists).
        const menu = screen.getByRole('link', { name: 'Ver carta' });
        expect(menu).toHaveAttribute('data-contact-channel', 'menu');
        expect(menu).not.toHaveAttribute('data-interaction-kind');
    });

    it('owner counters: accommodation and experience calls carry no venue interaction kind', () => {
        for (const props of [accommodation, experience]) {
            const { unmount } = render(<ListingActionBarButtons {...props} />);
            expect(screen.getByRole('link', { name: 'Llamar' })).not.toHaveAttribute(
                'data-interaction-kind'
            );
            unmount();
        }
    });
});

describe('ListingActionBarButtons: analytics (AC-35)', () => {
    const lastPayload = (event: string): unknown =>
        trackEvent.mock.calls.filter(([name]) => name === event).at(-1)?.[1];

    it.each([
        ['Consultar', 'form_open'],
        ['Escribir por WhatsApp', 'whatsapp']
    ] as const)('%s emits exactly one listing_contact_clicked with origin bar', (name, channel) => {
        const clearReady = markListingContactPanelReady({ panelId: accommodation.panelId });
        try {
            render(<ListingActionBarButtons {...accommodation} />);
            fireEvent.click(screen.getByRole('link', { name }));

            expect(trackEvent).toHaveBeenCalledTimes(1);
            const payload = lastPayload('listing_contact_clicked');
            expect(payload).toEqual({
                listing_id: 'acc-1',
                vertical: 'accommodation',
                channel,
                origin: 'bar',
                locale: 'es'
            });
            expect(AnalyticsEventSchemas.listing_contact_clicked.safeParse(payload).success).toBe(
                true
            );
        } finally {
            act(clearReady);
        }
    });

    it('Llamar is reported once, by the delegated listener', () => {
        render(<ListingActionBarButtons {...accommodation} />);
        blockNavigation();
        fireEvent.click(screen.getByRole('link', { name: 'Llamar' }));

        expect(trackEvent).toHaveBeenCalledTimes(1);
        const payload = lastPayload('listing_contact_clicked');
        expect(payload).toEqual({
            listing_id: 'acc-1',
            vertical: 'accommodation',
            channel: 'phone',
            origin: 'bar',
            locale: 'es'
        });
        expect(AnalyticsEventSchemas.listing_contact_clicked.safeParse(payload).success).toBe(true);
    });

    it('a venue PUBLIC WhatsApp is reported once, by the delegated listener', () => {
        render(
            <ListingActionBarButtons
                {...venue}
                venueWhatsapp={{ mode: 'PUBLIC', number: '+5493442111111' }}
            />
        );
        blockNavigation();
        fireEvent.click(screen.getByRole('link', { name: 'Escribir por WhatsApp' }));

        expect(trackEvent).toHaveBeenCalledTimes(1);
        const payload = lastPayload('listing_contact_clicked');
        expect(payload).toMatchObject({ vertical: 'venue', channel: 'whatsapp', origin: 'bar' });
        expect(AnalyticsEventSchemas.listing_contact_clicked.safeParse(payload).success).toBe(true);
    });

    it('a channel-only Consultar opens the panel without reporting a channel', () => {
        const clearReady = markListingContactPanelReady({ panelId: experience.panelId });
        try {
            render(<ListingActionBarButtons {...experience} />);
            fireEvent.click(screen.getByRole('link', { name: 'Consultar' }));

            expect(trackEvent).not.toHaveBeenCalled();
        } finally {
            act(clearReady);
        }
    });

    it('Favorito emits favorite_added with origin bar', async () => {
        readCachedAuthMe.mockReturnValue(signedIn());
        render(<ListingActionBarButtons {...accommodation} />);

        const favorite = await screen.findByRole('button', { name: 'Guardar en favoritos' });
        await waitFor(() => expect(favorite).not.toBeDisabled());
        fireEvent.click(favorite);

        await waitFor(() => expect(lastPayload('favorite_added')).toBeDefined());
        expect(trackEvent.mock.calls.filter(([name]) => name === 'favorite_added')).toHaveLength(1);
        const payload = lastPayload('favorite_added');
        expect(payload).toMatchObject({
            entity_id: 'acc-1',
            entity_type: 'ACCOMMODATION',
            origin: 'bar'
        });
        expect(AnalyticsEventSchemas.favorite_added.safeParse(payload).success).toBe(true);
    });

    it('Compartir emits listing_shared with origin bar after a native share', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { ...navigator, share });
        const width = window.innerWidth;
        window.innerWidth = 390;
        try {
            render(<ListingActionBarButtons {...accommodation} />);
            fireEvent.click(screen.getByRole('button', { name: 'Compartir' }));

            await waitFor(() => expect(lastPayload('listing_shared')).toBeDefined());
            expect(trackEvent).toHaveBeenCalledTimes(1);
            const payload = lastPayload('listing_shared');
            expect(payload).toEqual({
                listing_id: 'acc-1',
                vertical: 'accommodation',
                origin: 'bar',
                method: 'native',
                locale: 'es'
            });
            expect(AnalyticsEventSchemas.listing_shared.safeParse(payload).success).toBe(true);
        } finally {
            window.innerWidth = width;
        }
    });
});

describe('ListingActionBarButtons: favorite sync (AC-36)', () => {
    it('toggling the bar heart updates the gallery heart of the same entity without a reload', async () => {
        readCachedAuthMe.mockReturnValue(signedIn());
        render(
            <>
                <div data-testid="gallery">
                    <FavoriteButton
                        entityId="acc-1"
                        entityType="ACCOMMODATION"
                        locale="es"
                        origin="gallery"
                    />
                </div>
                <div data-testid="bar">
                    <ListingActionBarButtons {...accommodation} />
                </div>
            </>
        );

        const gallery = within(screen.getByTestId('gallery')).getByRole('button');
        const bar = await within(screen.getByTestId('bar')).findByRole('button', {
            name: 'Guardar en favoritos'
        });
        await waitFor(() => expect(bar).not.toBeDisabled());
        expect(gallery).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(bar);

        await waitFor(() => expect(gallery).toHaveAttribute('aria-pressed', 'true'));
        expect(bar).toHaveAttribute('aria-pressed', 'true');
        expect(bar).toHaveAccessibleName('Quitar de favoritos');
    });
});
