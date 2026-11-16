/**
 * @file umami-tag.test.ts
 * @description Source-level tests for the Umami page-tag wiring (HOS-2119 T-074).
 *
 * Vitest cannot render `.astro` here (see `umami-script.test.ts`), so these
 * assertions read the SOURCE. Contract under test:
 * - `UmamiScript` renders `<meta name="umami-tag">` only for a valid tag
 *   (UUID-shaped, <= 50 chars); an invalid or absent tag renders no meta;
 * - the tracker element never carries `data-tag`: the router does not re-run
 *   it on a soft navigation and the tracker reads `data-tag` once, so the
 *   attribute would stick to the first page of the visit (C1). The swapped
 *   meta is read per page load by `umami-pageview.ts`;
 * - the tag travels `page -> DetailLayout|DefaultLayout -> BaseLayout ->
 *   UmamiScript`, each hop forwarding it;
 * - exactly the four public detail pages pass it, each with the SAME id the
 *   owner traffic-stats route uses as Umami `tag` (the listing/partner row id);
 * - no other page under `src/pages` passes a tag.
 *
 * The definitive check is the staging deploy: the rendered `<head>` of a detail
 * page must carry `<meta name="umami-tag" content="<uuid>">`, and a pageview
 * after a soft navigation must carry the destination page's tag.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../../src');
const PAGES_ROOT = join(SRC_ROOT, 'pages');
const read = (relative: string): string => readFileSync(resolve(SRC_ROOT, relative), 'utf8');

/** Source with block and HTML comments removed. */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');

const listAstro = (dir: string): readonly string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return listAstro(full);
        return name.endsWith('.astro') ? [full] : [];
    });

const SCRIPT = stripComments(read('components/analytics/UmamiScript.astro'));
const SCRIPT_TEMPLATE = SCRIPT.split(/^---\s*$/m)
    .slice(2)
    .join('---');
const BASE = stripComments(read('layouts/BaseLayout.astro'));

/** Page (relative to `src/`) -> the exact expression it must pass as the tag. */
const TAGGED_PAGES = {
    'pages/[lang]/alojamientos/[slug].astro': 'accommodation.id',
    'pages/[lang]/comer-y-salir/[slug].astro': 'venue.id',
    'pages/[lang]/experiencias/[slug].astro': 'experience.id',
    'pages/[lang]/partners/[slug].astro': 'partnerId'
} as const;

describe('UmamiScript — page tag', () => {
    it('declares an optional tag prop', () => {
        expect(SCRIPT).toMatch(/readonly tag\?:\s*string/);
        expect(SCRIPT).toMatch(/=\s*Astro\.props/);
    });

    it('renders the tag meta from the validated tag, never from the raw prop', () => {
        expect(SCRIPT_TEMPLATE).toMatch(
            /shouldRender && validTag && <meta name="umami-tag" content=\{validTag\} \/>/
        );
        expect(SCRIPT_TEMPLATE).not.toMatch(/content=\{tag\}/);
    });

    it('never puts the tag on the tracker element', () => {
        expect(SCRIPT_TEMPLATE).not.toContain('data-tag');
    });

    it('uses the meta name the pageview script reads', () => {
        const pageview = read('lib/analytics/umami-pageview.ts');
        expect(pageview).toContain("UMAMI_TAG_META_NAME = 'umami-tag'");
    });

    it('accepts only a UUID-shaped tag of at most 50 characters', () => {
        expect(SCRIPT).toMatch(/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}/i);
        expect(SCRIPT).toMatch(/UMAMI_TAG_MAX_LENGTH\s*=\s*50/);
        expect(SCRIPT).toMatch(/tag\.length\s*<=\s*UMAMI_TAG_MAX_LENGTH/);
        expect(SCRIPT).toMatch(/validTag[\s\S]*:\s*undefined/);
    });

    it('renders a single tracker element', () => {
        expect(SCRIPT_TEMPLATE.match(/<script\b[^>]*\bsrc=/g)).toHaveLength(1);
    });
});

describe('tag pass-through chain', () => {
    it('BaseLayout accepts analyticsTag and hands it to UmamiScript', () => {
        expect(BASE).toMatch(/readonly analyticsTag\?:\s*string/);
        expect(BASE).toMatch(/<UmamiScript\s+tag=\{analyticsTag\}\s*\/>/);
    });

    it.each([
        'layouts/DetailLayout.astro',
        'layouts/DefaultLayout.astro'
    ])('%s accepts analyticsTag and forwards it to BaseLayout', (layout) => {
        const code = stripComments(read(layout));
        expect(code).toMatch(/readonly analyticsTag\?:\s*string/);
        expect(code).toMatch(/<BaseLayout\b[^>]*\banalyticsTag=\{analyticsTag\}/);
    });
});

describe('which pages pass a tag', () => {
    it.each(Object.entries(TAGGED_PAGES))('%s passes %s as analyticsTag', (page, expression) => {
        const code = stripComments(read(page));
        expect(code).toContain(`analyticsTag={${expression}}`);
    });

    it('no other page under src/pages passes a tag', () => {
        const allowed = new Set(Object.keys(TAGGED_PAGES));
        const offenders = listAstro(PAGES_ROOT)
            .filter((file) =>
                /\banalyticsTag\s*=|\bdata-tag\b|umami-tag/.test(
                    stripComments(readFileSync(file, 'utf8'))
                )
            )
            .map((file) => file.slice(SRC_ROOT.length + 1))
            .filter((rel) => !allowed.has(rel));
        expect(offenders).toEqual([]);
    });

    it('only UmamiScript renders the tag meta, and nothing renders data-tag', () => {
        const metaHolders = listAstro(SRC_ROOT)
            .filter((file) => /umami-tag/.test(stripComments(readFileSync(file, 'utf8'))))
            .map((file) => file.slice(SRC_ROOT.length + 1));
        expect(metaHolders).toEqual(['components/analytics/UmamiScript.astro']);
        const dataTagHolders = listAstro(SRC_ROOT).filter((file) =>
            /\bdata-tag\b/.test(stripComments(readFileSync(file, 'utf8')))
        );
        expect(dataTagHolders).toEqual([]);
    });
});
