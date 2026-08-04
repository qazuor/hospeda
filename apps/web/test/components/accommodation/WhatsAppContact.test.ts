/**
 * @file WhatsAppContact.test.ts
 * @description Source-read tests for WhatsAppContact (HOS-19), mirroring the
 * ExperienceContactCTA.astro convention. The authoritative VIEWER-gating logic
 * is unit-tested server-side (`resolveWhatsAppPayload`); this asserts the
 * component's three render branches and key rendering details.
 *
 * HOS-369 WB0-7 turned the component from a static `.astro` into an island, so
 * the source it reads is now a PAIR of files: markup and logic in the `.tsx`,
 * styles in the co-located CSS module. The CSS invariants below — every one of
 * them a HOS-314 contrast finding — moved with the stylesheet and are asserted
 * against it, not against the component, so none of them silently stopped
 * applying to an empty string when the file split.
 *
 * Render behaviour (what an anonymous visitor receives) is covered separately
 * in `WhatsAppContact.render.test.tsx`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findBareInkDeclarations } from '../../static-guards/ink-literals';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/WhatsAppContact.client.tsx'),
    'utf8'
);

const css = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/WhatsAppContact.module.css'),
    'utf8'
);

describe('WhatsAppContact', () => {
    it('reads both halves of the component', () => {
        // Non-vacuity: a wrong path would make `toContain` assertions below
        // throw, but `not.toContain` / `toEqual([])` ones would pass on ''.
        expect(src.length).toBeGreaterThan(500);
        expect(css.length).toBeGreaterThan(500);
    });

    describe('early return', () => {
        it('renders nothing when there is neither a number nor an upsell', () => {
            expect(src).toContain('if (!viewer.showUpsell && !viewer.number) return null;');
        });
    });

    describe('viewer resolution (HOS-369 WB0-7)', () => {
        it('starts from the anonymous variant, so SSR emits the upsell', () => {
            expect(src).toContain(
                'const UPSELL_ONLY: WhatsAppViewerState = { number: null, direct: false, showUpsell: true };'
            );
            expect(src).toContain('useState<WhatsAppViewerState>(UPSELL_ONLY)');
        });

        it('never calls the protected endpoint without a resolved session', () => {
            // The number is VIEWER-gated; a guest must not even reach the
            // endpoint, and must never be able to receive a number.
            expect(src).toContain('const { user } = useAccountPermissions();');
            expect(src).toContain('if (!user) {');
        });

        it('takes no viewer state as a prop', () => {
            // The regression this component was rewritten to prevent: an SSR
            // prop would put one viewer's entitled number into cached HTML.
            //
            // Scoped to the PROPS interface on purpose. Asserting over the whole
            // file cannot tell a prop from the internal `WhatsAppViewerState`,
            // which legitimately holds exactly these three fields — the first
            // draft of this test failed on that, which is the point of scoping.
            const propsBlock = /export interface WhatsAppContactProps \{([\s\S]*?)\n\}/.exec(src);
            expect(propsBlock, 'WhatsAppContactProps interface not found').not.toBeNull();
            const props = propsBlock?.[1] ?? '';
            expect(props.length).toBeGreaterThan(50);
            for (const forbidden of ['number', 'direct', 'showUpsell', 'entitled']) {
                expect(props).not.toContain(`readonly ${forbidden}`);
            }
        });
    });

    describe('direct (wa.me) branch', () => {
        it('only builds the wa.me URL when the viewer has the direct entitlement', () => {
            expect(src).toContain('if (viewer.number && viewer.direct)');
            expect(src).toContain('buildWhatsAppLink');
        });

        it('delegates phone sanitizing to the shared builder (HOS-289)', () => {
            // This replaces a test that asserted `startsWith('+')`, i.e. it pinned
            // the defect: with the `+`, wa.me does not resolve the recipient. The
            // URL shape itself is asserted in test/lib/whatsapp.test.ts; here we
            // only require that the component does not hand-roll it again.
            expect(src).toContain("import { buildWhatsAppLink } from '@/lib/whatsapp'");
            expect(src).not.toContain('replace(/\\D/g,');
            expect(src).not.toContain('wa.me/${');
        });

        it('opens the deep link in a new tab with noopener', () => {
            expect(src).toContain('target="_blank"');
            expect(src).toContain('rel="noopener noreferrer"');
        });
    });

    describe('display-only branch', () => {
        it('renders the number as text when not entitled to the direct link', () => {
            expect(src).toContain('className={styles.number}');
            expect(src).toContain('{viewer.number}');
        });
    });

    describe('upsell branch', () => {
        it('renders the upsell CTA pointing at the plans href', () => {
            expect(src).toContain('viewer.showUpsell ?');
            expect(src).toContain('className={styles.upsell}');
            expect(src).toContain('href={plansHref}');
        });
    });

    describe('i18n', () => {
        it('uses the accommodations.detail.whatsapp namespace', () => {
            expect(src).toContain('accommodations.detail.whatsapp.title');
            expect(src).toContain('accommodations.detail.whatsapp.cta');
            expect(src).toContain('accommodations.detail.whatsapp.upsellText');
        });

        it('injects the accommodation name into the message template', () => {
            expect(src).toContain('accommodationName');
            expect(src).toContain('{{name}}');
        });
    });

    describe('props', () => {
        it('accepts accommodationId, accommodationName and plansHref', () => {
            expect(src).toContain('readonly accommodationId: string');
            expect(src).toContain('readonly accommodationName: string');
            expect(src).toContain('readonly plansHref: string');
        });
    });

    describe('accessibility', () => {
        it('has aria-labels on the WhatsApp anchor and the number', () => {
            expect(src).toContain('aria-label=');
        });
    });

    describe('CSS', () => {
        // Until HOS-314 this suite asserted `toContain('#25d366')`, which meant
        // CI was certifying the hard-coded brand hex — and with it the 1.98:1
        // white-on-green pairing — rather than catching it.
        it('takes the WhatsApp brand colors from the channel tokens (HOS-314)', () => {
            expect(css).toContain('background-color: var(--channel-whatsapp)');
            expect(css).toContain('color: var(--channel-whatsapp-foreground)');
            expect(css).toContain('background-color: var(--channel-whatsapp-hover)');
            expect(css).toContain('color: var(--channel-whatsapp-text)');
        });

        // Reads each :hover rule's OWN body. An earlier revision sliced from one
        // selector to another, which returns '' the moment the stylesheet is
        // reordered — and `expect('').not.toContain(...)` passes forever.
        const hoverBody = (selector: string): string => {
            const match = new RegExp(`${selector.replace('.', '\\.')}:hover\\s*\\{([^}]*)\\}`).exec(
                css
            );
            expect(match, `no :hover rule found for ${selector}`).not.toBeNull();
            return match?.[1] ?? '';
        };

        it.each([
            '.button',
            '.upsellCta'
        ])('%s does not fade on hover (opacity dims ink and fill alike)', (selector) => {
            expect(hoverBody(selector)).not.toContain('opacity');
        });

        it('inks the upsell CTA with the primary-foreground token, not a literal', () => {
            // Hard-coded `white` here measured 2.93:1 on the dark brand blue —
            // below every AA floor — on the branch anonymous visitors see.
            expect(css).toContain('color: var(--primary-foreground)');
        });

        it('takes EVERY text colour from a token, wherever it is declared', () => {
            // This is where HOS-314's pairing invariant lives. It is a whole-FILE
            // rule on purpose: the three static-guard revisions that tried to
            // check it per rule were each defeated by the cascade (a duplicate
            // selector, a @media re-declaration, a descendant, or
            // -webkit-text-fill-color overriding the ink from somewhere the
            // selector regex never looked). Asking "is any ink a literal" makes
            // position irrelevant and covers every spelling of white at once.
            expect(findBareInkDeclarations(css)).toEqual([]);
        });

        it('does not use Tailwind utility classes (web is vanilla CSS)', () => {
            expect(src).not.toMatch(/className="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
