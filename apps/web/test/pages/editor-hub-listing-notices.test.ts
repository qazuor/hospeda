/**
 * @file editor-hub-listing-notices.test.ts
 * @description TEST:1762:2 (accommodation hub) and TEST:1762:3 (venue/experience hub):
 * the editor hubs show the same listing notices the listing card shows.
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline), so this file reads the two hubs' source. It pins the decisions the
 * page owns: the notices are loaded in the SAME `Promise.all` as the support
 * edits, the conditional container renders above `<SupportEditNotice>` and
 * `<EditorHub>` (and, in the venue/experience hub, below the identity row), the component
 * receives the resolved vertical and listing id, and the page stylesheet spaces
 * the container without an inline `style=`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ACCOMMODATION_HUB = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/index.astro'),
    'utf8'
);

const LISTING_HUB = readFileSync(
    resolve(
        __dirname,
        '../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/index.astro'
    ),
    'utf8'
);

function styleBlock({ source }: { readonly source: string }): string {
    const start = source.indexOf('<style>');
    const end = source.indexOf('</style>');
    return start >= 0 && end > start ? source.slice(start, end) : '';
}

function callBlock({
    source,
    callee
}: {
    readonly source: string;
    readonly callee: string;
}): string {
    const start = source.indexOf(`${callee}({`);
    if (start < 0) return '';
    const end = source.indexOf('})', start);
    return source.slice(start, end + 2);
}

describe('TEST:1762:2 accommodation editor hub — the listing notices above the sections', () => {
    it('imports the notices component and its loader', () => {
        expect(ACCOMMODATION_HUB).toContain(
            "import ListingNotices from '@/components/listing/ListingNotices.astro';"
        );
        expect(ACCOMMODATION_HUB).toContain(
            "import { loadListingNoticesItem } from '@/lib/listing/listing-notices-loader';"
        );
    });

    it('loads the notices with the accommodation vertical and the resolved id', () => {
        expect(ACCOMMODATION_HUB).toContain('loadListingNoticesItem({');
        expect(ACCOMMODATION_HUB).toContain("vertical: 'accommodation'");
        expect(ACCOMMODATION_HUB).toContain('listingId: accommodationId');
    });

    it('reads the notices and the support edits in the same Promise.all', () => {
        const parallel = ACCOMMODATION_HUB.indexOf('Promise.all([');
        expect(parallel).toBeGreaterThanOrEqual(0);
        expect(parallel).toBeLessThan(ACCOMMODATION_HUB.indexOf('loadSupportEdits({'));
        expect(parallel).toBeLessThan(ACCOMMODATION_HUB.indexOf('loadListingNoticesItem({'));
        expect(ACCOMMODATION_HUB).not.toContain('await loadSupportEdits({');
    });

    it('renders the conditional container above the support notice and the hub', () => {
        expect(ACCOMMODATION_HUB).toContain('data-testid="editor-hub-listing-notices"');
        expect(ACCOMMODATION_HUB).toContain('<ListingNotices');
        const notices = ACCOMMODATION_HUB.indexOf('editor-hub-listing-notices');
        expect(notices).toBeLessThan(ACCOMMODATION_HUB.indexOf('<SupportEditNotice'));
        expect(ACCOMMODATION_HUB.indexOf('<SupportEditNotice')).toBeLessThan(
            ACCOMMODATION_HUB.indexOf('<EditorHub')
        );
        expect(ACCOMMODATION_HUB).toContain('notices.length > 0');
    });

    it('passes the resolved vertical, the listing id and the entry to the component', () => {
        expect(ACCOMMODATION_HUB).toContain('vertical="accommodation"');
        expect(ACCOMMODATION_HUB).toContain('listingId={accommodationId}');
        expect(ACCOMMODATION_HUB).toContain('item={listingNotices.item}');
    });

    it('spaces the container from the page stylesheet, never with an inline style', () => {
        expect(styleBlock({ source: ACCOMMODATION_HUB })).toContain('.editor-hub__notices');
        expect(styleBlock({ source: ACCOMMODATION_HUB })).toContain('gap:');
        expect(ACCOMMODATION_HUB).not.toMatch(/\sstyle=/);
    });
});

describe('TEST:1762:3 venue/experience editor hub — the listing notices above the sections', () => {
    it('imports the notices component and its loader', () => {
        expect(LISTING_HUB).toContain(
            "import ListingNotices from '@/components/listing/ListingNotices.astro';"
        );
        expect(LISTING_HUB).toContain(
            "import { loadListingNoticesItem } from '@/lib/listing/listing-notices-loader';"
        );
    });

    it('loads the notices with the vertical and id of the page resolution', () => {
        const call = callBlock({ source: LISTING_HUB, callee: 'loadListingNoticesItem' });

        expect(call).not.toBe('');
        expect(call).toContain('vertical,');
        expect(call).toContain('listingId,');
        expect(call).not.toContain('vertical:');
    });

    it('reads the notices and the support edits in the same Promise.all', () => {
        const parallel = LISTING_HUB.indexOf('Promise.all([');
        expect(parallel).toBeGreaterThanOrEqual(0);
        expect(parallel).toBeLessThan(LISTING_HUB.indexOf('loadSupportEdits({'));
        expect(parallel).toBeLessThan(LISTING_HUB.indexOf('loadListingNoticesItem({'));
        expect(LISTING_HUB).not.toContain('await loadSupportEdits({');
    });

    it('renders the conditional container below the identity and above the support notice and the hub', () => {
        expect(LISTING_HUB).toContain('data-testid="editor-hub-listing-notices"');
        expect(LISTING_HUB).toContain('<ListingNotices');
        expect(LISTING_HUB.indexOf('listing-hub__identity')).toBeLessThan(
            LISTING_HUB.indexOf('editor-hub-listing-notices')
        );
        const notices = LISTING_HUB.indexOf('editor-hub-listing-notices');
        expect(notices).toBeLessThan(LISTING_HUB.indexOf('<SupportEditNotice'));
        expect(LISTING_HUB.indexOf('<SupportEditNotice')).toBeLessThan(
            LISTING_HUB.indexOf('<EditorHub')
        );
        expect(LISTING_HUB).toContain('notices.length > 0');
    });

    it('passes the resolved vertical, the listing id and the entry to the component', () => {
        expect(LISTING_HUB).toContain('vertical={vertical}');
        expect(LISTING_HUB).toContain('listingId={listingId}');
        expect(LISTING_HUB).toContain('item={listingNotices.item}');
    });

    it('spaces the container from the page stylesheet, never with an inline style', () => {
        expect(styleBlock({ source: LISTING_HUB })).toContain('.listing-hub__notices');
        expect(styleBlock({ source: LISTING_HUB })).toContain('gap:');
        expect(LISTING_HUB).not.toMatch(/\sstyle=/);
    });
});
