/**
 * @file publicar.test.ts
 * @description Source-reading checks for the accommodation publish page
 * (HOS-1156 T-019). The Astro page cannot be rendered in Vitest, so what is
 * asserted here is what the source can honestly prove: which imports and calls
 * are present, and — the load-bearing half — which are GONE.
 *
 * Every assertion below is about a removal (D-3, R-3) or a wiring the page
 * cannot get right by accident. The page's actual OUTPUT is proven by the live
 * `curl` sweep (AC-2), because a page that typechecks can still answer 500:
 * `astro check` does not see frontmatter behind an early return.
 *
 * The previous version of this file existed to lock IN the existing-host
 * redirect. That redirect is what D-3 removed, so the tests that guarded it are
 * gone with it, and the ones below guard the opposite.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(resolve(__dirname, '../../src/pages/[lang]/publicar/index.astro'), 'utf8');

/**
 * The page with its block comments removed.
 *
 * Every "this is gone" assertion below runs against this, not the raw file. The
 * page's docblock EXPLAINS the removals by name — that is the most useful thing
 * it can say to the next reader — and a naive `not.toContain` would read the
 * explanation as the thing itself and fail. Worse in the other direction: a
 * presence check satisfied by a comment would pass while the code was missing.
 */
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

describe('publicar/index.astro — the existing-host redirect is gone (D-3, AC-7)', () => {
    it('never redirects to the properties list', () => {
        // The exact call this page used to make. An owner with ≥1 accommodation
        // reaching /publicar/ from the navbar must now get the page, not a bounce
        // to a list — otherwise they cannot create a second property from the
        // menu at all, which is what this whole issue is about.
        expect(src).not.toContain("path: 'mi-cuenta/propiedades' })");
        expect(src).not.toContain('Astro.redirect');
    });

    it('no longer fetches the owned-accommodation count (R-3)', () => {
        // The count fed the redirect and nothing else; the precheck already
        // returns `currentCount`. Leaving the fetch would be a third SSR round
        // trip answering a question nobody asks.
        expect(src).not.toContain('/api/v1/protected/accommodations?page=1&pageSize=1');
        expect(src).not.toContain('pagination?.total');
    });

    it('does not send a signed-out visitor to a login screen (D-1)', () => {
        // This is reached from a PUBLIC navbar button. `buildLoginRedirect` in
        // the frontmatter is exactly what the signup CTA replaces.
        expect(src).not.toContain('buildLoginRedirect');
    });
});

describe('publicar/index.astro — the form is on this page now (T-019)', () => {
    it('resolves the form slot through the shared resolver', () => {
        expect(src).toContain('resolvePublishPageSlot');
        expect(src).toContain('<PublishFormSlot');
    });

    it('declares the accommodation vertical, not a default', () => {
        expect(src).toMatch(/const VERTICAL = 'accommodation' as const;/);
        expect(src).toContain('vertical: VERTICAL');
    });

    it('mounts the create form inside the slot', () => {
        expect(src).toContain('<CreatePropertyMiniForm');
        const slotStart = src.indexOf('<PublishFormSlot');
        const slotEnd = src.indexOf('</PublishFormSlot>');
        expect(slotStart).toBeGreaterThan(-1);
        expect(slotEnd).toBeGreaterThan(slotStart);
        expect(src.slice(slotStart, slotEnd)).toContain('<CreatePropertyMiniForm');
    });

    it('drops the CTA island whose only job was linking to the absorbed form', () => {
        expect(src).not.toContain('HostLandingCta');
    });

    it('reads the trial length from the live plans, once, for both consumers', () => {
        expect(src).toContain('resolveGenericOwnerTrialDays');
        // Twice would mean the callout and the form island each fetched it, which
        // is what merging the two pages was supposed to stop.
        expect(src.match(/await resolveGenericOwnerTrialDays\(\)/g)).toHaveLength(1);
        expect(src).toContain('trialDays={genericTrialDays}');
    });

    it('renders all four sections of §6', () => {
        expect(src).toContain('<PublishHero');
        expect(src).toContain('<PublishFormSlot');
        expect(src).toContain('<PublishHowItWorks');
        expect(src).toContain('<PublishPlanLinks');
    });

    it('stays SSR, because it reads the session (AC-8)', () => {
        expect(src).toContain('export const prerender = false;');
    });
});
