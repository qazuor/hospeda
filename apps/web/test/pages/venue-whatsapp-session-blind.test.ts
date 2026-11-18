/**
 * @file venue-whatsapp-session-blind.test.ts
 * @description Source-read guard for the venue WhatsApp button (HOS-2256,
 * AC-19, AC-20): the venue page and its WhatsApp wrapper never read the
 * session, the number is never read off `contactInfo`, and the island is the
 * only place that talks to the protected endpoint.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string =>
    readFileSync(resolve(__dirname, '../../src', relativePath), 'utf8');

const PAGE = read('pages/[lang]/comer-y-salir/[slug].astro');
const WRAPPER = read('components/venue/VenueWhatsAppContact.astro');
const ISLAND = read('components/venue/VenueWhatsAppButton.client.tsx');
const CONTACT_BLOCK = read('components/venue/VenueContactBlock.astro');

describe('venue WhatsApp button stays session-blind (AC-19)', () => {
    it.each([
        ['page', PAGE],
        ['wrapper', WRAPPER]
    ])('the %s never reads the session', (_name, source) => {
        expect(source).not.toMatch(/Astro\.locals\.(user|session)/);
        expect(source).not.toMatch(/getSession|Astro\.cookies|Astro\.request\.headers/);
    });

    it('mounts the island with client:idle from the wrapper', () => {
        expect(WRAPPER).toMatch(/<VenueWhatsAppButton\s+client:idle/);
    });

    it('the island, not the page, asks the protected endpoint', () => {
        expect(ISLAND).toContain('protectedVenuesApi.getWhatsApp');
        expect(PAGE).not.toContain('getWhatsApp');
        expect(WRAPPER).not.toContain('getWhatsApp');
    });
});

describe('the WhatsApp number never rides contactInfo (AC-20)', () => {
    it('the contact block does not read whatsapp off contactInfo or social networks', () => {
        expect(CONTACT_BLOCK).not.toMatch(/contactInfo\??\.whatsapp/);
        expect(CONTACT_BLOCK).not.toMatch(/socialNetworks\??\.whatsapp/);
    });

    it('only the resolved wa.me link carries the tracked attribute, never the sign-in link', () => {
        const signIn = ISLAND.slice(ISLAND.indexOf('href={signInHref}'), ISLAND.indexOf('loading'));
        expect(signIn).not.toContain('data-interaction-kind');
        const code = ISLAND.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code.match(/data-interaction-kind="WHATSAPP_CLICK"/g)).toHaveLength(1);
    });
});
