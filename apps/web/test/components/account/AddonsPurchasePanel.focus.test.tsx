/**
 * @file AddonsPurchasePanel.focus.test.tsx
 * @description RTL tests for the add-on focus behaviour (HOS-729).
 *
 * The decision is "focus without hiding", so the assertions are deliberately
 * built around the RENDERED DOM rather than the component source: every case
 * checks BOTH that the focused card moved to the front AND that the full
 * catalog is still on the page. A test that only checked the first card would
 * stay green if focus silently became a hard filter — which is the exact
 * outcome the owner rejected.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AddonCardData } from '../../../src/components/account/AddonsPurchasePanel.client';
import { AddonsPurchasePanel } from '../../../src/components/account/AddonsPurchasePanel.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/AddonsPurchasePanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

/**
 * Only the keys whose exact copy a test asserts on. Everything else resolves
 * to the fallback the component passes, which is what the real locale files
 * contain anyway.
 */
const TRANSLATIONS: Record<string, string> = {
    'account.addons.focus.headings.extra-accommodations-5': 'Para publicar más alojamientos',
    'account.addons.focus.headings.fallback': 'El complemento que estabas buscando',
    'account.addons.focus.others': 'Otros complementos',
    'account.addons.groups.perAccommodation': 'Por alojamiento',
    'account.addons.groups.account': 'De cuenta'
};

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string => {
        const raw = TRANSLATIONS[key] ?? fallback ?? key;
        if (!params) return raw;
        return Object.keys(params).reduce(
            (acc, k) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(params[k])),
            raw
        );
    };
    const tPlural = (key: string, count: number, params?: Record<string, unknown>): string =>
        t(`${key}_${count === 1 ? 'one' : 'other'}`, undefined, { ...params, count });
    return { createT: () => t, createTranslations: () => ({ t, tPlural }) };
});

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    billingApi: { purchaseAddon: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: ({ fallback }: { fallback?: string }) => fallback ?? 'error'
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAddon(overrides: Partial<AddonCardData> & { slug: string }): AddonCardData {
    return {
        name: `Name of ${overrides.slug}`,
        description: `Description of ${overrides.slug}`,
        billingType: 'one_time',
        priceArs: 150000,
        durationDays: null,
        affectsLimitKey: null,
        limitIncrease: null,
        grantsEntitlement: null,
        targetCategories: ['owner'],
        isActive: true,
        sortOrder: 1,
        requiresAccommodationTarget: false,
        ...overrides
    };
}

/**
 * Natural (unfocused) order is per-accommodation first, then account-level:
 * `visibility-boost-7d`, `extra-photos-20`, `extra-accommodations-5`,
 * `mystery-addon`. Focusing anything but the first is therefore a real
 * reordering, not a coincidence.
 */
const CATALOG: readonly AddonCardData[] = [
    makeAddon({ slug: 'extra-photos-20' }),
    makeAddon({ slug: 'visibility-boost-7d', requiresAccommodationTarget: true, durationDays: 7 }),
    makeAddon({ slug: 'extra-accommodations-5' }),
    makeAddon({ slug: 'mystery-addon' })
];

const ALL_SLUGS = CATALOG.map((addon) => addon.slug);

const ACCOMMODATIONS = [{ id: 'acc-1', name: 'Cabaña del Río' }];

/** Slugs of the rendered cards, in DOM order. */
function renderedSlugsInOrder(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[data-testid^="addon-card-"]')].map((card) =>
        (card.getAttribute('data-testid') ?? '').replace('addon-card-', '')
    );
}

function renderPanel(focusSlug?: string | null) {
    return render(
        <AddonsPurchasePanel
            locale="es"
            addons={CATALOG}
            ownedAddonSlugs={[]}
            accommodations={ACCOMMODATIONS}
            focusSlug={focusSlug}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddonsPurchasePanel — focus (HOS-729)', () => {
    describe('when the focus slug matches a card', () => {
        it('renders the focused card first, in the rendered DOM', () => {
            const { container } = renderPanel('extra-accommodations-5');

            expect(renderedSlugsInOrder(container)[0]).toBe('extra-accommodations-5');
        });

        it('renders the contextual heading naming the user problem', () => {
            renderPanel('extra-accommodations-5');

            expect(
                screen.getByRole('heading', { name: 'Para publicar más alojamientos' })
            ).toBeInTheDocument();
        });

        it('puts the contextual heading before the focused card in the DOM', () => {
            const { container } = renderPanel('extra-accommodations-5');

            const heading = screen.getByRole('heading', { name: 'Para publicar más alojamientos' });
            const card = container.querySelector(
                '[data-testid="addon-card-extra-accommodations-5"]'
            );

            expect(card).not.toBeNull();
            // Node.DOCUMENT_POSITION_FOLLOWING === 4
            expect(heading.compareDocumentPosition(card as Node) & 4).toBe(4);
        });

        it('marks only the focused card as focused', () => {
            const { container } = renderPanel('extra-accommodations-5');

            const focusedCards = [...container.querySelectorAll('[data-focused="true"]')].map(
                (card) => card.getAttribute('data-testid')
            );

            expect(focusedCards).toEqual(['addon-card-extra-accommodations-5']);
        });

        it('KEEPS every other add-on on the page, under "Otros complementos"', () => {
            const { container } = renderPanel('extra-accommodations-5');

            expect(renderedSlugsInOrder(container).sort()).toEqual([...ALL_SLUGS].sort());
            expect(screen.getByRole('heading', { name: 'Otros complementos' })).toBeInTheDocument();
        });

        it('keeps every other card buyable (the buy buttons are still rendered)', () => {
            renderPanel('extra-accommodations-5');

            for (const slug of ALL_SLUGS) {
                expect(screen.getByTestId(`addon-buy-button-${slug}`)).toBeInTheDocument();
            }
        });

        it('falls back to the generic heading for a slug with no specific copy', () => {
            renderPanel('mystery-addon');

            expect(
                screen.getByRole('heading', { name: 'El complemento que estabas buscando' })
            ).toBeInTheDocument();
            expect(
                screen.queryByRole('heading', { name: 'Para publicar más alojamientos' })
            ).not.toBeInTheDocument();
        });
    });

    describe('when the focus slug matches nothing', () => {
        it('degrades to the normal render with no contextual heading', () => {
            renderPanel('not-a-real-slug');

            expect(screen.queryByTestId('addon-focus-group')).not.toBeInTheDocument();
            expect(
                screen.queryByRole('heading', { name: 'Otros complementos' })
            ).not.toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Por alojamiento' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'De cuenta' })).toBeInTheDocument();
        });

        it('still shows the whole catalog', () => {
            const { container } = renderPanel('not-a-real-slug');

            expect(renderedSlugsInOrder(container).sort()).toEqual([...ALL_SLUGS].sort());
        });

        it('marks no card as focused', () => {
            const { container } = renderPanel('not-a-real-slug');

            expect(container.querySelectorAll('[data-focused="true"]')).toHaveLength(0);
        });
    });

    describe('without a focus slug', () => {
        it('renders the two original groups in their original order', () => {
            const { container } = renderPanel(null);

            expect(renderedSlugsInOrder(container)).toEqual([
                'visibility-boost-7d',
                'extra-photos-20',
                'extra-accommodations-5',
                'mystery-addon'
            ]);
            expect(screen.getByRole('heading', { name: 'Por alojamiento' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'De cuenta' })).toBeInTheDocument();
        });

        it('shows the whole catalog and no focus chrome', () => {
            const { container } = renderPanel(undefined);

            expect(renderedSlugsInOrder(container).sort()).toEqual([...ALL_SLUGS].sort());
            expect(screen.queryByTestId('addon-focus-group')).not.toBeInTheDocument();
            expect(screen.queryByTestId('addon-others-group')).not.toBeInTheDocument();
            expect(container.querySelectorAll('[data-focused="true"]')).toHaveLength(0);
        });
    });

    it('never hides a card, whatever the focus slug is', () => {
        for (const focusSlug of [...ALL_SLUGS, 'garbage', null, undefined]) {
            const { container, unmount } = renderPanel(focusSlug);

            expect(renderedSlugsInOrder(container).sort()).toEqual([...ALL_SLUGS].sort());

            unmount();
        }
    });
});
