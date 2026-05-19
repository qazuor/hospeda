/**
 * Tests for scripts/check-links.ts (SPEC-106 T-106-00 + T-106-12 era).
 *
 * Covers:
 * 1. Absolute-link candidate resolution with content-collection aliases.
 *    Some Astro routes (e.g. `/beta/host/dashboard/`) are generated at build
 *    time from content-collection files on disk; the link checker must accept
 *    these as valid even though the URL path does not match the on-disk path.
 * 2. Link extraction across the three accepted forms (absolute, ./, ../) and
 *    rejection of external schemes / anchor-only links / bare relative paths.
 */

import { describe, expect, it } from 'vitest';
import {
    CONTENT_COLLECTION_ALIASES,
    extractInternalLinks,
    resolveAbsoluteLinkCandidates
} from '../check-links';

const FAKE_ROOT = '/repo';

describe('resolveAbsoluteLinkCandidates', () => {
    it('always returns the literal `<root><link>` as the first candidate', () => {
        const candidates = resolveAbsoluteLinkCandidates({
            absoluteLink: '/docs/foo.md',
            projectRoot: FAKE_ROOT
        });

        expect(candidates[0]).toBe('/repo/docs/foo.md');
    });

    it('adds <collection>/<rest>.md and <collection>/<rest>/index.md for matching aliases', () => {
        const candidates = resolveAbsoluteLinkCandidates({
            absoluteLink: '/beta/host/dashboard/',
            projectRoot: FAKE_ROOT
        });

        expect(candidates).toContain('/repo/apps/web/src/content/beta/host/dashboard.md');
        expect(candidates).toContain('/repo/apps/web/src/content/beta/host/dashboard/index.md');
    });

    it('handles a leaf path without trailing slash', () => {
        const candidates = resolveAbsoluteLinkCandidates({
            absoluteLink: '/beta/faq',
            projectRoot: FAKE_ROOT
        });

        expect(candidates).toContain('/repo/apps/web/src/content/beta/faq.md');
        expect(candidates).toContain('/repo/apps/web/src/content/beta/faq/index.md');
    });

    it('treats the collection root URL as the index of the collection', () => {
        const candidates = resolveAbsoluteLinkCandidates({
            absoluteLink: '/beta/',
            projectRoot: FAKE_ROOT
        });

        expect(candidates).toContain('/repo/apps/web/src/content/beta/index.md');
    });

    it('does not add alias candidates for paths that do not match any prefix', () => {
        const candidates = resolveAbsoluteLinkCandidates({
            absoluteLink: '/docs/architecture/overview.md',
            projectRoot: FAKE_ROOT
        });

        expect(candidates).toEqual(['/repo/docs/architecture/overview.md']);
    });

    it('exposes the alias map for discoverability', () => {
        expect(CONTENT_COLLECTION_ALIASES.length).toBeGreaterThan(0);
        const beta = CONTENT_COLLECTION_ALIASES.find((a) => a.urlPrefix === '/beta/');
        expect(beta).toBeDefined();
        expect(beta?.fsPrefix).toBe('apps/web/src/content/beta/');
    });
});

describe('extractInternalLinks', () => {
    it('skips external schemes (http, https, mailto, tel) and anchor-only links', () => {
        const content = [
            '[Web](https://hospeda.com.ar)',
            '[Plain http](http://example.com)',
            '[Email](mailto:a@b.com)',
            '[Phone](tel:+5491111)',
            '[Anchor only](#section)'
        ].join('\n');

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/docs/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toEqual([]);
    });

    it('extracts absolute links and produces alias-aware candidates', () => {
        const content = '[Dashboard](/beta/host/dashboard/)';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/apps/web/src/content/beta/host/crear-alojamiento.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toHaveLength(1);
        const first = links[0];
        expect(first?.linkText).toBe('Dashboard');
        expect(first?.targetPaths).toContain('/repo/beta/host/dashboard/');
        expect(first?.targetPaths).toContain('/repo/apps/web/src/content/beta/host/dashboard.md');
    });

    it('extracts ./ relative links resolved against the source file directory', () => {
        const content = '[Sibling](./sibling.md)';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/docs/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links[0]?.targetPaths).toEqual(['/repo/docs/sibling.md']);
    });

    it('extracts ../ relative links', () => {
        const content = '[Parent](../guides/parent.md)';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/docs/area/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links[0]?.targetPaths).toEqual(['/repo/docs/guides/parent.md']);
    });

    it('ignores bare relative paths (no leading /, ./, or ../) because they are ambiguous', () => {
        const content = '[Bare](some/where.md)';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/docs/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toEqual([]);
    });

    it('strips anchors before resolving but reports the link unchanged', () => {
        const content = '[With anchor](/docs/foo.md#section-1)';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toHaveLength(1);
        expect(links[0]?.targetPaths[0]).toBe('/repo/docs/foo.md');
    });

    it('records the correct 1-based line for each link', () => {
        const content = ['intro', '', '[A](/a.md)', 'something', '[B](/b.md)'].join('\n');

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toHaveLength(2);
        expect(links[0]?.line).toBe(3);
        expect(links[1]?.line).toBe(5);
    });

    it('handles multiple links on the same line', () => {
        const content = 'See [A](/a.md) and [B](/b.md) for details.';

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        expect(links).toHaveLength(2);
        expect(links[0]?.linkText).toBe('A');
        expect(links[1]?.linkText).toBe('B');
    });

    it('skips links inside fenced code blocks (backticks)', () => {
        const content = [
            '[Real](/real.md)',
            '```bash',
            '[Fake](/fake.md)',
            '```',
            '[Also real](/also-real.md)'
        ].join('\n');

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        const texts = links.map((l) => l.linkText);
        expect(texts).toEqual(['Real', 'Also real']);
    });

    it('skips links inside tilde-fenced code blocks', () => {
        const content = ['~~~markdown', '[Fake](/inside.md)', '~~~', '[Real](/outside.md)'].join(
            '\n'
        );

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        const texts = links.map((l) => l.linkText);
        expect(texts).toEqual(['Real']);
    });

    it('treats consecutive code blocks correctly (each fence toggles state)', () => {
        const content = [
            '```',
            '[A](/a.md)',
            '```',
            '[B](/b.md)',
            '```',
            '[C](/c.md)',
            '```',
            '[D](/d.md)'
        ].join('\n');

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        const texts = links.map((l) => l.linkText);
        expect(texts).toEqual(['B', 'D']);
    });

    it('handles code fences with info strings (```ts, ```bash)', () => {
        const content = [
            '```ts',
            "const link = '[fake](/fake.md)';",
            '```',
            '[real](/real.md)'
        ].join('\n');

        const links = extractInternalLinks({
            content,
            sourceFile: '/repo/x.md',
            projectRoot: FAKE_ROOT
        });

        const texts = links.map((l) => l.linkText);
        expect(texts).toEqual(['real']);
    });
});
