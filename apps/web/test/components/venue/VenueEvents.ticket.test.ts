/**
 * @file VenueEvents.ticket.test.ts
 * @description Source-read test (HOS-2255): the «Comprar entrada» button of a
 * venue event is rendered only from a safe https URL, opens in a new tab with
 * `rel="noopener nofollow"`, and is tracked through the shared interaction
 * attributes. `.astro` cannot be rendered in Vitest, so the source is asserted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSafeExternalUrl } from '../../../src/lib/safe-external-url';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueEvents.astro'),
    'utf8'
);
const anchor = source.slice(source.indexOf('<a\n'), source.indexOf('</a>'));

describe('VenueEvents ticket button (HOS-2255)', () => {
    it('renders the anchor only when a safe href resolved', () => {
        expect(source).toContain('{ticketHref && (');
        expect(source).toContain('resolveSafeExternalUrl(event.ticketUrl)');
    });

    it('opens in a new tab with noopener and nofollow', () => {
        expect(anchor).toContain('href={ticketHref}');
        expect(anchor).toContain('target="_blank"');
        expect(anchor).toContain('rel="noopener nofollow"');
    });

    it('carries the tracker attributes of the shared interaction beacon', () => {
        expect(anchor).toContain('data-interaction-kind="TICKET_CLICK"');
        expect(anchor).toContain('data-interaction-event-id={event.id}');
    });

    it('takes its label from the translated key', () => {
        expect(source).toContain("t('venue.detail.venueEvents.buyTicket'");
    });

    it('never emits a javascript: link (the resolver drops it)', () => {
        expect(resolveSafeExternalUrl('javascript:alert(1)')).toBeUndefined();
    });
});
