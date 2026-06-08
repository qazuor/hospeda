/**
 * SPEC-187 P2-T9 — accommodation detail render rule.
 *
 * Astro components are source-tested in this app. We therefore verify two
 * layers:
 * 1. behavior of the two render pipelines (`renderContent` / `renderPlain`)
 * 2. source wiring on `[slug].astro` — presence of `richDescription` is the
 *    ONLY signal, with no entitlement imports in the page module.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderContent } from '../../src/lib/render-content';
import { renderPlain } from '../../src/lib/render-plain';

const PAGE_SRC = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/alojamientos/[slug].astro'),
    'utf8'
);

describe('accommodation detail render rule — SPEC-187 P2-T9', () => {
    it('renderContent turns rich markdown into HTML with heading + strong tags', () => {
        const html = renderContent({
            raw: '## Premium\n\n**luxury**',
            siteOrigin: 'https://hospeda.test'
        });

        expect(html).toContain('<h2>Premium</h2>');
        expect(html).toContain('<strong>luxury</strong>');
    });

    it('renderPlain keeps markdown markers as escaped plain text', () => {
        const text = renderPlain({ raw: '## Premium\n\n**luxury**' });

        expect(text).toContain('**luxury**');
        expect(text).not.toContain('<h2>');
        expect(text).not.toContain('<strong>');
    });

    it('page source uses a presence rule based on accommodation.richDescription', () => {
        expect(PAGE_SRC).toMatch(/accommodation\.richDescription\s*\?/);
    });

    it('page module does not import EntitlementKey or hasEntitlement', () => {
        expect(PAGE_SRC).not.toMatch(/import\s*\{[^}]*EntitlementKey/);
        expect(PAGE_SRC).not.toMatch(/import\s*\{[^}]*hasEntitlement/);
        expect(PAGE_SRC).not.toContain('hasEntitlement(');
        expect(PAGE_SRC).not.toContain('EntitlementKey.');
    });
});
