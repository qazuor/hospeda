import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '../../src/lib/i18n';

const source = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

describe('public chrome audit', () => {
    it('uses the Spanish department label without changing the route vocabulary', () => {
        const messages = readFileSync(
            resolve(__dirname, '../../../../packages/i18n/src/locales/es/accommodations.json'),
            'utf8'
        );
        expect(messages).toContain('"apartments": "Departamentos"');
        expect(messages).toContain('"apartment": "Departamento"');
        expect(messages).toContain('"name": "Departamentos"');
    });

    it.each([
        'aiSearch.examples.query3',
        'aiSearch.examples.typeApartment'
    ] as const)('uses Spanish department vocabulary in %s', (key) => {
        const { t } = createTranslations('es');

        const example = t(key);

        expect(example).toMatch(/^Departamento\b/);
    });
    it('uses the measured sticky inset on page sidebars without clipping their contents', () => {
        const sticky = source('components/shared/layout/SmartSticky.astro');
        expect(sticky).toMatch(
            /:where\(\[data-smart-sticky\]\[style\*="--sticky-sidebar-height"\]\)/
        );
        expect(sticky).toContain(
            'min(var(--sticky-sidebar-base), calc(100dvh - var(--sticky-sidebar-height) - var(--space-4)))'
        );
        expect(sticky).toContain('target.offsetHeight');
        for (const layout of ['DetailLayout', 'AccountShell', 'ListingLayout']) {
            expect(source(`layouts/${layout}.astro`)).toMatch(/<aside [^>]*data-smart-sticky/);
        }
        expect(source('layouts/DetailLayout.astro')).not.toContain('overflow-y: auto');
        expect(source('layouts/AccountShell.module.css')).not.toContain('overflow-y: auto');
    });

    it('keeps Publicar as the flat accent CTA beside a secondary outline sign-in and labels desktop preferences', () => {
        // HOS-2646 (owner smoke) owns the Publicar treatment: flat accent, not outline.
        expect(source('components/shared/navigation/PublishMenu.client.tsx')).toContain(
            'btn-gradient--accent btn-gradient--flat'
        );
        const userMenu = source('components/shared/navigation/UserMenu.client.tsx');
        // HOS-2666: sign-in is the secondary (outline) action, never a filled gradient.
        expect(userMenu).not.toContain('btn-gradient');
        expect(source('components/shared/navigation/UserMenu.module.css')).toMatch(
            /\.signInLink\s*\{[^}]*background-color: transparent/
        );
        expect(userMenu.match(/className=\{styles.prefsRow\}/g)).toHaveLength(1);
        expect(userMenu).toContain("t('nav.userMenu.preferences')");
        expect(source('components/shared/preferences/ThemeControl.client.tsx')).toContain(
            'title={'
        );
        for (const control of ['LanguageSwitcher', 'ThemeControl']) {
            expect(source(`components/shared/preferences/${control}.module.css`)).toMatch(
                /\.root--mobile \.option\s*\{[^}]*min-height: 2.75rem/
            );
        }
    });

    it('promotes available province cities and suppresses empty province previews', () => {
        const page = source('pages/[lang]/destinos/[...path].astro');
        expect(page).toContain("getDescendants({ id: destId, destinationType: 'CITY' })");
        expect(page).toMatch(/variant="cities"[\s\S]+<!-- Description/);
        for (const cards of ['accCards', 'eventCards', 'relatedPosts']) {
            expect(page).toContain(`!isProvince || ${cards}.length > 0`);
        }
        const ctas = source('components/destination/DestinationSidebarCtas.astro');
        expect(ctas).toMatch(/href="#destination-cities"[\s\S]+href=\{accommodationsHref\}/);
        expect(source('components/destination/DestinationNearbySection.astro')).toContain(
            "'destination-cities'"
        );
        expect(page).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
        expect(page).toMatch(
            /@media \(max-width: 768px\)\s*\{\s*\.dest-detail__section-header\s*\{\s*flex-direction: column/
        );
    });
});
