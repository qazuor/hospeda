import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ContactOriginSchema,
    onListingContactPanelOpen,
    openListingContactPanel
} from '../../../src/lib/listing-contact/listing-contact-events';

const eventName = 'hospeda:listing-contact:open';
let unsubscribe: (() => void) | undefined;
afterEach(() => {
    unsubscribe?.();
});

describe('listing contact events', () => {
    it('exposes the supported origins and dispatches the window protocol with optional focus', () => {
        const handler = vi.fn();
        unsubscribe = onListingContactPanelOpen(handler);
        const payload = { origin: 'bar', focus: 'whatsapp' } as const;

        openListingContactPanel(payload);
        window.dispatchEvent(new CustomEvent(eventName, { detail: { origin: 'gallery' } }));

        expect(ContactOriginSchema.options).toEqual([
            'bar',
            'panel',
            'summary',
            'sidebar',
            'contact_block',
            'gallery'
        ]);
        expect(handler.mock.calls).toEqual([[payload], [{ origin: 'gallery' }]]);
    });

    it('only broadcasts valid outgoing requests', () => {
        const listener = vi.fn();
        window.addEventListener(eventName, listener);
        const invalid = JSON.parse('{"origin":"bar","focus":"phone"}') as Parameters<
            typeof openListingContactPanel
        >[0];

        try {
            openListingContactPanel(invalid);
            expect(listener).not.toHaveBeenCalled();

            openListingContactPanel({ origin: 'bar', focus: 'form' });
            expect(listener).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ detail: { origin: 'bar', focus: 'form' } })
            );
        } finally {
            window.removeEventListener(eventName, listener);
        }
    });

    it('ignores malformed origin, focus and non-custom events', () => {
        const handler = vi.fn();
        unsubscribe = onListingContactPanelOpen(handler);
        const invalidOrigin = { origin: 'elsewhere', focus: 'form' };
        const invalidFocus = { origin: 'bar', focus: 'phone' };

        window.dispatchEvent(new CustomEvent(eventName, { detail: invalidOrigin }));
        window.dispatchEvent(new CustomEvent(eventName, { detail: invalidFocus }));
        window.dispatchEvent(new Event(eventName));

        expect(handler).not.toHaveBeenCalled();
    });

    it('stops delivery after unsubscribe', () => {
        const handler = vi.fn();
        const stop = onListingContactPanelOpen(handler);

        stop();
        openListingContactPanel({ origin: 'sidebar', focus: 'form' });

        expect(handler).not.toHaveBeenCalled();
    });
});
