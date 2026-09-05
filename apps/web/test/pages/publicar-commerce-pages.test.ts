/**
 * @file publicar-commerce-pages.test.ts
 * @description Source-reading checks for the two commerce publish pages
 * (HOS-1156 T-020/T-021).
 *
 * Both pages are the same mould with different words, so they are checked
 * together and the differences are asserted explicitly — a copy-paste that left
 * one page declaring the other's vertical would otherwise pass everything.
 *
 * What a source read can prove is limited on purpose: these assertions cover the
 * wiring (which vertical, which layout, which sections) and the two removals
 * that define the change (no `AccountLayout`, no login redirect). Whether the
 * pages actually SERVE is proven by the live `curl` sweep (AC-2) — `astro check`
 * is blind to frontmatter behind an early return, so a page can typecheck and
 * still answer 500.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reads a page with its block comments removed.
 *
 * Every "this is gone" assertion below runs against the stripped source. Each
 * page's docblock names what it replaced — `AccountLayout`, the login redirect —
 * because that is the most useful thing it can tell the next reader, and a naive
 * `not.toContain` would read the explanation as the thing itself.
 */
function readStripped(relativePath: string): string {
    return readFileSync(resolve(__dirname, relativePath), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '');
}

const PAGES = [
    {
        name: 'gastronomia',
        vertical: 'gastronomy',
        otherVertical: 'experience',
        file: '../../src/pages/[lang]/publicar/gastronomia/index.astro',
        plansPath: 'planes/gastronomia'
    },
    {
        name: 'experiencias',
        vertical: 'experience',
        otherVertical: 'gastronomy',
        file: '../../src/pages/[lang]/publicar/experiencias/index.astro',
        plansPath: 'planes/experiencias'
    }
] as const;

for (const page of PAGES) {
    const src = readStripped(page.file);

    describe(`publicar/${page.name}/index.astro`, () => {
        it(`declares the ${page.vertical} vertical and never the other one`, () => {
            expect(src).toContain(`const VERTICAL = '${page.vertical}' as const;`);
            // The failure this catches is a copy-paste: a page that renders the
            // right copy while prechecking, capping and creating in the wrong
            // vertical would look completely correct on screen.
            expect(src).not.toContain(`'${page.otherVertical}'`);
        });

        it('renders in MarketingLayout, not AccountLayout (D-2, AC-6)', () => {
            expect(src).toContain('MarketingLayout');
            expect(src).not.toContain('AccountLayout');
            expect(src).not.toContain('AccountPageHeader');
        });

        it('never redirects a signed-out visitor to login (D-1, AC-5)', () => {
            expect(src).not.toContain('buildLoginRedirect');
            expect(src).not.toContain('Astro.redirect');
        });

        it('resolves its form slot through the shared resolver', () => {
            expect(src).toContain('resolvePublishPageSlot');
            expect(src).toContain('vertical: VERTICAL');
        });

        it('mounts the commerce create form inside the slot', () => {
            const slotStart = src.indexOf('<PublishFormSlot');
            const slotEnd = src.indexOf('</PublishFormSlot>');
            expect(slotStart).toBeGreaterThan(-1);
            expect(slotEnd).toBeGreaterThan(slotStart);
            expect(src.slice(slotStart, slotEnd)).toContain('<CommerceCreateForm');
        });

        it('fetches the destination catalog only when the form is what renders', () => {
            // On the other two states the island is never emitted, so the round
            // trip would produce a value nothing reads.
            expect(src).toMatch(/slot\.state === 'form'\s*\?\s*await destinationsApi\.list/);
            // A failed fetch must stay distinguishable from an empty catalog, or
            // the form silently drops a REQUIRED field (HOS-166).
            expect(src).toContain('destinationsLoadFailed');
        });

        it('renders all four sections of §6 (AC-4)', () => {
            expect(src).toContain('<PublishHero');
            expect(src).toContain('<PublishFormSlot');
            expect(src).toContain('<PublishHowItWorks');
            expect(src).toContain('<PublishPlanLinks');
        });

        it('links to its own sales page and price grid, from the shared path map', () => {
            expect(src).toContain('PLANS_PAGE_PATH_BY_VERTICAL[VERTICAL]');
            expect(src).toContain('PRICING_PAGE_PATH_BY_VERTICAL[VERTICAL]');
            // Never a literal: five separate copies of a path is how HOS-1032
            // left a menu pointing at a sales page.
            expect(src).not.toContain(`'${page.plansPath}'`);
        });

        it('stays SSR, because it reads the session (AC-8)', () => {
            expect(src).toContain('export const prerender = false;');
        });

        it('takes every user-facing string through t() (AC-15)', () => {
            expect(src).toContain(`t('publish.${page.vertical}.hero.title'`);
            expect(src).toContain(`t('publish.${page.vertical}.meta.title'`);
        });
    });
}

describe('the two commerce publish pages share the mould, not the words (§1)', () => {
    const [gastronomy, experiences] = PAGES;
    const gastronomySrc = readStripped(gastronomy.file);
    const experiencesSrc = readStripped(experiences.file);

    it('names no i18n key of the other vertical', () => {
        expect(gastronomySrc).not.toContain('publish.experience.');
        expect(experiencesSrc).not.toContain('publish.gastronomy.');
    });

    it('does not share a hero fallback sentence', () => {
        // The fallbacks are what a reader sees before a locale is translated, so
        // two identical ones would ship the same page twice in en and pt while
        // looking correct in es.
        const heroFallback = (src: string) =>
            src.slice(src.indexOf('<PublishHero'), src.indexOf('Icon={'));
        expect(heroFallback(gastronomySrc)).not.toBe(heroFallback(experiencesSrc));
    });
});
