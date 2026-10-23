/**
 * @file mobile-floating-dock.guard.test.ts
 * @description Static guard for fixed-position source files and controls that
 * belong in the mobile floating dock.
 *
 * WHAT THE PREDICATE PROVES: every source file whose raw text contains
 * `position: fixed` is represented in the frozen inventory, every dock control
 * opts into dock measurement and becomes static inside its mobile dock rule,
 * every portal uses one expected non-start slot exactly once, and dock rules
 * do not add numeric z-index values at the mobile breakpoint.
 *
 * WHAT IT DOES NOT SEE: comments are included in the fixed-position inventory,
 * so a comment-only match can be a false positive that needs classification.
 * It does not resolve CSS cascade, render layouts, discover runtime styles or
 * prove that a control is visually unobstructed in a browser. It only scans
 * `.astro`, `.css`, `.ts`, and `.tsx` files below `apps/web/src`.
 *
 * @module test/static-guards/mobile-floating-dock
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOBILE_DOCK_SLOTS } from '../../src/lib/mobile-dock/mobile-dock-slots';

const WEB_SRC = path.resolve(__dirname, '../../src');
type FixedPositionCategory = 'dock' | 'overlay' | 'top' | 'bottom-bar' | 'comment';

/**
 * Presence inventory for every raw fixed-position match in `src`. Add a new
 * fixed file here and classify it; remove stale paths when the declaration is
 * removed. The categories follow `.hoja/contexto.md` §4.
 */
const FIXED_POSITION_FILES: Readonly<Record<string, FixedPositionCategory>> = Object.freeze({
    'hooks/useVisualViewportInset.ts': 'comment',
    'styles/components.css': 'overlay',
    'components/account/WhatsNewModal.module.css': 'overlay',
    'pages/[lang]/experiencias/[slug].astro': 'comment',
    'pages/[lang]/alojamientos/[slug].astro': 'comment',
    'pages/[lang]/alojamientos/mapa.astro': 'top',
    'pages/[lang]/gastronomia/[slug].astro': 'comment',
    'components/post/ReadingProgressBar.module.css': 'top',
    'components/maps/MapCardsSidebar.module.css': 'overlay',
    'components/accommodation/AiChatWidget.tsx': 'comment',
    'components/ai-search/AiSearchEntry.module.css': 'dock',
    'components/accommodation/AiChatFab.module.css': 'dock',
    'components/ImageGallery.module.css': 'overlay',
    'components/auth/AuthRequiredPopover.client.tsx': 'comment',
    'components/accommodation/AiChatWidget.module.css': 'overlay',
    'components/legal/CookieConsentBanner.module.css': 'bottom-bar',
    'components/ui/ToastViewport.module.css': 'bottom-bar',
    'components/auth/AuthRequiredPopover.module.css': 'overlay',
    'components/presentacion/PresentationThemeToggle.astro': 'top',
    'components/shared/dock/MobileDock.astro': 'dock',
    'components/shared/navigation/MobileMenu.module.css': 'overlay',
    'components/shared/navigation/ScrollToTop.astro': 'dock',
    'components/shared/navigation/SkipToContent.astro': 'top',
    'components/host/editor/CountryCodeCombobox.module.css': 'overlay',
    'components/sections/SearchBar.client.tsx': 'comment',
    'components/shared/ui/Dialog.module.css': 'overlay',
    'components/shared/navigation/NavigationProgress.astro': 'top',
    'components/shared/favorite/CollectionPickerPopover.tsx': 'comment',
    'components/sections/SearchBar.module.css': 'overlay',
    'components/shared/compare/CompareBar.module.css': 'dock',
    'components/shared/compare/CompareUpsellPopover.client.tsx': 'comment',
    'components/shared/compare/CompareModeToggle.module.css': 'comment',
    'components/shared/favorite/collection-picker-popover.css': 'overlay',
    'components/shared/compare/CompareUpsellPopover.module.css': 'overlay',
    'components/shared/filters/filter-types/DateRangeFilter.module.css': 'overlay',
    'components/shared/filters/components/SortPopover.module.css': 'overlay',
    'components/shared/feedback/PaginationLoading.client.tsx': 'comment',
    'components/shared/filters/components/MobileDrawer.module.css': 'overlay',
    'components/shared/filters/filter-types/IconChipsFilter.module.css': 'overlay'
});

interface DockItemSource {
    readonly component: string;
    readonly css: string;
}

/** Every mobile dock control must mark its measured root and become static. */
const DOCK_ITEMS: readonly DockItemSource[] = [
    {
        component: 'components/shared/navigation/ScrollToTop.astro',
        css: 'components/shared/navigation/ScrollToTop.astro'
    },
    {
        component: 'components/shared/filters/components/FilterDockTrigger.tsx',
        css: 'components/shared/filters/FilterSidebar.module.css'
    },
    {
        component: 'components/shared/layout/ListingViewToggle.astro',
        css: 'components/shared/layout/ListingViewToggle.astro'
    },
    {
        component: 'components/maps/MapCardsSheetTrigger.tsx',
        css: 'components/maps/MapCardsSidebar.module.css'
    },
    {
        component: 'components/shared/compare/CompareBar.client.tsx',
        css: 'components/shared/compare/CompareBar.module.css'
    },
    {
        component: 'components/ai-search/AiSearchEntry.client.tsx',
        css: 'components/ai-search/AiSearchEntry.module.css'
    },
    {
        component: 'components/accommodation/AiChatFab.tsx',
        css: 'components/accommodation/AiChatFab.module.css'
    }
];

const PORTAL_SLOTS = ['above', 'filters', 'map-cards', 'ai-search', 'ai-chat'] as const;

function read(relative: string): string {
    return fs.readFileSync(path.join(WEB_SRC, relative), 'utf8');
}

function walkSourceFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return walkSourceFiles(absolute);
        return /\.(?:astro|css|ts|tsx)$/.test(entry.name) ? [absolute] : [];
    });
}

function extractMediaBlock(source: string, marker: string): string {
    const start = source.indexOf(marker);
    if (start === -1) return '';
    const openingBrace = source.indexOf('{', start);
    if (openingBrace === -1) return '';
    let depth = 0;
    for (let index = openingBrace; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(openingBrace + 1, index);
        }
    }
    return '';
}

describe('mobile floating dock guard (TEST:1768:20)', () => {
    it('keeps the fixed-position source inventory exact', () => {
        const found = walkSourceFiles(WEB_SRC)
            .filter((absolute) => /position:\s*fixed/.test(fs.readFileSync(absolute, 'utf8')))
            .map((absolute) => path.relative(WEB_SRC, absolute).split(path.sep).join('/'))
            .sort();
        const expected = Object.keys(FIXED_POSITION_FILES).sort();
        const added = found.filter((file) => !expected.includes(file));
        const missing = expected.filter((file) => !found.includes(file));

        expect(
            found,
            [
                `Untracked fixed-position files: ${added.join(', ') || '(none)'}.`,
                `Inventory entries without a raw match: ${missing.join(', ') || '(none)'}.`,
                `If a file is an overlay/modal/popover, add it as 'overlay'. If it is a mobile floating control, move it into the dock and classify it as 'dock' — see apps/web/CLAUDE.md §"Mobile floating dock".`
            ].join('\n')
        ).toEqual(expected);
    });

    it.each(DOCK_ITEMS)('$component is a measured, static dock control', ({ component, css }) => {
        expect(read(component), `${component} must mark its dock root`).toContain('data-dock-item');

        const cssSource = read(css);
        if (component.endsWith('ListingViewToggle.astro')) {
            expect(cssSource, `${component} must remain non-fixed`).not.toMatch(
                /position:\s*fixed/
            );
            return;
        }

        const mobileRule = extractMediaBlock(cssSource, '@media (max-width: 767px)');
        expect(mobileRule, `${css} must declare the 767px mobile rule`).not.toBe('');
        expect(mobileRule, `${css} must become static inside the dock`).toMatch(
            /position:\s*static\s*;/
        );
    });

    it('uses each required non-start DockPortal slot exactly once', () => {
        const portalPattern = /<DockPortal\s+slot=["']([^"']+)["']/g;
        const portals = walkSourceFiles(WEB_SRC).flatMap((absolute) => {
            const source = fs.readFileSync(absolute, 'utf8');
            return [...source.matchAll(portalPattern)].map((match) => ({
                file: path.relative(WEB_SRC, absolute),
                slot: match[1]
            }));
        });
        const validSlots: readonly string[] = MOBILE_DOCK_SLOTS.filter((slot) => slot !== 'start');

        expect(
            portals.filter(({ slot }) => !validSlots.includes(slot)),
            'Every DockPortal must use a named mobile dock slot other than start.'
        ).toEqual([]);
        for (const slot of PORTAL_SLOTS) {
            expect(
                portals.filter((portal) => portal.slot === slot),
                `DockPortal slot "${slot}" must appear exactly once.`
            ).toHaveLength(1);
        }
    });

    it('keeps numeric z-index values out of dock mobile media blocks', () => {
        const offenders = Object.entries(FIXED_POSITION_FILES)
            .filter(([, category]) => category === 'dock')
            .flatMap(([relative]) => {
                const source = read(relative);
                const mobileRule = extractMediaBlock(source, '@media (max-width: 767px)');
                return /\bz-index\s*:\s*-?\d+(?:\.\d+)?\s*;/.test(mobileRule) ? [relative] : [];
            });

        expect(
            offenders,
            `Dock mobile blocks declare numeric z-index: ${offenders.join(', ')}`
        ).toEqual([]);
    });
});
