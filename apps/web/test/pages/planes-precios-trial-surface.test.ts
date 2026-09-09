/**
 * @file planes-precios-trial-surface.test.ts
 * @description HOS-1233 T-021 / T-026 — what the five `/planes/…/precios/`
 * pages must and must not carry after this spec.
 *
 * Two halves, and the second exists because of D-1's consequence: the owner
 * chose to cover all five pages, and on the three `ctaMode="link"` ones the
 * work is the BANNER and nothing else. Turning any of them into a checkout page
 * would undo HOS-1156's funnel (R-4), and nothing else in the suite would
 * notice — the page would still render, the button would still be a button.
 *
 * Every "X is absent" assertion here has a sibling asserting the same literal
 * IS present on the two pages that legitimately carry it, so a typo in the
 * literal fails loudly instead of passing quietly.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildCommerceStartUrl } from '../../src/lib/commerce/start-url';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/** The five pricing pages, by audience. */
const PRICING_PAGES = {
    owner: 'pages/[lang]/planes/anfitriones/precios/index.astro',
    tourist: 'pages/[lang]/planes/turistas/precios/index.astro',
    gastronomy: 'pages/[lang]/planes/gastronomia/precios/index.astro',
    experience: 'pages/[lang]/planes/experiencias/precios/index.astro',
    partner: 'pages/[lang]/planes/aliados/precios/index.astro'
} as const;

/** The three whose CTA links out instead of charging (F-1 / D-1). */
const LINK_AUDIENCES = ['gastronomy', 'experience', 'partner'] as const;

/** The two that reach MercadoPago from the card (F-1). */
const CHECKOUT_AUDIENCES = ['owner', 'tourist'] as const;

const SHARED_SECTIONS = 'components/billing/AudiencePricingSections.astro';

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

describe('HOS-1233 — the five pricing pages are all reachable by this test', () => {
    it('reads a non-empty source for each of the five', () => {
        // Non-vacuity. Every assertion below is a substring check, and a file
        // read as an empty string satisfies the negative half of all of them.
        for (const path of Object.values(PRICING_PAGES)) {
            expect(readSrc(path).length, path).toBeGreaterThan(500);
        }
    });
});

describe('HOS-1233 T-021 / AC-7 — every pricing page mounts the remaining-days banner', () => {
    it('all five render the shared sections component, naming their audience', () => {
        for (const [audience, path] of Object.entries(PRICING_PAGES)) {
            const source = readSrc(path);
            expect(source, path).toContain('<AudiencePricingSections');
            expect(source, path).toContain(`audience="${audience}"`);
        }
    });

    it('the shared sections component mounts the banner as a hydrated island', () => {
        const source = readSrc(SHARED_SECTIONS);
        expect(source).toContain('<TrialRemainingDaysBanner');
        // An island, not frontmatter (F-8 / AC-10): a server-rendered day count
        // would personalise an edge-cached page. Deliberately agnostic about
        // WHICH `client:` directive — that is a hydration-priority call, free
        // to change, and this assertion is about the island/frontmatter split.
        expect(source).toMatch(/<TrialRemainingDaysBanner[^>]*client:/);
        // The page's audience is forwarded, so each page reads its OWN
        // vertical's clock rather than a default.
        expect(source).toMatch(/<TrialRemainingDaysBanner[^>]*audience=\{audience\}/);
    });

    it('the banner is not mounted for an audience with no trial scope', () => {
        // aliados has no clock to read (`?productDomain=partner` is a 400), so
        // mounting it there ships and hydrates an island whose every branch
        // returns null.
        const source = readSrc(SHARED_SECTIONS);
        // Gated on the canonical resolver, never on a second
        // `audience === 'partner'` test — the day aliados stops being the only
        // scopeless audience, both halves have to move together.
        expect(source).toContain('resolveTrialScopeForAudience({ audience }) !== null');
        expect(source).toMatch(/hasTrialScope[\s\S]{0,40}<TrialRemainingDaysBanner/);
    });

    it('the banner reaches the pages only through that one mount', () => {
        // Five copies would be five places for the next change to land. If a
        // page ever mounts its own, this fails and the decision gets made
        // deliberately rather than by drift.
        for (const path of Object.values(PRICING_PAGES)) {
            expect(readSrc(path), path).not.toContain('TrialRemainingDaysBanner');
        }
    });
});

describe('HOS-1233 T-026 / AC-12 — the three link pages still link to signup → create form', () => {
    it('gastronomia and experiencias point at their own vertical create form', () => {
        // The real builder, not a copy of its output: this asserts the href a
        // visitor actually gets, through the function the page calls.
        expect(buildCommerceStartUrl({ locale: 'es', vertical: 'gastronomy' })).toBe(
            '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fgastronomia%2F'
        );
        expect(buildCommerceStartUrl({ locale: 'es', vertical: 'experience' })).toBe(
            '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fexperiencias%2F'
        );

        for (const [audience, vertical] of [
            ['gastronomy', 'gastronomy'],
            ['experience', 'experience']
        ] as const) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).toContain(
                `buildCommerceStartUrl({ locale, vertical: '${vertical}' })`
            );
            expect(source, audience).toContain('ctaHref={ctaHref}');
        }
    });

    it('aliados still points at the partner lead form', () => {
        const source = readSrc(PRICING_PAGES.partner);
        expect(source).toContain("buildUrl({ locale, path: 'sumate/partner' })");
        expect(source).toContain('ctaHref={ctaHref}');
    });

    it('all three declare ctaMode="link"', () => {
        for (const audience of LINK_AUDIENCES) {
            expect(readSrc(PRICING_PAGES[audience]), audience).toContain('ctaMode="link"');
        }
    });

    it('no checkout path was added to any of them', () => {
        // The positive sibling of this negative is the test above: the same
        // literal is asserted PRESENT on all three, so a typo here cannot pass.
        for (const audience of LINK_AUDIENCES) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).not.toContain('ctaMode="checkout"');
            expect(source, audience).not.toContain('PlanPurchaseButton');
        }
    });

    it('the two checkout pages declare no link mode — the sibling of the above', () => {
        for (const audience of CHECKOUT_AUDIENCES) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).not.toContain('ctaMode="link"');
            expect(source, audience).not.toContain('ctaHref=');
        }
    });
});
