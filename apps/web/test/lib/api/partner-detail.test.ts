/**
 * HOS-294 T-016 / T-017 — the partner detail client call and its transform.
 *
 * The transform assertions all target one property: what the detail page is
 * allowed to know. `tier` decides whether the page exists at all, and that
 * decision is already made by the API before the payload arrives — so carrying
 * it into the props would only invite someone to render it.
 *
 * @module test/lib/api/partner-detail
 */

import { describe, expect, it } from 'vitest';
import { toPartnerDetailProps } from '../../../src/lib/api/transforms';

/** A payload shaped like `PartnerPublicSchema` after HOS-294 D-5. */
const apiPayload = {
    id: 'p1',
    slug: 'acme-litoral',
    name: 'Acme Litoral',
    description: 'Excursiones por el Litoral.',
    type: 'commerce',
    tier: 'gold',
    logoUrl: 'https://cdn.example.com/acme.png',
    websiteUrl: 'https://acme.example.com',
    lifecycleState: 'ACTIVE',
    subscriptionStatus: 'active',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: null,
    contactInfo: { workEmail: 'hola@acme.com' },
    socialNetworks: { instagram: 'https://instagram.com/acme' }
};

describe('toPartnerDetailProps', () => {
    it('maps the fields the page renders', () => {
        // Arrange / Act
        const props = toPartnerDetailProps({ item: apiPayload });

        // Assert
        expect(props.slug).toBe('acme-litoral');
        expect(props.name).toBe('Acme Litoral');
        expect(props.type).toBe('commerce');
        expect(props.description).toBe('Excursiones por el Litoral.');
        expect(props.logoUrl).toBe('https://cdn.example.com/acme.png');
        expect(props.websiteUrl).toBe('https://acme.example.com');
        expect(props.contactInfo).toEqual({ workEmail: 'hola@acme.com' });
        expect(props.socialNetworks).toEqual({ instagram: 'https://instagram.com/acme' });
    });

    it('never carries the tier into the page props', () => {
        // Arrange / Act — the payload HAS a tier; the props must not.
        const props = toPartnerDetailProps({ item: apiPayload });

        // Assert
        expect(apiPayload.tier).toBe('gold');
        expect(props).not.toHaveProperty('tier');
    });

    it('does not carry the directory-era fields either', () => {
        // Arrange / Act
        const props = toPartnerDetailProps({
            item: { ...apiPayload, isFeatured: true }
        });

        // Assert — `isFeatured` and the subscription window belonged to the
        // retired card, not to a business card.
        expect(props).not.toHaveProperty('isFeatured');
        expect(props).not.toHaveProperty('startsAt');
        expect(props).not.toHaveProperty('endsAt');
    });

    it('degrades every optional field to null rather than to "undefined"', () => {
        // Arrange — a partner with nothing filled in beyond identity. Coercing
        // a missing value with String() would render the literal text
        // "undefined" on a public page.
        const props = toPartnerDetailProps({
            item: { slug: 'bare', name: 'Bare', type: 'ngo' }
        });

        // Assert
        expect(props.description).toBeNull();
        expect(props.logoUrl).toBeNull();
        expect(props.websiteUrl).toBeNull();
        expect(props.contactInfo).toBeNull();
        expect(props.socialNetworks).toBeNull();
    });

    it('resolves a localized name when the payload carries one', () => {
        // Arrange
        const props = toPartnerDetailProps({
            item: { ...apiPayload, nameI18n: { es: 'Acme Litoral', en: 'Acme Coast' } },
            locale: 'en'
        });

        // Assert
        expect(props.name).toBe('Acme Coast');
    });
});
