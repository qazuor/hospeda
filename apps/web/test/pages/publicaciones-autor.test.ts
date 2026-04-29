/**
 * @file publicaciones-autor.test.ts
 * @description Source-based assertions for the author listing page.
 * Verifies that the page calls the user-by-slug endpoint, lists posts with
 * the authorId filter, renders author profile fields, and uses Breadcrumbs.
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

const src = readPage('publicaciones/autor/[slug]/index.astro');

describe('publicaciones/autor/[slug]/index.astro', () => {
    describe('API integration', () => {
        it('imports usersApi from endpoints', () => {
            expect(src).toContain('usersApi');
            expect(src).toContain("from '@/lib/api/endpoints'");
        });

        it('imports postsApi from endpoints', () => {
            expect(src).toContain('postsApi');
        });

        it('calls usersApi.getBySlug with slug param', () => {
            expect(src).toContain('usersApi.getBySlug({ slug })');
        });

        it('calls postsApi.list with authorId filter', () => {
            expect(src).toContain('authorId: author.id');
        });

        it('returns 404 when user not found', () => {
            expect(src).toContain('status: 404');
        });

        it('passes page param for pagination', () => {
            expect(src).toContain('page,');
            expect(src).toContain('pageSize');
        });
    });

    describe('Breadcrumbs', () => {
        it('imports Breadcrumbs component', () => {
            expect(src).toContain('Breadcrumbs.astro');
        });

        it('renders Breadcrumbs with author level and author name', () => {
            expect(src).toContain('<Breadcrumbs');
            expect(src).toContain("t('blog.details.author'");
            expect(src).toContain('authorName');
        });
    });

    describe('Author profile rendering', () => {
        it('renders author avatar when present', () => {
            expect(src).toContain('author.avatar');
        });

        it('renders author displayName', () => {
            expect(src).toContain('authorName');
        });

        it('renders author bio when present', () => {
            expect(src).toContain('author.bio');
        });
    });

    describe('Posts grid', () => {
        it('imports ArticleCard component', () => {
            expect(src).toContain('ArticleCard');
        });

        it('maps posts through toArticleCardProps', () => {
            expect(src).toContain('toArticleCardProps');
        });

        it('renders EmptyState when no posts', () => {
            expect(src).toContain('EmptyState');
        });
    });

    describe('Pagination', () => {
        it('imports Pagination component', () => {
            expect(src).toContain('Pagination');
        });

        it('renders Pagination when totalPages > 1', () => {
            expect(src).toContain('totalPages');
            expect(src).toContain('currentPage={page}');
        });

        it('builds base URL for pagination using author slug', () => {
            expect(src).toContain('publicaciones/autor/${slug}');
        });
    });
});
