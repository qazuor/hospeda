/** Source contracts for the public plans hub and its breadcrumb entry points. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEUTRAL_PLANS_PATH, PLANS_INDEX_PATH } from '@/lib/billing/addon-purchase';
import { createTranslations, SUPPORTED_LOCALES } from '@/lib/i18n';
import { resolveLegacyRedirectTarget } from '@/lib/legacy-redirects';
import { breadcrumbLabel } from '@/lib/navigation/breadcrumb-labels';
import { buildBreadcrumbListJsonLd, buildBreadcrumbTrail } from '@/lib/navigation/breadcrumb-trail';
import { STATIC_SITEMAP_PAGES } from '@/lib/seo/static-sitemap-pages';
import { buildUrl } from '@/lib/urls';

const page = readFileSync(resolve(__dirname, '../../src/pages/[lang]/planes/index.astro'), 'utf8');
const audiences = ['turistas', 'anfitriones', 'experiencias', 'comer-y-salir'] as const;
const cardIds = ['tourist', 'host', 'experience', 'venue'] as const;

describe('public plans index', () => {
    it('renders exactly four audience links through the localized URL builder', () => {
        const paths = [...page.matchAll(/path: '(planes\/[^']+)'/g)].map((match) => match[1]);
        expect(paths).toEqual(audiences.map((audience) => `planes/${audience}`));
        expect(page).toContain('cards.map(({ id, path, Icon })');
        expect(page).toContain('href={buildUrl({ locale, path })}');
        for (const locale of SUPPORTED_LOCALES) {
            expect(paths.map((path) => buildUrl({ locale, path }))).toEqual(
                audiences.map((audience) => `/${locale}/planes/${audience}/`)
            );
        }
    });

    it('uses the marketing shell, flat accent CTAs and pricing cache contract without prices', () => {
        expect(page).toContain('<MarketingLayout');
        expect(page).toContain('<MarketingHero');
        expect(page).toMatch(/<GradientButton[\s\S]*?variant="accent"\s+flat/);
        expect(page).toContain('applyCacheHeaders({');
        expect(page).toContain("cacheClass: 'pricing'");
        expect(page).toContain('tags: [CACHE_TAG_PRICING]');
        expect(page).not.toMatch(
            /prerender\s*=\s*true|locals\.user|cookies|fetchPublicPlans|formatCurrency|\$\s*\d|\bARS\b/
        );
    });

    it.each(
        SUPPORTED_LOCALES
    )('resolves every hub string in %s with matching locale keys', (locale) => {
        const { t } = createTranslations(locale);
        const content = JSON.parse(
            readFileSync(
                resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/pricing.json`),
                'utf8'
            )
        ).hub;
        expect(Object.keys(content.cards).sort()).toEqual([...cardIds].sort());
        const keys = [
            'title',
            'tagline',
            'heading',
            'description',
            'cardsHeading',
            ...cardIds.flatMap((id) =>
                ['title', 'description', 'cta'].map((field) => `cards.${id}.${field}`)
            )
        ];
        for (const key of keys) {
            const fullKey = `pricing.hub.${key}`;
            const translated = t(fullKey);
            expect(translated, fullKey).not.toBe(fullKey);
            expect(translated.trim(), fullKey).not.toBe('');
            expect(translated, fullKey).not.toMatch(/\$|\bARS\b|\d/);
            if (locale !== 'es') {
                const spanish = createTranslations('es').t(fullKey);
                // "Turistas" has the same spelling in Spanish and Portuguese.
                if (!(locale === 'pt' && key === 'cards.tourist.title')) {
                    expect(translated, fullKey).not.toBe(spanish);
                }
            }
        }
    });

    it.each(
        SUPPORTED_LOCALES
    )('keeps home-only breadcrumbs hidden with complete JSON-LD in %s', (locale) => {
        const { t } = createTranslations(locale);
        const items = [{ label: breadcrumbLabel({ t, key: 'plans' }) }];
        const input = { locale, items, homeLabel: t('nav.home') };
        expect(page).toContain("items={[{ label: breadcrumbLabel({ t, key: 'plans' }) }]}");
        expect(buildBreadcrumbTrail(input).entries).toEqual([]);
        const structured = buildBreadcrumbListJsonLd({
            ...input,
            siteOrigin: 'https://example.test',
            currentPath: `/${locale}/planes/`
        });
        expect(structured.itemListElement.map((entry) => entry.item)).toEqual([
            `https://example.test/${locale}/`,
            `https://example.test/${locale}/planes/`
        ]);
    });

    it('registers the real page in the sitemap and preserves trailing-slash canonicalization', () => {
        expect(STATIC_SITEMAP_PAGES.map(({ path }) => path)).toContain('/planes/');
        const middleware = readFileSync(resolve(__dirname, '../../src/middleware.ts'), 'utf8');
        expect(middleware).toContain("if (path !== '/' && !path.endsWith('/'))");
        expect(middleware).toContain('location: `${pathWithSlash}${search}`');
        for (const locale of SUPPORTED_LOCALES) {
            expect(resolveLegacyRedirectTarget({ path: `/${locale}/planes/` })).toBeUndefined();
        }
    });
});

describe('plans breadcrumb targets', () => {
    it('keeps addon purchase fallback separate from the public hub', () => {
        expect(PLANS_INDEX_PATH).toBe('planes');
        expect(NEUTRAL_PLANS_PATH).toBe('suscriptores/planes');
    });

    it.each(audiences)('%s landing points its plans ancestor directly at the hub', (audience) => {
        const source = readFileSync(
            resolve(__dirname, `../../src/pages/[lang]/planes/${audience}/index.astro`),
            'utf8'
        );
        expect(source).toContain("breadcrumbLabel({ t, key: 'plans' }), path: PLANS_INDEX_PATH");
        expect(source).not.toContain('NEUTRAL_PLANS_PATH');
        const pricing = readFileSync(
            resolve(__dirname, `../../src/pages/[lang]/planes/${audience}/precios/index.astro`),
            'utf8'
        );
        expect(pricing).toContain('buildPricingBreadcrumbs(');
    });
});
