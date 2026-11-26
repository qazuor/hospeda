import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFaqDirectory } from '@/lib/faq/directory';
import { filterFaqDirectory } from '@/lib/faq/search';
import { getTranslations } from '@/lib/i18n';
import { listingBounds } from '@/lib/maps/listing-bounds';

const source = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('HOS-2655 public FAQ', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('renders the reviewed question keys and complete localized answers in %s', (locale) => {
        const page = source('pages/[lang]/preguntas-frecuentes/index.astro');
        const reviewedKeys = {
            about: 'what coverage cost languages different scope verified',
            tourists:
                'search booking contactOwner reviews favorites issue petFriendly events cancellation plans assistant writeReview',
            owners: 'publish cost commission ready manageReviews featured pause payments support billing',
            contributors:
                'writeArticle submitPhotos submitEvent paid placeReviews program languages',
            partners:
                'advertise formats tourismOffices eventSponsorship officialPartner commercialContact minBudget partnerships',
            account:
                'needAccount deleteAccount dataStored themeLanguage paymentSecurity newsletter privacy',
            support: 'channels hours whatsapp urgency freePhone press'
        };
        const messages = getTranslations({ locale, namespace: 'faq' });

        expect(page).toContain('const groups = buildFaqDirectory({ locale });');
        expect(page).toContain('<FaqAccordion groups={groups}');
        const groups = buildFaqDirectory({ locale });

        expect(groups).toEqual(
            Object.entries(reviewedKeys).map(([category, keys]) => {
                const prefix = `categories.${category}`;
                return {
                    id: `cat-${category}`,
                    title: messages[`${prefix}.title`],
                    items: keys.split(' ').map((key) => {
                        const question = messages[`${prefix}.items.${key}.question`];
                        const answer = messages[`${prefix}.items.${key}.answer`];
                        expect(question).toMatch(/\S/);
                        expect(answer).toMatch(/\S/);
                        expect(answer).not.toContain('{{');
                        return { question, answer };
                    })
                };
            })
        );
    });

    it('reads displayed plan names from the catalog and carries its cache tag', () => {
        const page = source('pages/[lang]/preguntas-frecuentes/index.astro');

        expect(page).toContain('await fetchAudiencePlans({ audience })');
        expect(page).toContain('getPlanName({ plan, t })');
        expect(page).toMatch(/cacheClass: 'pricing',[\s\S]*?tags: [^\n]*CACHE_TAG_PRICING/);
    });
    it('uses the same native, initially open disclosure and named-category rule', () => {
        const accordion = source('components/shared/ui/FaqAccordion.astro');
        const adapters = [
            'accommodation/FaqAccordion',
            'destination/DestinationFaqAccordion',
            'experience/ExperienceFaqs',
            'marketing/FaqSection',
            'contact/ContactFAQ'
        ];

        const consumers = adapters.map((name) => source(`components/${name}.astro`));

        for (const consumer of consumers) expect(consumer).toContain('<FaqAccordion');
        expect(accordion).toMatch(/defaultOpen = [^;]*<= 3/);
        expect(accordion).toMatch(/showHeadings = [^;]*\.size >= 2/);
        expect(accordion).toMatch(
            /<details open=\{defaultOpen\}[^>]*>[\s\S]*?<summary>[\s\S]*?\{question\}[\s\S]*?<p>\{answer\}/
        );
    });

    it('centers reading content and provides an unclipped responsive jump nav and a return link', () => {
        const page = source('pages/[lang]/preguntas-frecuentes/index.astro');
        const nav = source('components/shared/ui/ScrollableNav.astro');

        expect(page).toMatch(/\.faq-container\s*\{[^}]*margin-inline: auto/);
        expect(page).toContain('desktopGrid>');
        expect(page).toContain('href="#faq-top"');
        expect(page).not.toContain("section--warm': catIdx");
        expect(nav).toMatch(/@media \(min-width: 768px\)[\s\S]*?display: grid/);
        expect(nav).toMatch(
            /@media \(max-width: 767px\)[\s\S]*?flex-wrap: nowrap;\s*overflow-x: auto/
        );
    });

    it('finds accented words across question and answer, hides nonmatching groups and resets', () => {
        const root = document.createElement('div');
        root.innerHTML = `<p hidden data-faq-empty></p>
            <div data-faq-group><details data-faq-item><summary>¿Dónde?</summary><p>Colón</p></details></div>
            <div data-faq-group><details open data-faq-item><summary>How?</summary><p>By bus</p></details></div>`;

        const result = filterFaqDirectory({ root, query: 'donde COLON' });

        expect(result.matchCount).toBe(1);
        expect(root.querySelectorAll('[data-faq-group][hidden]')).toHaveLength(1);
        expect(root.querySelector('[open]')).not.toBeNull();
        filterFaqDirectory({ root, query: 'unmatched' });
        expect(root.querySelector('[data-faq-empty]')).not.toHaveAttribute('hidden');
        expect(filterFaqDirectory({ root, query: '' }).matchCount).toBe(2);
    });
});

describe('HOS-2655 listing maps', () => {
    it.each([
        'components/maps/ListingMapInner.client.tsx',
        'components/maps/MapCardsSidebar.client.tsx',
        'components/maps/MapCardsSidebar.module.css',
        'pages/[lang]/alojamientos/mapa.astro'
    ])('keeps %s below 500 lines', (path) => {
        const contents = source(path);

        const lineCount = contents.trimEnd().split('\n').length;

        expect(lineCount).toBeLessThan(500);
    });

    it('frames the extrema even when the first item is in the middle', () => {
        const points = [
            { lat: -32, lng: -58 },
            { lat: -34, lng: -59 },
            { lat: -30, lng: -57 },
            undefined
        ];

        const { bounds } = listingBounds({ points });

        expect(bounds).toEqual([
            [-34, -59],
            [-30, -57]
        ]);
        expect(listingBounds({ points: [{ lat: NaN, lng: 0 }] }).bounds).toBeUndefined();
    });

    it('wires initial framing for both routes and keeps the disclaimer outside the map canvas', () => {
        const accommodation = source('pages/[lang]/alojamientos/mapa.astro');
        const destination = source('pages/[lang]/destinos/mapa.astro');
        const wrapper = source('components/maps/AccommodationsListingMap.client.tsx');
        const css = source('components/maps/ListingMap.module.css');
        const inner = source('components/maps/ListingMapInner.client.tsx');

        expect(wrapper).toContain('initialItems.map');
        expect(destination).toContain('initialBounds={initialBounds}');
        expect(destination).toMatch(
            /class="map-toolbar">\s*<p>\{tPlural[^<]+<\/p>\s*<div class="view-toggle"/
        );
        expect(destination).toContain('compactContentGap');
        expect(inner).toContain('iconCreateFunction={clusterIcon}');
        expect(css).toMatch(/\.cluster\s*\{[^}]*border-radius:[^}]*background:[^}]*color:/);
        expect(css).toMatch(/leaflet-control-zoom a\)[^{]*\{\s*width: 44px;\s*height: 44px;/);
        expect(inner.indexOf('</MapContainer>')).toBeLessThan(
            inner.indexOf('className={styles.disclaimer}')
        );
        expect(accommodation).not.toContain('[class*="disclaimer"]');
    });
});

describe('HOS-2655 legal pages', () => {
    it.each([
        [
            'hospeda_vid',
            'visitor',
            ['Sesión del navegador', 'Browser session', 'Sessão do navegador']
        ],
        [
            '*.dont_remember',
            'dontRemember',
            ['Sesión del navegador', 'Browser session', 'Sessão do navegador']
        ],
        ['*.state', 'signInState', ['5 minutos', '5 minutes', '5 minutos']],
        ['gcal_oauth_state', 'calendarState', ['5 minutos', '5 minutes', '5 minutos']],
        [
            '*.session_token.oauth_logout_confirmation',
            'oauthLogout',
            ['5 minutos', '5 minutes', '5 minutos']
        ]
    ] as const)('discloses %s with its localized purpose and lifetime', (name, key, durations) => {
        const page = source('pages/[lang]/legal/cookies/index.astro');
        const locales = ['es', 'en', 'pt'] as const;

        expect(page).toContain(`{ name: '${name}', key: '${key}' }`);
        for (const [index, locale] of locales.entries()) {
            const messages = getTranslations({ locale, namespace: 'cookies' });
            expect(messages[`inventory.${key}.purpose`]).toMatch(/\S/);
            expect(messages[`inventory.${key}.duration`]).toBe(durations[index]);
        }
    });

    it.each([
        ['layouts/LegalLayout.astro', /\.legal-preferences\s*\{[^}]*min-block-size:\s*44px/],
        [
            'components/maps/ListingMap.module.css',
            /\.popupCta:visited\s*\{[^}]*min-block-size:\s*44px/
        ],
        [
            'components/maps/ListingMap.module.css',
            /\.floatingCardClose\s*\{(?=[^}]*block-size:\s*44px)(?=[^}]*inline-size:\s*44px)/
        ]
    ] as const)('keeps the changed controls in %s at least 44px', (path, rule) => {
        expect(source(path)).toMatch(rule);
    });

    it('shares the same heading for the collapsible contents and articles and widens the prose', () => {
        const layout = source('layouts/LegalLayout.astro');

        expect(layout).toMatch(/<details>\s*<summary>/);
        expect(layout).toContain('<h2>{heading}</h2>');
        expect(layout).toMatch(/<a href=\{`#\$\{id\}`\}>\{heading\}<\/a>/);
        expect(layout).toContain('href="#legal-toc"');
        expect(layout).toContain('max-width: 95ch;');
        expect(layout).not.toMatch(/counter-(increment|reset):/);
    });

    it('links the legal references and renders the cookie inventory and preferences trigger', () => {
        const terms = source('pages/[lang]/legal/terminos/index.astro');
        const cookies = source('pages/[lang]/legal/cookies/index.astro');
        const layout = source('layouts/LegalLayout.astro');
        const footer = source('layouts/Footer.astro');
        const baseLayout = source('layouts/BaseLayout.astro');

        expect(terms).toMatch(/id === 'reservas'[\s\S]*?\/legal\/privacidad\//);
        expect(terms).toMatch(/id === 'contacto'[\s\S]*?\/legal\/arrepentimiento\//);
        expect(cookies).toMatch(/table: key === 'cookieList'/);
        expect(cookies).toMatch(/bullets: key === 'sessionRecording'/);
        expect(cookies).toMatch(/managePreferences: key === 'manageCookies'/);
        expect(layout).toContain('data-cookie-consent-reopen');
        expect(footer).toMatch(/requestCookieConsentPreferences\((?:\{ opener \})?\);/);
        expect(baseLayout).toMatch(/<CookieConsentBanner\s+client:(load|idle)\b/);
    });
});
