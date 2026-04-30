/**
 * @file publicaciones-tag-filter.test.ts
 * @description Source-based assertions for the PostTag-filtered post listing page
 * and post detail PostTag chips (SPEC-086 T-034).
 *
 * Covers:
 * - AC-F13: tag filter page uses POST /api/v1/public/posts/tags (PostTag subsystem)
 * - AC-F14: non-existent slug → 404, no internal label leak
 * - AC-006-01: PostTag slug resolved from /posts/tags listing before filtering
 * - AC-006-02: posts filtered by PostTag UUID via postsApi.list({ tags })
 * - AC-006-03: post detail PostTag chips link to /publicaciones/etiqueta/{slug}
 * - D-024: user-tags (r_entity_tag) NEVER shown as public web UI
 * - D-001: PostTag subsystem is completely separate from user-tag subsystem
 *
 * Astro components cannot be rendered in Vitest — we assert against source text.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '../../src');

function readPage(relativePath: string): string {
    return readFileSync(resolve(SRC_DIR, 'pages/[lang]', relativePath), 'utf8');
}

function readEndpoints(): string {
    return readFileSync(resolve(SRC_DIR, 'lib/api/endpoints.ts'), 'utf8');
}

// ─── Source files under test ─────────────────────────────────────────────────

const tagPageSrc = readPage('publicaciones/etiqueta/[tag]/index.astro');
const detailPageSrc = readPage('publicaciones/[slug].astro');
const endpointsSrc = readEndpoints();

// ─── endpoints.ts ────────────────────────────────────────────────────────────

describe('endpoints.ts — postTagsApi (SPEC-086 AC-F13, AC-F24)', () => {
    it('exports postTagsApi namespace', () => {
        expect(endpointsSrc).toContain('export const postTagsApi');
    });

    it('postTagsApi.list calls /api/v1/public/posts/tags', () => {
        expect(endpointsSrc).toContain('/posts/tags');
    });

    it('exports PostTagPublicItem interface with required fields', () => {
        expect(endpointsSrc).toContain('PostTagPublicItem');
        expect(endpointsSrc).toContain('readonly id: string');
        expect(endpointsSrc).toContain('readonly name: string');
        expect(endpointsSrc).toContain('readonly slug: string');
        expect(endpointsSrc).toContain('readonly color: string');
        expect(endpointsSrc).toContain('readonly lifecycleState: string');
    });

    it('postTagsApi.list supports optional withCounts param', () => {
        expect(endpointsSrc).toContain('withCounts');
    });

    it('postsApi.list accepts tags filter param for PostTag UUID', () => {
        // The tags param accepts a UUID string to filter by PostTag
        expect(endpointsSrc).toContain('tags?: string');
    });
});

// ─── etiqueta/[tag]/index.astro ──────────────────────────────────────────────

describe('publicaciones/etiqueta/[tag]/index.astro (SPEC-086 T-034)', () => {
    describe('API integration — PostTag subsystem (AC-F13, AC-006-01)', () => {
        it('imports postTagsApi from endpoints (NOT tagsApi)', () => {
            expect(tagPageSrc).toContain('postTagsApi');
            expect(tagPageSrc).toContain("from '@/lib/api/endpoints'");
        });

        it('does NOT use tagsApi (user-tag system)', () => {
            // The old code used tagsApi.getBySlug which is the user-tag subsystem
            expect(tagPageSrc).not.toContain('tagsApi.getBySlug');
        });

        it('calls postTagsApi.list to get all ACTIVE PostTags', () => {
            expect(tagPageSrc).toContain('postTagsApi.list()');
        });

        it('resolves slug by finding in the PostTag list (AC-006-01)', () => {
            // Must find the tag by slug from the full list
            expect(tagPageSrc).toContain('.find(');
            expect(tagPageSrc).toContain('.slug === tagSlug');
        });

        it('returns 404 when PostTag slug not found (AC-F14)', () => {
            // Non-existent slug must return 404 — no internal label leak
            expect(tagPageSrc).toContain('status: 404');
        });

        it('does NOT return the name of non-existent tags (AC-F14, no label leak)', () => {
            // The 404 branch must not interpolate tagSlug or any user data into a visible error
            // The page returns a 404 Response directly, so no error template renders
            expect(tagPageSrc).toContain('return new Response(null, { status: 404 })');
        });
    });

    describe('Post filtering by PostTag UUID (AC-006-02)', () => {
        it('imports postsApi for post listing', () => {
            expect(tagPageSrc).toContain('postsApi');
        });

        it('calls postsApi.list with tags filter using the PostTag UUID', () => {
            // Must pass tags: tagId (UUID) to filter posts correctly
            expect(tagPageSrc).toContain('tags: tagId');
        });

        it('uses tagId (UUID from PostTag) not tagSlug for the API call', () => {
            // tagId comes from the resolved PostTag.id
            expect(tagPageSrc).toContain('tagId = matchedTag.id');
        });
    });

    describe('Page header and navigation', () => {
        it('imports ListingPageHeader', () => {
            expect(tagPageSrc).toContain('ListingPageHeader');
        });

        it('imports Breadcrumbs', () => {
            expect(tagPageSrc).toContain('Breadcrumbs');
        });

        it('renders the tag name as page title', () => {
            expect(tagPageSrc).toContain('tagName');
            expect(tagPageSrc).toContain('`#${tagName}`');
        });
    });

    describe('Pagination', () => {
        it('imports Pagination component', () => {
            expect(tagPageSrc).toContain('Pagination');
        });

        it('renders Pagination when totalPages > 1', () => {
            expect(tagPageSrc).toContain('totalPages > 1');
            expect(tagPageSrc).toContain('currentPage={page}');
        });

        it('builds base URL using the tag slug', () => {
            expect(tagPageSrc).toContain('publicaciones/etiqueta/${tagSlug}');
        });
    });

    describe('Empty and error states', () => {
        it('renders EmptyState when no posts match the tag', () => {
            expect(tagPageSrc).toContain('EmptyState');
        });

        it('renders ErrorBanner on API failure', () => {
            expect(tagPageSrc).toContain('ErrorBanner');
        });
    });

    describe('PostTag-only separation (D-001, D-024)', () => {
        it('does NOT reference r_entity_tag or user-tags', () => {
            expect(tagPageSrc).not.toContain('r_entity_tag');
            expect(tagPageSrc).not.toContain('userTag');
        });

        it('uses SPEC-086 PostTag subsystem (D-001 comment)', () => {
            expect(tagPageSrc).toContain('SPEC-086');
        });
    });
});

// ─── publicaciones/[slug].astro (post detail) ─────────────────────────────────

describe('publicaciones/[slug].astro — PostTag chips (AC-006-03, D-024)', () => {
    describe('user-tag suppression (D-024)', () => {
        it('does NOT use tags from post.tags as clickable links (user-tags have no slug)', () => {
            // The old broken code built links from post.tags[].slug which is always empty
            // per SPEC-086 D-002. This assertion checks the fix is in place.
            expect(detailPageSrc).not.toContain('tags.map((tag: { name: string; slug: string })');
        });

        it('does NOT create /etiqueta/ links from user-tag data', () => {
            // user-tags (tags field) must not generate filter links
            // Only postTags (PostTag subsystem) should generate those links
            expect(detailPageSrc).not.toContain('post.tags.map');
        });

        it('includes SPEC-086 D-024 comment explaining why user-tags are excluded', () => {
            expect(detailPageSrc).toContain('D-024');
        });

        it('includes D-002 reference for missing slug', () => {
            expect(detailPageSrc).toContain('D-002');
        });
    });

    describe('PostTag chips rendering (AC-006-03)', () => {
        it('uses postTags variable (not tags) for chip rendering', () => {
            expect(detailPageSrc).toContain('postTags');
        });

        it('links PostTag chips to /publicaciones/etiqueta/{slug}', () => {
            // When postTags are available they must link to the correct URL
            expect(detailPageSrc).toContain('publicaciones/etiqueta/${tag.slug}');
        });

        it('renders PostTag chips with post-detail__tag CSS class', () => {
            expect(detailPageSrc).toContain('post-detail__tag');
        });
    });
});
