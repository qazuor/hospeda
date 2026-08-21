/**
 * PartnerMentionsSection.astro — source-level tests (HOS-377 T-027).
 *
 * ## What this suite can and cannot prove
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline — `experimental_AstroContainer` fails to transform the file), so
 * these assertions read the SOURCE. That is the documented pattern here, and it
 * has a real blind spot worth naming: a source test cannot tell a branch that
 * is DECLARED from one that is REACHED. It proves the linkless branch exists
 * and renders a `<span>`; it does not prove a null `url` takes it.
 *
 * The behaviour those assertions stand in for IS covered where it can actually
 * execute: the grouping and the `internalNote` strip are pinned by the service
 * suite (`partner-mention.reads-and-corrections.test.ts`, mutation-verified),
 * and the same no-anchor rule is pinned on rendered DOM by the admin twin
 * (`PartnerMentionsSection.test.tsx`). This file guards the web-specific
 * decisions that live only in this file: the AC-3 copy contract, the
 * ownership-not-permission gate, CSS-token discipline, and the zero-JS choice.
 *
 * @module test/components/account/PartnerMentionsSection
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/account/PartnerMentionsSection.astro'),
    'utf8'
);

const PAGE_SOURCE = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/aliados/index.astro'),
    'utf8'
);

const DOORS_SOURCE = readFileSync(
    resolve(__dirname, '../../../src/config/discovery-doors.ts'),
    'utf8'
);

/**
 * Strips comments so a copy assertion reads the MARKUP, not the prose about it.
 *
 * Needed because a docstring that spells out the banned words in order to ban
 * them would otherwise fail the AC-3 assertion below. A test that cannot tell a
 * rule from a violation of it is worse than no test — it trains you to delete
 * the assertion.
 *
 * ## Line comments are stripped FIRST, and the order is load-bearing
 *
 * The aliados page carries the line comment `// … protects /mi-cuenta/*
 * automatically …`. That path glob ends in `/*`, which a block-comment regex
 * reads as an OPENING delimiter — it then runs to the next `*​/` hundreds of
 * lines later and silently swallows the entire data-fetching block, leaving a
 * file that passes "contains no banned word" because it contains almost
 * nothing. Removing line comments first takes the impostor delimiter with them.
 */
function withoutComments(source: string): string {
    return source
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
}

const MARKUP = withoutComments(SOURCE);
const PAGE_MARKUP = withoutComments(PAGE_SOURCE);

describe('PartnerMentionsSection — AC-3 copy contract', () => {
    it('speaks no metric vocabulary in the markup, in copy or in class names', () => {
        const lowered = MARKUP.toLowerCase();

        for (const word of ['alcance', 'impresion', 'clics', 'estadística', 'estadistica']) {
            expect(lowered).not.toContain(word);
        }
    });

    it('routes every visible string through i18n rather than hardcoding it', () => {
        // A hardcoded string is invisible to the T-030 copy guard, which scans
        // the i18n JSON — so an AC-3 violation typed straight into the markup
        // would never be caught.
        expect(SOURCE).toContain("t('account.partnerMentions.title')");
        expect(SOURCE).toContain("t('account.partnerMentions.empty')");
        expect(SOURCE).toContain("t('account.partnerMentions.viewPublication')");
    });
});

describe('PartnerMentionsSection — the linkless channel', () => {
    it('declares a non-anchor branch for a mention with no usable url', () => {
        // Source-level: proves the branch EXISTS, not that a null url reaches
        // it. The rendered-DOM proof is the admin twin's test.
        //
        // The branch is driven by the SANITIZED href, not by the raw field
        // (HOS-592): a stored `javascript:` permalink has to land in the same
        // plain-text branch a link-less channel already gets, so the condition
        // and the `href` must read the same resolved binding.
        expect(SOURCE).toContain('resolveSafeExternalUrl(mention.url)');
        expect(SOURCE).toContain('mentionHref ?');
        expect(SOURCE).toContain('href={mentionHref}');
        expect(SOURCE).not.toContain('href={mention.url}');
        expect(SOURCE).toContain('partner-mentions__no-link');
        expect(SOURCE).toContain("t('account.partnerMentions.noPublicationLink')");
    });

    it('opens publications in a new tab with a safe rel', () => {
        expect(SOURCE).toContain('target="_blank"');
        expect(SOURCE).toContain('rel="noreferrer noopener"');
    });
});

describe('PartnerMentionsSection — web styling rules', () => {
    it('uses CSS custom properties, never hardcoded colours', () => {
        // Every declared colour/spacing value must be a token, or dark mode
        // breaks silently on this section alone.
        expect(SOURCE).toContain('var(--core-card)');
        expect(SOURCE).toContain('var(--core-muted-foreground)');
        expect(MARKUP).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });

    it('is a scoped <style> block, not Tailwind', () => {
        expect(SOURCE).toContain('<style>');
        expect(MARKUP).not.toMatch(/class="[^"]*\b(text-sm|rounded-md|bg-primary)\b/);
    });

    it('ships zero JavaScript — no client directive anywhere', () => {
        // Pure Astro is also what keeps these keys out of the browser
        // dictionary, so no CLIENT_I18N_KEY_PREFIXES entry is needed.
        expect(MARKUP).not.toMatch(/client:(load|idle|visible|media|only)/);
    });
});

describe('PartnerMentionsSection — wired by ownership, never by permission', () => {
    it('is gated on the partner row existing, not on a permission', () => {
        expect(PAGE_MARKUP).toContain('visible={myPartner !== null}');
    });

    it('never adds an acquiredPermission to the partner door option', () => {
        // HOS-277 NG-1: the partner option is lead-only by design. An approved
        // aliado is an ordinary account, so there is no permission for that
        // mechanism to read, and inventing one would change who can see the
        // door itself — not just this section.
        //
        // Asserted on the CONFIG, which is where the violation would actually
        // be written. The page can only consume the door; it cannot grant it a
        // permission, so scanning the page proves nothing.
        const partnerOption = DOORS_SOURCE.slice(
            DOORS_SOURCE.indexOf("id: 'partner'"),
            DOORS_SOURCE.indexOf("id: 'partner'") + 1200
        );
        expect(partnerOption).not.toContain('acquiredPermission');
    });

    it('fetches the log in the SAME parallel batch as the other account reads', () => {
        // Chaining it off the partner fetch would add a full API round-trip to
        // an uncacheable SSR page's TTFB for no dependency: ownership is
        // resolved server-side from the session, not from the partner id.
        expect(PAGE_MARKUP).toContain('partnersApi.mineMentions({ cookieHeader })');
        const promiseAll = PAGE_MARKUP.slice(
            PAGE_MARKUP.indexOf('await Promise.all(['),
            PAGE_MARKUP.indexOf('])', PAGE_MARKUP.indexOf('await Promise.all(['))
        );
        expect(promiseAll).toContain('mineMentions');
    });

    it('degrades to an empty list rather than erroring the page', () => {
        expect(PAGE_MARKUP).toContain('myMentionsResult.ok ? myMentionsResult.data.batches : []');
    });
});

describe('PartnerMentionsSection — AC-5 separation survives HOS-294', () => {
    it('carries the constraint as a comment for whoever builds "Tus métricas"', () => {
        // The separation is a product decision that lives nowhere in the type
        // system. A comment in the file the next person opens is the only
        // place it can actually be read at the moment it would be violated.
        expect(SOURCE).toContain('AC-5');
        expect(SOURCE).toContain('HOS-294');
    });
});
