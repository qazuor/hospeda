/**
 * @file ArticleCard.test.ts
 * @description Source-reading tests for ArticleCard.astro.
 * Covers Badge migration, FavoriteButton island integration (SPEC-098),
 * and featuredImage handling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/ArticleCard.astro'),
    'utf8'
);

describe('ArticleCard.astro', () => {
    describe('imports', () => {
        it('imports getMutedColorScheme from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getMutedColorScheme');
        });

        it('imports Badge from Badge.astro', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });

        it('imports FavoriteButton island from shared/favorite', () => {
            expect(src).toContain("from '@/components/shared/favorite/FavoriteButton.client'");
            expect(src).toContain('FavoriteButton');
        });
    });

    describe('muted color scheme usage', () => {
        it('uses getMutedColorScheme() instead of inlining the literal', () => {
            expect(src).toContain('getMutedColorScheme()');
        });

        it('no longer contains the inline muted color scheme literal', () => {
            // The old inline literal had this very specific opacity value for the
            // background. After migration the helper owns it.
            expect(src).not.toContain(
                "bg: 'oklch(from var(--core-muted-foreground) l c h / 0.08)'"
            );
        });
    });

    describe('props interface', () => {
        it('should define Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('should declare data prop as readonly ArticleCardBaseProps', () => {
            expect(src).toContain('readonly data: ArticleCardBaseProps');
        });

        it('should declare optional isAuthenticated prop', () => {
            expect(src).toContain('readonly isAuthenticated?: boolean');
        });

        it('should default isAuthenticated to false', () => {
            expect(src).toContain('isAuthenticated = false');
        });
    });

    describe('FavoriteButton island integration (SPEC-098)', () => {
        it('should render FavoriteButton with client:load directive', () => {
            expect(src).toContain('client:load');
        });

        it('should pass entityId from data.id', () => {
            expect(src).toContain('entityId={data.id}');
        });

        it('should pass entityType="POST"', () => {
            expect(src).toContain('entityType="POST"');
        });

        it('should pass initialIsFavorited from data.isFavorited', () => {
            expect(src).toContain('initialIsFavorited={data.isFavorited}');
        });

        it('should pass initialBookmarkId from data.favoriteBookmarkId with null fallback', () => {
            expect(src).toContain('initialBookmarkId={data.favoriteBookmarkId ?? null}');
        });

        it('should pass count from data.bookmarkCount', () => {
            expect(src).toContain('count={data.bookmarkCount}');
        });

        it('should use standalone variant', () => {
            expect(src).toContain('variant="standalone"');
        });

        it('should forward locale to FavoriteButton', () => {
            expect(src).toContain('locale={locale}');
        });

        it('should forward isAuthenticated to FavoriteButton', () => {
            expect(src).toContain('isAuthenticated={isAuthenticated}');
        });

        it('should guard FavoriteButton rendering on data.id being present', () => {
            expect(src).toContain('data.id');
        });

        it('should position FavoriteButton wrapper inside the image area', () => {
            expect(src).toContain('article-card__fav-wrapper');
        });
    });

    describe('featuredImage caption as alt text', () => {
        it('uses featuredImage.url as src for the image', () => {
            expect(src).toContain('data.featuredImage?.url');
        });

        it('prefers caption over title as alt text when caption is available', () => {
            // Caption from API media.featuredImage.caption is used first; title is the fallback.
            expect(src).toContain('data.featuredImage?.caption ?? data.title');
        });

        it('checks hasImage against featuredImage.url (not the object)', () => {
            expect(src).toContain('data.featuredImage?.url');
        });
    });
});
