/**
 * @file FeaturedToggleSection.test.tsx
 * @description RTL tests for the featured section's three states (HOS-728).
 *
 * The section used to gate on `isLoading || !hasEntitlement` and return `null`
 * for both, which is why the two visibility add-ons had no discovery path at
 * all. That single condition is now two branches, so the four combinations of
 * (in flight, entitled) are exercised separately — a suite that only checked
 * "entitled renders / not entitled renders nothing" would stay green with the
 * bug back in place.
 *
 * Everything is asserted on the RENDERED DOM, never on the component source:
 * mounting is not rendering, and a `toMatch` over a source file is vacuous.
 *
 * `@/lib/i18n` is deliberately NOT mocked. `test/setup.ts` seeds
 * `window.__HOSPEDA_I18N__` with the real catalog, so the copy assertions here
 * read the shipped `account.json` strings rather than the fallbacks the
 * component happens to pass — which is the point: the scope sentence is the
 * part of this fix that stops a host with five listings from buying one boost
 * and feeling cheated.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturedToggleSection } from '../../../../src/components/host/editor/FeaturedToggleSection.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../../src/components/host/editor/FeaturedToggleSection.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const getFeaturedEntitlement = vi.fn();
const setFeaturedToggle = vi.fn();

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    accommodationEditApi: {
        getFeaturedEntitlement: (args: { readonly id: string }) => getFeaturedEntitlement(args),
        setFeaturedToggle: (args: { readonly id: string; readonly isFeatured: boolean }) =>
            setFeaturedToggle(args)
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACC_ID = '11111111-1111-4111-8111-111111111111';

/** A promise the test resolves by hand, to hold the component in `isLoading`. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

function entitlementOk({
    hasEntitlement,
    isFeatured = false
}: {
    readonly hasEntitlement: boolean;
    readonly isFeatured?: boolean;
}) {
    return { ok: true as const, data: { hasEntitlement, isFeatured } };
}

/** The offer's two links, in DOM order. */
function offerLinks(): readonly HTMLAnchorElement[] {
    const offer = screen.getByTestId('featured-addon-offer');
    return Array.from(offer.querySelectorAll('a[data-addon-slug]'));
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── The four combinations of (in flight, entitled) ───────────────────────────

describe('FeaturedToggleSection — entitlement gate', () => {
    it('renders NOTHING while the entitlement check is in flight (offer must not flash)', async () => {
        const gate = deferred<ReturnType<typeof entitlementOk>>();
        getFeaturedEntitlement.mockReturnValue(gate.promise);

        const { container } = render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        // The fetch is issued from an effect through a dynamic import; give the
        // microtask queue a turn so "nothing rendered" cannot be an artifact of
        // the effect not having run yet.
        await waitFor(() => {
            expect(getFeaturedEntitlement).toHaveBeenCalledWith({ id: ACC_ID });
        });

        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByTestId('featured-addon-offer')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

        // Same assertion for the in-flight-and-entitled combination: the answer
        // being "yes" changes nothing until it actually arrives.
        gate.resolve(entitlementOk({ hasEntitlement: true }));
        await waitFor(() => {
            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });
    });

    it('renders the real toggle, and NO offer, when the owner is entitled', async () => {
        getFeaturedEntitlement.mockResolvedValue(
            entitlementOk({ hasEntitlement: true, isFeatured: true })
        );

        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        const toggle = await screen.findByRole('checkbox');
        expect(toggle).toBeChecked();
        expect(screen.queryByTestId('featured-addon-offer')).not.toBeInTheDocument();
    });

    it('renders the offer, and NO toggle, when the owner is not entitled', async () => {
        getFeaturedEntitlement.mockResolvedValue(entitlementOk({ hasEntitlement: false }));

        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        await screen.findByTestId('featured-addon-offer');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('renders the offer when the entitlement check fails (a pitch grants nothing)', async () => {
        getFeaturedEntitlement.mockRejectedValue(new Error('network down'));

        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );

        await screen.findByTestId('featured-addon-offer');
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
});

// ─── What the offer actually offers ───────────────────────────────────────────

describe('FeaturedToggleSection — the add-on offer', () => {
    beforeEach(() => {
        getFeaturedEntitlement.mockResolvedValue(entitlementOk({ hasEntitlement: false }));
    });

    it('offers BOTH visibility add-ons, each linked to its focus URL', async () => {
        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByTestId('featured-addon-offer');

        const links = offerLinks();
        expect(links).toHaveLength(2);

        // Slugs and hrefs written out by hand: reusing the module's own
        // constants would make this blind to what they contain.
        expect(links[0]?.dataset.addonSlug).toBe('visibility-boost-7d');
        expect(links[0]?.getAttribute('href')).toBe(
            '/es/mi-cuenta/addons/?focus=visibility-boost-7d#addon-visibility-boost-7d'
        );
        expect(links[1]?.dataset.addonSlug).toBe('visibility-boost-30d');
        expect(links[1]?.getAttribute('href')).toBe(
            '/es/mi-cuenta/addons/?focus=visibility-boost-30d#addon-visibility-boost-30d'
        );
    });

    it('names each add-on with its localized catalog name', async () => {
        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByTestId('featured-addon-offer');

        const links = offerLinks();
        expect(links[0]?.textContent).toContain('Impulso de visibilidad (7 días)');
        expect(links[1]?.textContent).toContain('Impulso de visibilidad (30 días)');
    });

    it('keeps the locale segment when the host browses in another language', async () => {
        render(
            <FeaturedToggleSection
                locale="en"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByTestId('featured-addon-offer');

        for (const link of offerLinks()) {
            expect(link.getAttribute('href')).toMatch(/^\/en\/mi-cuenta\/addons\/\?focus=/);
        }
    });

    it('is a labelled region with a heading, not an unlabelled block', async () => {
        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const offer = await screen.findByTestId('featured-addon-offer');

        const headingId = offer.getAttribute('aria-labelledby');
        expect(headingId).toBeTruthy();
        expect(offer.querySelector(`#${headingId}`)?.textContent).toBe('Destacá este alojamiento');
    });
});

// ─── The scope copy: this listing, not the account ────────────────────────────

describe('FeaturedToggleSection — scope copy', () => {
    beforeEach(() => {
        getFeaturedEntitlement.mockResolvedValue(entitlementOk({ hasEntitlement: false }));
    });

    /**
     * An add-on grant features ONE accommodation
     * (`featured_listing_addon_grants`), unlike a plan grant, which is
     * owner-wide. If the offer stops saying so, a host with several listings
     * buys one boost expecting all of them to light up. These assertions are
     * what make that regression loud.
     */
    it('tells the host, in Spanish, that the boost covers only this listing', async () => {
        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        const offer = await screen.findByTestId('featured-addon-offer');
        const text = offer.textContent ?? '';

        expect(text).toMatch(/solo a esta ficha/i);
        expect(text).toMatch(/cada uno necesita su propio complemento/i);
    });

    it('says the same thing in English', async () => {
        render(
            <FeaturedToggleSection
                locale="en"
                accommodationId={ACC_ID}
            />
        );
        const offer = await screen.findByTestId('featured-addon-offer');
        const text = offer.textContent ?? '';

        expect(text).toMatch(/this listing only/i);
        expect(text).toMatch(/each one needs its own add-on/i);
    });

    it('says the same thing in Portuguese', async () => {
        render(
            <FeaturedToggleSection
                locale="pt"
                accommodationId={ACC_ID}
            />
        );
        const offer = await screen.findByTestId('featured-addon-offer');
        const text = offer.textContent ?? '';

        expect(text).toMatch(/somente para esta ficha/i);
        expect(text).toMatch(/cada uma precisa do seu próprio complemento/i);
    });

    it('gives each link a screen-reader suffix naming the listing scope', async () => {
        render(
            <FeaturedToggleSection
                locale="es"
                accommodationId={ACC_ID}
            />
        );
        await screen.findByTestId('featured-addon-offer');

        for (const link of offerLinks()) {
            // `.sr-only` text, so it is part of the accessible name rather than
            // an `aria-label` on an element that would never compute one.
            expect(link.querySelector('.sr-only')?.textContent).toContain('para este alojamiento');
        }
    });
});
