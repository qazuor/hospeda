/**
 * @file account-load-failure-states.test.ts
 * @description Source-reading regression tests (HOS-2421, HOS-2422): an API
 * failure on `/mi-cuenta/comercio/` and `/mi-cuenta/consultas/` must render an
 * error state with a retry link, never the "you have none" empty state, and the
 * inbox pagination label must come from `@repo/i18n`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string): string =>
    readFileSync(resolve(__dirname, '../../src/pages/[lang]/mi-cuenta', rel), 'utf8');

describe('mi-cuenta/comercio/index.astro — API failure (HOS-2421)', () => {
    const source = read('comercio/index.astro');

    it('catches OwnerListingsUnavailableError and flags the failure', () => {
        expect(source).toContain('OwnerListingsUnavailableError');
        expect(source).toContain('listingsLoadFailed = true');
    });

    it('renders the error state BEFORE the empty state, with a retry link', () => {
        const errorAt = source.indexOf('listingsLoadFailed ? (');
        const emptyAt = source.indexOf('listings.length === 0 ? (');
        expect(errorAt).toBeGreaterThan(-1);
        expect(emptyAt).toBeGreaterThan(errorAt);
        expect(source).toContain("t('listing.owner.list.loadError.retry'");
        expect(source).toContain('ctaHref={Astro.url.pathname + Astro.url.search}');
    });

    it('keeps the real empty state', () => {
        expect(source).toContain("'listing.owner.list.empty'");
        expect(source).toContain("'listing.owner.list.emptyCta'");
    });
});

describe('mi-cuenta/consultas/index.astro — API failure (HOS-2422)', () => {
    const source = read('consultas/index.astro');

    it('derives a failure flag from the API result', () => {
        expect(source).toContain('const loadFailed = !result.ok');
    });

    it('renders the error state BEFORE the empty inbox, with a retry link', () => {
        const errorAt = source.indexOf('loadFailed ? (');
        const emptyAt = source.indexOf('conversations.length === 0 ? (');
        expect(errorAt).toBeGreaterThan(-1);
        expect(emptyAt).toBeGreaterThan(errorAt);
        expect(source).toContain("t('conversations.inbox.loadError.retry'");
        expect(source).toContain('ctaHref={Astro.url.pathname + Astro.url.search}');
    });

    it('keeps the real empty inbox', () => {
        expect(source).toContain("'conversations.empty.guestInboxTitle'");
    });

    it('translates the pagination aria-label', () => {
        expect(source).not.toContain('aria-label="Pagination"');
        expect(source).toContain("aria-label={t('common.pagination'");
    });
});
