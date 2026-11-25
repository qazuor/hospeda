/**
 * @file HOS-2559: the owner index is one list per vertical. The decision and the
 * filter are unit-tested in `test/lib/listing/owner-list-vertical.test.ts`; this
 * file pins the page wiring that a source read can prove.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
    'utf8'
);
const frontmatter = source.split('---')[1] ?? '';

describe('comercio index — one list per vertical (HOS-2559)', () => {
    it('decides the list from the query and the EFFECTIVE permissions, never a role', () => {
        expect(frontmatter).toContain('resolveOwnerListPage({');
        expect(frontmatter).toContain('Astro.url.searchParams.get(OWNER_LIST_VERTICAL_PARAM)');
        expect(frontmatter).toContain('permissions: user.permissions');
        expect(frontmatter).not.toContain('hasListingNavAccess');
        expect(frontmatter).not.toMatch(/user\.roles\.includes/);
    });

    it('leaves the page with neither vertical, and canonicalises any other URL', () => {
        expect(frontmatter).toMatch(
            /decision\.kind === 'forbidden'\) \{\s*return Astro\.redirect\(publisherDenyRedirect\(\{ locale \}\)\);/
        );
        expect(frontmatter).toMatch(
            /decision\.kind === 'redirect'\) \{\s*return Astro\.redirect\(buildUrl\(\{ locale, path: ownerListPath\(\{ vertical: decision\.vertical \}\) \}\)\);/
        );
    });

    it('reads ONLY the list vertical (one request, HOS-2484) and filters before anything reads them', () => {
        expect(frontmatter).toMatch(
            /listings = filterOwnerListingsByVertical\(\{\s*listings: await fetchOwnerListingsWithState\(\{ vertical: listVertical, cookieHeader \}\),\s*vertical: listVertical\s*\}\);/
        );
    });

    it('marks the matching sidebar area active and titles the page with its name', () => {
        expect(source).toContain('activeSection={ownerListSectionKey({ vertical: listVertical })}');
        expect(frontmatter).toContain('t(OWNER_LIST_LABEL_KEYS[listVertical])');
    });
});
