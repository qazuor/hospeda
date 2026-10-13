/**
 * @file ListingNotices.test.ts
 * @description TEST:V8a:5 / TEST:V8a:7 (component level, HOS-1492): the
 * owner's listing notices in Mi Cuenta.
 *
 * Vitest cannot render `.astro` in this repo, so the copy lives in
 * `buildListingNoticeViews` (asserted per kind in
 * `test/lib/listing/listing-notices.test.ts`) and the component renders it
 * verbatim. These source assertions pin the component's own decisions: it
 * renders the builder's views and nothing else, does not fetch, ships only the
 * row 30 button as an island (`client:idle`), uses no Tailwind, and is mounted
 * on the gastronomy and experience list with the vertical's read (never an invented notice).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/listing/ListingNotices.astro'),
    'utf8'
);

const COMERCIO_PAGE = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/comercio/index.astro'),
    'utf8'
);

describe('ListingNotices.astro — renders the read, decides nothing', () => {
    it('renders the views the builder returns, title and every line', () => {
        expect(SOURCE).toContain(
            'const views = buildListingNoticeViews({ locale, t, tPlural, item });'
        );
        expect(SOURCE).toContain('{view.title}');
        expect(SOURCE).toContain('view.lines.map((line)');
        expect(SOURCE).toContain('data-notice-kind={view.kind}');
    });

    it('compares no status, kind or destination of its own', () => {
        expect(SOURCE).not.toMatch(/(?:kind|publicationStatus|returnedTo)\s*===/);
        expect(SOURCE).not.toMatch(/PURGED|ARCHIVED|MODERATED|SURPLUS/);
    });

    it('does not fetch and ships the row 30 button as its only island, client:idle', () => {
        expect(SOURCE).not.toMatch(/fetch\(|publishApi/);
        expect(SOURCE).toMatch(/<ReportFixedButton\s+client:idle/);
        expect(SOURCE).toContain('view.reportFixed &&');
        expect(SOURCE).toContain('reportedAt={view.reportFixed.reportedAt}');
        expect(SOURCE).not.toMatch(/client:(?:load|visible)/);
    });

    it('styles with its CSS module, no Tailwind', () => {
        expect(SOURCE).toContain("import styles from './ListingNotices.module.css';");
        expect(SOURCE).not.toMatch(/class="[^"]*\b(?:flex|p-\d|text-sm|bg-)/);
    });
});

describe('mi-cuenta/comercio — the notices of each gastronomy or experience listing', () => {
    it('reads the notices once per listed vertical through the wrapper', () => {
        expect(COMERCIO_PAGE).toContain(
            'const listedVerticals = [...new Set(listings.map((listing) => listing.vertical))];'
        );
        expect(COMERCIO_PAGE).toContain('publishApi.listingNotices({ vertical, cookieHeader })');
        expect(COMERCIO_PAGE).toContain('indexListingNotices({');
    });

    it('a failed or thrown read leaves the vertical without notices', () => {
        expect(COMERCIO_PAGE).toContain('return [vertical, EMPTY_LISTING_NOTICES_INDEX] as const;');
        expect(COMERCIO_PAGE).toMatch(/catch \(error\)/);
    });

    it('mounts the notices on each listing with its own entry', () => {
        expect(COMERCIO_PAGE).toContain(
            'item={noticesByVertical.get(listing.vertical)?.byListingId.get(listing.id)}'
        );
        expect(COMERCIO_PAGE).toContain('vertical={listing.vertical}');
    });
});
