/**
 * @file hos2667-visual-bugs.test.tsx
 * @description Regression tests for the visual bugs found in the public-web
 * smoke (HOS-2667). Style fixes are pinned as source contracts, the house style
 * for CSS that jsdom cannot lay out; the behaviour fixes render for real.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');
const i18n = (locale: string, file: string) =>
    JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/${file}.json`),
            'utf8'
        )
    );

const mockStore = vi.hoisted(() => ({ value: { ids: [] as string[] } }));
vi.mock('@/store/compare-store', () => ({ useCompareStore: () => mockStore.value }));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

describe('HOS-2667 FAQ accordion', () => {
    const accordion = source('components/shared/ui/FaqAccordion.astro');

    it('hides the inactive icon with a rule that outranks `summary span`', () => {
        // `summary span { display: inline-flex }` beat the bare `.faq-minus` rule,
        // so «+» and «—» showed together on every question.
        expect(accordion).toMatch(
            /summary \.faq-minus,\s*details\[open\] summary \.faq-plus \{ display: none; \}/
        );
        expect(accordion).toMatch(
            /details\[open\] summary \.faq-minus \{ display: inline-flex; \}/
        );
    });

    it('sizes the block title like a section h2, not like the category h3', () => {
        expect(accordion).toMatch(/\.faq-accordion > h2 \{[^}]*font-size: 1\.5rem/);
    });

    it.each(['es', 'en', 'pt'])('gives the FAQ search field a placeholder in %s', (locale) => {
        expect(i18n(locale, 'faq').search.placeholder).toEqual(expect.any(String));
        expect(source('pages/[lang]/preguntas-frecuentes/index.astro')).toContain(
            "placeholder={t('faq.search.placeholder')}"
        );
    });
});

describe('HOS-2667 comparison', async () => {
    const { CompareCount } = await import('@/components/shared/compare/CompareCount.client');

    it('shows no «Comparás N» label while the matrix is empty (one item)', () => {
        mockStore.value = { ids: ['a'] };
        const { container } = render(<CompareCount locale="es" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the label once two items make a comparison', () => {
        mockStore.value = { ids: ['a', 'b'] };
        render(<CompareCount locale="es" />);
        expect(screen.getByText('accommodations.comparison.page.count:2')).toBeTruthy();
    });

    it('shares one minimum between label, matrix and bar', () => {
        for (const file of ['CompareCount', 'ComparisonMatrix', 'CompareBar']) {
            expect(source(`components/shared/compare/${file}.client.tsx`)).toContain(
                "import { MIN_TO_COMPARE } from '@/store/compare-limits'"
            );
        }
    });
});

describe('HOS-2667 navigation and buttons', () => {
    it('draws a chevron, not an ellipsis, on the mobile «Publicar» button', () => {
        const menu = source('components/shared/navigation/MobileMenuAccountSection.client.tsx');
        expect(menu).not.toContain('>…</span>');
        expect(menu).toContain('<ChevronDownIcon');
        expect(source('components/shared/navigation/MobileMenu.module.css')).toMatch(
            /\.ctaChevronOpen \{[^}]*rotate\(180deg\)/
        );
    });

    it('does not paint the partner «Sitio web» button with the link colour', () => {
        const page = source('pages/[lang]/partners/[slug].astro');
        expect(page).not.toMatch(/\.partner__website a[,\s{]/);
    });

    it('keeps the sort select and its button on one row', () => {
        const sort = source('components/shared/layout/ListingSort.astro');
        expect(sort).toMatch(/\.listing-sort \{ flex-wrap: nowrap; \}/);
        expect(sort).toMatch(/button \{ flex: none; white-space: nowrap; \}/);
    });

    it('lets the guest AI chat panel size to its content', () => {
        expect(source('components/accommodation/AiChatWidget.tsx')).toContain(
            'isGuest ? styles.panelGuest'
        );
        expect(source('components/accommodation/AiChatWidget.module.css')).toMatch(
            /\.panelGuest,\s*\.panelExpanded\.panelGuest \{\s*height: auto;/
        );
    });

    it('draws the benefits list of the compare action as a plain centred stack', () => {
        const css = source('components/billing/TouristPlanAction.module.css');
        expect(css).toMatch(/\.benefits \{[^}]*list-style: none/);
        expect(source('components/billing/TouristPlanAction.client.tsx')).toContain(
            'className={styles.benefits}'
        );
    });
});

describe('HOS-2667 cards', () => {
    const footer = source('components/shared/cards/CardPriceFooter.astro');

    it('keeps the amount and its unit on one line and reserves room for both footers', () => {
        expect(footer).toContain('card-price-footer__amount');
        expect(footer).toMatch(/\.card-price-footer__amount \{ display: flex; flex-wrap: wrap;/);
        expect(footer).toMatch(/grid-template-rows: minmax\(2\.8rem, auto\) auto/);
    });

    it('keeps a promotion pill at its natural width and lets its row wrap', () => {
        expect(source('components/shared/cards/CardPromotionPills.astro')).toMatch(
            /promotion-pill\) \{[^}]*flex-shrink: 0/
        );
        expect(source('components/venue/VenueCard.css')).toMatch(
            /\.venue-card__category-row \{[^}]*flex-wrap: wrap/
        );
    });

    it('hangs the vertical event card content from the photo', () => {
        const css = source('components/shared/cards/EventCardHorizontal.css');
        const vertical = css.slice(css.indexOf('@container event-card-h (max-width: 500px)'));
        expect(vertical).toMatch(/\.event-card-h__content \{[^}]*justify-content: flex-start/);
    });

    it('places the favorite quota inside its dock button instead of stacking it over the label', () => {
        expect(source('components/listing/contact/ListingActionBarButtons.module.css')).toMatch(
            /\[data-action="favorite"\] > div > span\[aria-hidden="true"\][^{]*\{[^}]*position: absolute/
        );
    });
});

describe('HOS-2667 price alert and promotions', () => {
    it('wraps the active alert description in a card', () => {
        expect(source('components/accommodation/PriceAlertButton.tsx')).toContain(
            'styles.priceAlertStatus'
        );
        expect(source('components/accommodation/PriceAlertButton.module.css')).toMatch(
            /\.priceAlertStatus \{[^}]*border: 1px solid/
        );
    });

    it('spaces the visible count, the guest prompt and the actions', () => {
        const css = source('components/promotions/PromotionCards.module.css');
        expect(css).toMatch(/\.status \{[^}]*flex-direction: column;[^}]*gap:/);
        expect(css).toContain('.statusActions');
        expect(source('components/promotions/PromotionsListing.client.tsx')).toContain(
            'styles.statusActions'
        );
    });
});

describe('HOS-2667 standalone and legal pages', () => {
    it('centres the claim page content and its icon', () => {
        expect(source('pages/[lang]/partners/reclamar/index.astro')).toMatch(
            /\.partner-claim-page \{[^}]*align-items: center/
        );
        expect(source('components/shared/StatusActions.module.css')).toMatch(
            /\.statusIcon \{[^}]*margin-inline: auto/
        );
    });

    it('styles the legal table of contents and the back-to-index link', () => {
        const layout = source('layouts/LegalLayout.astro');
        expect(layout).toMatch(/\.legal-toc a \{[^}]*text-decoration: none/);
        expect(layout).toMatch(/\.legal-toc-return a,[\s\S]*?color: var\(--brand-primary-link\)/);
    });

    it.each(['es', 'en', 'pt'])('numbers every cookies section in order in %s', (locale) => {
        const titles = Object.values(
            i18n(locale, 'cookies').sections as Record<string, { title: string }>
        ).map(({ title }) => title);
        for (const [index, title] of titles.entries()) {
            expect(title.startsWith(`${index + 1}. `)).toBe(true);
        }
    });
});
