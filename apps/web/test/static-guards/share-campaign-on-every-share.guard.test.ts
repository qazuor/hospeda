/**
 * @file Guard: every share entry point in an Astro page passes a `campaign`.
 *
 * `withUtm()` (HOS-2359) throws on a missing or unknown `utm_campaign`, so a page
 * that renders share buttons without one fails at SSR with a 500. Astro pages are
 * not covered by `tsc --noEmit`, which is how the experience and venue detail
 * pages shipped without it. This guard reads the page sources instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SHARE_CAMPAIGNS } from '@repo/analytics';
import { describe, expect, it } from 'vitest';

const PAGES_DIR = join(__dirname, '..', '..', 'src', 'pages');

const listAstroFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return listAstroFiles(full);
        return full.endsWith('.astro') ? [full] : [];
    });

/** A single-line `share: { ... }` object literal (it holds `${}` template parts). */
const SHARE_OBJECT = /\bshare:\s*\{(.*)\}/g;
/** A `<ShareButtons ... />` element. */
const SHARE_BUTTONS = /<ShareButtons\b([^>]*)>/g;
const CAMPAIGN_VALUE = /campaign(?::\s*|=)["']([a-z-]+)["']/;

const collectShareSites = (): ReadonlyArray<{ file: string; snippet: string }> =>
    listAstroFiles(PAGES_DIR).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        const sites = [...source.matchAll(SHARE_OBJECT), ...source.matchAll(SHARE_BUTTONS)];
        return sites.map((match) => ({ file: relative(PAGES_DIR, file), snippet: match[1] ?? '' }));
    });

describe('share campaign on every share entry point (HOS-2359)', () => {
    const sites = collectShareSites();

    it('finds the known share entry points (guard is not vacuous)', () => {
        const files = new Set(sites.map((site) => site.file));
        expect(files).toContain(join('[lang]', 'alojamientos', '[slug].astro'));
        expect(files).toContain(join('[lang]', 'experiencias', '[slug].astro'));
        expect(files).toContain(join('[lang]', 'comer-y-salir', '[slug].astro'));
    });

    it('passes a campaign from SHARE_CAMPAIGNS at every site', () => {
        const allowed: readonly string[] = SHARE_CAMPAIGNS;
        const offenders = sites
            .filter((site) => {
                const value = CAMPAIGN_VALUE.exec(site.snippet)?.[1];
                return value === undefined || !allowed.includes(value);
            })
            .map((site) => `${site.file}: ${site.snippet.trim().replace(/\s+/g, ' ')}`);
        expect(
            offenders,
            `share entry points without a valid campaign:\n${offenders.join('\n')}`
        ).toEqual([]);
    });
});
