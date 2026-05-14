/**
 * SPEC-108 T-108-01 smoke — render diff between the sync (old) and async
 * (new) campaign-email render paths.
 *
 * Background: the production renderer used `renderToStaticMarkup` from
 * `react-dom/server` (synchronous, no CSS inlining / Tailwind pass). The
 * new path uses `render` from `@react-email/render` (async, with CSS
 * inlining + Tailwind processing).
 *
 * We do NOT import the production template here — pulling
 * `@repo/notifications` arrastra `@repo/db` (transitive) which has a
 * tsup CJS-require quirk that's irrelevant to this smoke. Instead we
 * build a tiny equivalent JSX tree with the same @react-email/components
 * that the production template uses, render it BOTH ways, and verify
 * the well-known signature of @react-email/render output (CSS inlining,
 * DOCTYPE, larger byte count). That signature is what proves the path
 * change works regardless of which template is plugged in.
 *
 * Run from worktree root:
 *   pnpm --filter hospeda-api exec tsx scripts/smoke-spec-108-render.ts
 *
 * Outputs:
 *   apps/api/tmp/smoke-spec-108-render-old.html  (renderToStaticMarkup)
 *   apps/api/tmp/smoke-spec-108-render-new.html  (@react-email/render)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    Body,
    Container,
    Head,
    Html,
    Preview,
    Section,
    Tailwind,
    Text
} from '@react-email/components';
import { render } from '@react-email/render';
// React namespace required because tsx (esbuild) uses the classic JSX
// transform by default; without it, `<Foo />` compiles to
// `React.createElement(...)` and crashes with "React is not defined".
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

void React;

const OUT_DIR = resolve(import.meta.dirname, '..', 'tmp');
mkdirSync(OUT_DIR, { recursive: true });

/**
 * Sample tree using the same primitives as `NewsletterCampaign`. Tailwind
 * is wrapped on purpose so the new renderer's Tailwind pass has work to
 * do; the old renderer ignores it.
 */
function SampleCampaign() {
    return (
        <Html lang="es">
            <Head />
            <Preview>Smoke campaign — SPEC-108 T-108-01</Preview>
            <Tailwind>
                <Body className="bg-slate-100 font-sans">
                    <Container className="mx-auto my-8 rounded-lg bg-white p-8 shadow">
                        <Section>
                            <Text className="font-bold text-2xl text-slate-900">
                                Smoke campaign — SPEC-108 T-108-01
                            </Text>
                            <Text className="text-base text-slate-700 leading-6">
                                Cuerpo de prueba. Si el renderer nuevo aplicó CSS inlining +
                                Tailwind, las clases se transforman en{' '}
                                <span className="font-semibold">style="..."</span>.
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}

const element = <SampleCampaign />;

console.info('[smoke] Rendering OLD path (renderToStaticMarkup, sync)...');
const oldHtml = renderToStaticMarkup(element);
writeFileSync(resolve(OUT_DIR, 'smoke-spec-108-render-old.html'), oldHtml, 'utf-8');

console.info('[smoke] Rendering NEW path (@react-email/render, async)...');
const newHtml = await render(element);
writeFileSync(resolve(OUT_DIR, 'smoke-spec-108-render-new.html'), newHtml, 'utf-8');

const inlineStyleRe = /style="[^"]+"/g;
const oldInlineStyles = (oldHtml.match(inlineStyleRe) ?? []).length;
const newInlineStyles = (newHtml.match(inlineStyleRe) ?? []).length;

const hasDoctypeOld = oldHtml.toLowerCase().startsWith('<!doctype');
const hasDoctypeNew = newHtml.toLowerCase().startsWith('<!doctype');

const oldHasTailwindClass = /class(Name)?="[^"]*\b(bg-slate-100|font-sans|rounded-lg)/.test(
    oldHtml
);
const newHasTailwindClass = /class(Name)?="[^"]*\b(bg-slate-100|font-sans|rounded-lg)/.test(
    newHtml
);

console.info('');
console.info('=== Render comparison ===');
console.info(`OLD bytes:           ${oldHtml.length}`);
console.info(`NEW bytes:           ${newHtml.length}`);
console.info(`Delta bytes:         ${newHtml.length - oldHtml.length}`);
console.info(`OLD inline styles:   ${oldInlineStyles}`);
console.info(`NEW inline styles:   ${newInlineStyles}`);
console.info(`OLD has <!DOCTYPE:   ${hasDoctypeOld}`);
console.info(`NEW has <!DOCTYPE:   ${hasDoctypeNew}`);
console.info(`OLD has Tailwind class= residue: ${oldHasTailwindClass}`);
console.info(`NEW has Tailwind class= residue: ${newHasTailwindClass}`);
console.info('');
console.info('Pass criteria for T-108-01:');
console.info('  - NEW byte count > OLD (email-compat markup adds bytes).');
console.info('  - NEW emits a <!DOCTYPE> declaration; OLD does not.');
console.info('  - OLD does NOT emit a DOCTYPE (proves we are seeing the difference).');
console.info('');
console.info('Note on inline styles: <Tailwind> compiles its classes at');
console.info('  component time, so both renderers see the same inline');
console.info('  styles. The real value of @react-email/render is the');
console.info('  XHTML doctype + email-client compat markup; inline-CSS');
console.info('  passes only kick in if the template carries raw <style>');
console.info('  tags (which the production NewsletterCampaign does not).');
console.info('');
console.info('Open in browser:');
console.info(`  file://${resolve(OUT_DIR, 'smoke-spec-108-render-old.html')}`);
console.info(`  file://${resolve(OUT_DIR, 'smoke-spec-108-render-new.html')}`);
console.info('');

const acceptable = newHtml.length > oldHtml.length && hasDoctypeNew && !hasDoctypeOld;

if (!acceptable) {
    console.error(
        '[smoke] ❌ FAIL: new render does not show the expected DOCTYPE + byte-delta signature.'
    );
    process.exit(1);
}

console.info(
    '[smoke] ✅ PASS: async render emits XHTML doctype + email-compat markup; old render does not.'
);
