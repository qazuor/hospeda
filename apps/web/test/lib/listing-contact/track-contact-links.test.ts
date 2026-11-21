// @vitest-environment jsdom

import { AnalyticsEventSchemas } from '@repo/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '@/lib/analytics/umami-client';
import { initContactLinkTracking } from '@/lib/listing-contact/track-contact-links';

vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));

const payload = {
    channel: 'phone',
    vertical: 'accommodation',
    listing_id: 'listing-123',
    origin: 'contact_block',
    locale: 'pt'
};

describe('delegated contact clicks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.documentElement.dataset.locale = 'pt';
        document.body.replaceChildren();
        initContactLinkTracking({ document });
    });

    it.each([
        ['phone', 'accommodation'],
        ['email', 'partner'],
        ['website', 'experience'],
        ['menu', 'venue'],
        ['social', 'venue']
    ])('tracks a %s link added after initialization on %s', (channel, vertical) => {
        document.body.innerHTML = `<a href="#contact" data-contact-channel="${channel}" data-vertical="${vertical}" data-listing-id="listing-123" data-contact-origin="contact_block"><span>Contact</span></a>`;
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });

        document.querySelector('span')?.dispatchEvent(click);

        const expected = { ...payload, channel, vertical };
        expect(AnalyticsEventSchemas.listing_contact_clicked.safeParse(expected).success).toBe(
            true
        );
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith('listing_contact_clicked', expected);
        expect(click.defaultPrevented).toBe(false);
    });

    it('installs only one click listener and uses the current page locale after a swap', () => {
        const page = document.implementation.createHTMLDocument();
        const addListener = vi.spyOn(page, 'addEventListener');
        page.documentElement.dataset.locale = 'es';
        initContactLinkTracking({ document: page });
        initContactLinkTracking({ document: page });

        page.documentElement.dataset.locale = 'pt';
        page.body.innerHTML =
            '<a href="#contact" data-contact-channel="phone" data-vertical="accommodation" data-listing-id="listing-123" data-contact-origin="contact_block">Contact</a>';
        page.querySelector('a')?.click();

        expect(addListener.mock.calls.filter(([type]) => type === 'click')).toHaveLength(1);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith('listing_contact_clicked', payload);
    });

    it.each([
        [
            'button',
            'href="#contact" data-contact-channel="phone"',
            'listing-123',
            'venue',
            'contact_block'
        ],
        ['a', 'href="#contact"', 'listing-123', 'venue', 'contact_block'],
        ['a', 'data-contact-channel="phone"', 'listing-123', 'venue', 'contact_block'],
        [
            'a',
            'href="#contact" data-contact-channel="fax"',
            'listing-123',
            'venue',
            'contact_block'
        ],
        ['a', 'href="#contact" data-contact-channel="phone"', ' ', 'venue', 'contact_block'],
        [
            'a',
            'href="#contact" data-contact-channel="phone"',
            'listing-123',
            'event',
            'contact_block'
        ],
        ['a', 'href="#contact" data-contact-channel="phone"', 'listing-123', 'venue', '']
    ])('ignores invalid contact markup (%s %s / %s / %s / %s)', (tag, attrs, id, vertical, origin) => {
        document.body.innerHTML = `<${tag} ${attrs} data-vertical="${vertical}" data-listing-id="${id}" data-contact-origin="${origin}">Contact</${tag}>`;

        document.body.firstElementChild?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(trackEvent).not.toHaveBeenCalled();
    });
});
