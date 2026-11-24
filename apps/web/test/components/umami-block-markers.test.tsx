/**
 * @file umami-block-markers.test.tsx
 * @description The six surfaces the session recorder must never capture carry
 * `data-umami-block` on the outermost element they insert into the document
 * (HOS-2347 §6.6, AC-B1, D-4, D-6).
 *
 * The four React islands are rendered; the feedback modal's portal root is
 * proven in `packages/feedback/test/components/FeedbackModal.root-attributes.test.tsx`
 * and here we assert the host passes the marker. The two `.astro` blocks cannot
 * be rendered by Vitest in this repo, so their outermost element is read from
 * source.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildAuthSnapshot } from '../helpers/auth-session';

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => buildAuthSnapshot({ isAuthenticated: false }),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));
vi.mock('@/lib/analytics/umami-client', () => ({ trackEvent: vi.fn() }));
vi.mock('@/store/accommodation-conversation-store', () => ({
    useAccommodationConversation: () => ({
        conversationId: null,
        hasConversation: false,
        isResolving: false
    })
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedAccommodationsApi: { getWhatsApp: vi.fn() }
}));

import { ContactHost } from '@/components/accommodation/ContactHost.client';
import { WhatsAppContact } from '@/components/accommodation/WhatsAppContact.client';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner.client';
import { UMAMI_BLOCK_ATTRIBUTE } from '@/lib/analytics/recording-block';

const SRC = resolve(import.meta.dirname, '../../src');

/** Every top-level element the render inserted into its container. */
function topLevel(container: HTMLElement): Element[] {
    return [...container.children];
}

beforeAll(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        } as unknown as typeof ResizeObserver;
    }
});

describe('data-umami-block on the six surfaces (HOS-2347 AC-B1)', () => {
    it('1. ContactHost (contact-owner form)', () => {
        const { container } = render(
            <ContactHost
                accommodation={{
                    id: 'acc-001',
                    deletedAt: null,
                    type: 'CABIN',
                    destinationId: 'dest-colon',
                    destinationName: 'Colón',
                    price: 12000,
                    currency: 'ARS',
                    ownerId: 'owner-9'
                }}
                locale="es"
            />
        );

        const roots = topLevel(container);
        expect(roots).toHaveLength(1);
        expect(roots[0]?.getAttribute(UMAMI_BLOCK_ATTRIBUTE)).toBe('');
    });

    it('2. WhatsAppContact', () => {
        const { container } = render(
            <WhatsAppContact
                accommodationId="acc-1"
                accommodationName="Casa del Río"
                plansHref="/es/suscriptores/planes/turistas/"
                locale="es"
            />
        );

        const roots = topLevel(container);
        expect(roots).toHaveLength(1);
        expect(roots[0]?.getAttribute(UMAMI_BLOCK_ATTRIBUTE)).toBe('');
    });

    it('3. CookieConsentBanner (backdrop and dialog)', () => {
        const { container } = render(
            <CookieConsentBanner
                locale="es"
                cookiesPolicyUrl="https://hospeda.com.ar/es/legal/cookies/"
            />
        );

        const roots = topLevel(container);
        expect(roots.length).toBeGreaterThan(0);
        expect(container.querySelector('dialog')).not.toBeNull();
        for (const root of roots) expect(root.getAttribute(UMAMI_BLOCK_ATTRIBUTE)).toBe('');
    });

    it('4. FeedbackHeadlessHost passes the marker to the portaled modal root (D-4)', () => {
        const source = readFileSync(
            resolve(SRC, 'components/feedback/FeedbackHeadlessHost.client.tsx'),
            'utf8'
        );
        expect(source).toMatch(/<FeedbackModal\b[^>]*\brootDataAttributes=\{UMAMI_BLOCK_PROPS\}/s);
        expect(source).toContain("from '@/lib/analytics/recording-block'");
    });

    it('5/6. ListingContactChannels (D-6): the outermost element is a <section> spreading blockProps', () => {
        const source = readFileSync(
            resolve(SRC, 'components/listing/contact/ListingContactChannels.astro'),
            'utf8'
        );
        const template = source
            .split(/^---\s*$/m)
            .slice(2)
            .join('---');
        const firstElement = template.match(/<section[^>]*>/)?.[0] ?? '';
        expect(template.trimStart().startsWith('<section')).toBe(true);
        expect(firstElement).toContain('{...blockProps}');
    });

    it.each([
        ['5. VenueContactBlock', 'components/venue/VenueContactBlock.astro'],
        ['6. ExperienceContactBlock', 'components/experience/ExperienceContactBlock.astro']
    ])('%s (D-6): passes UMAMI_BLOCK_PROPS as the shared block props', (_label, file) => {
        const source = readFileSync(resolve(SRC, file), 'utf8');
        expect(source).toContain('blockProps={UMAMI_BLOCK_PROPS}');
        expect(source).toContain("from '@/lib/analytics/recording-block'");
    });
});
