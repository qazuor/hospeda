/**
 * @file ReviewPreview.avatar.test.ts
 * @description Source and data-pipeline coverage for detail review avatar fallbacks (H-4).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getInitials } from '@/lib/avatar-utils';
import { toReviewStripItems } from '@/lib/review-strip';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/ReviewPreview.astro'),
    'utf8'
);

describe('detail review avatar fallback (H-4)', () => {
    it.each([
        ['Host Basico', 'HB'],
        ['  Host   Basico  ', 'HB'],
        ['Host Middle Basico', 'HB'],
        ['host', 'HO'],
        ['H', 'H'],
        ['   ', '?']
    ])('derives initials for %j without an image', (name, expected) => {
        const [review] = toReviewStripItems({
            items: [{ id: 'review-1', content: 'A helpful review.', user: { name, image: null } }]
        });

        expect(review?.image).toBeNull();
        expect(getInitials({ name: review?.name })).toBe(expected);
    });

    it('preserves an existing reviewer image', () => {
        const [review] = toReviewStripItems({
            items: [
                {
                    id: 'review-1',
                    content: 'A helpful review.',
                    user: { name: 'Host Basico', image: '/images/reviewer.webp' }
                }
            ]
        });

        expect(review?.image).toBe('/images/reviewer.webp');
        expect(source).toMatch(/\{review\.image && \([\s\S]*?<img\s+src=\{review\.image\}/);
    });

    it('renders shared initials unconditionally behind the optional image', () => {
        expect(source).toContain("from '@/lib/avatar-utils'");
        expect(source).toContain('initials: getInitialsFromName(name)');
        expect(source).toMatch(
            /<span class="review-preview__avatar-fallback"[^>]*>\{review\.initials\}<\/span>\s*\{review\.image &&/
        );
        expect(source).toContain('data-hide-on-error');
        expect(source).toMatch(
            /\.review-preview__avatar-fallback\s*\{[^}]*color: var\(--primary-foreground\)/
        );
    });
});
