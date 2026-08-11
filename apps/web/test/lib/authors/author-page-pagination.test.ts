/**
 * @file author-page-pagination.test.ts
 * @description The two URL-level rules of the author page's pagination
 * (HOS-375 §6.3/§6.6): a self-referential canonical on paginated URLs, and 404
 * — not an empty 200 — for a page number past the last real page.
 */

import { describe, expect, it } from 'vitest';
import {
    isAuthorPageOutOfRange,
    resolveAuthorCanonicalPath
} from '../../../src/lib/authors/author-page-pagination';

const AUTHOR_PATH = '/es/autores/juan-perez/';
const EVENTS_PATH = '/es/autores/juan-perez/eventos/';

describe('resolveAuthorCanonicalPath', () => {
    it('canonicalises the profile to itself', () => {
        expect(
            resolveAuthorCanonicalPath({
                authorPath: AUTHOR_PATH,
                eventsPath: EVENTS_PATH,
                postsPage: 1,
                eventsPage: 1
            })
        ).toBe(AUTHOR_PATH);
    });

    it('canonicalises posts page 2 to posts page 2, not to page 1', () => {
        // The regression this exists for: `/page/2/` is `noindex`, and pointing
        // its canonical at the indexable page 1 hands Google two contradictory
        // signals about the same document.
        expect(
            resolveAuthorCanonicalPath({
                authorPath: AUTHOR_PATH,
                eventsPath: EVENTS_PATH,
                postsPage: 2,
                eventsPage: 1
            })
        ).toBe('/es/autores/juan-perez/page/2/');
    });

    it('canonicalises events page 3 to its own sub-route', () => {
        expect(
            resolveAuthorCanonicalPath({
                authorPath: AUTHOR_PATH,
                eventsPath: EVENTS_PATH,
                postsPage: 1,
                eventsPage: 3
            })
        ).toBe('/es/autores/juan-perez/eventos/page/3/');
    });

    it('lets posts win when both params are present, matching the render', () => {
        // A URL carrying both cannot come from either rewrite; the page renders
        // the posts block, so the canonical must name the posts URL.
        expect(
            resolveAuthorCanonicalPath({
                authorPath: AUTHOR_PATH,
                eventsPath: EVENTS_PATH,
                postsPage: 4,
                eventsPage: 7
            })
        ).toBe('/es/autores/juan-perez/page/4/');
    });

    it('keeps the trailing slash the URL builder guarantees', () => {
        const canonical = resolveAuthorCanonicalPath({
            authorPath: AUTHOR_PATH,
            eventsPath: EVENTS_PATH,
            postsPage: 2,
            eventsPage: 1
        });

        expect(canonical.endsWith('/')).toBe(true);
        expect(canonical).not.toContain('//es');
    });
});

describe('isAuthorPageOutOfRange', () => {
    it('flags a page past the last one', () => {
        // The bug: this used to render an empty state with HTTP 200, minting an
        // unbounded family of crawlable URLs.
        expect(isAuthorPageOutOfRange({ page: 4, totalPages: 3 })).toBe(true);
    });

    it('does not flag the last page or any page before it', () => {
        expect(isAuthorPageOutOfRange({ page: 3, totalPages: 3 })).toBe(false);
        expect(isAuthorPageOutOfRange({ page: 2, totalPages: 3 })).toBe(false);
    });

    it('never flags page 1, which exists even for an author with no content', () => {
        expect(isAuthorPageOutOfRange({ page: 1, totalPages: 0 })).toBe(false);
    });

    it('never flags an UNKNOWN page count', () => {
        // `null` is a failed (or skipped) fetch. A transient outage must not
        // turn every paginated URL of an author into a 404, for the same reason
        // it must not turn the profile into `noindex`.
        expect(isAuthorPageOutOfRange({ page: 4, totalPages: null })).toBe(false);
    });

    it('flags page 2 of an author with zero pages of that content', () => {
        // A real, readable zero is not "unknown": `/page/2/` for an author with
        // no posts at all does not exist.
        expect(isAuthorPageOutOfRange({ page: 2, totalPages: 0 })).toBe(true);
    });
});
