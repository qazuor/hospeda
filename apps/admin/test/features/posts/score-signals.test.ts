import { computeScore } from '@/components/quality-score';
import { createPostSignals } from '@/features/posts/config/score-signals';
import { describe, expect, it } from 'vitest';

const signalsUnlocked = createPostSignals({ hasVideoGalleryFeature: true });
const signalsGated = createPostSignals({ hasVideoGalleryFeature: false });

describe('createPostSignals', () => {
    it('returns the expected signal ids in declaration order', () => {
        const ids = signalsUnlocked.map((s) => s.id);
        expect(ids).toEqual([
            'featured-image',
            'gallery-photos',
            'photos-alt',
            'summary',
            'content',
            'category',
            'reading-time',
            'author',
            'related-entity',
            'published-at',
            'video-gallery'
        ]);
    });

    it('main signal weights sum to 100 (video-gallery is premium / weight 0)', () => {
        const total = signalsUnlocked.reduce((acc, s) => acc + s.weight, 0);
        expect(total).toBe(100);
    });

    describe('content', () => {
        it('done when content length is >= 500 chars', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'content');
            const result = signal?.check({ content: 'a'.repeat(500) });
            expect(result).toEqual({ status: 'done' });
        });

        it('pending with partial progress when content is shorter than 500', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'content');
            const result = signal?.check({ content: 'a'.repeat(250) });
            expect(result?.status).toBe('pending');
            // progress is current / target (250 / 500 = 0.5)
            expect(result && 'progress' in result ? result.progress : undefined).toBeCloseTo(0.5);
        });

        it('pending with progress 0 when content is missing', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'content');
            expect(signal?.check({})).toEqual({ status: 'pending', progress: 0 });
        });
    });

    describe('reading-time', () => {
        it('done when readingTimeMinutes is a positive number', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'reading-time');
            expect(signal?.check({ readingTimeMinutes: 6 })).toEqual({ status: 'done' });
        });

        it('pending when readingTimeMinutes is 0', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'reading-time');
            expect(signal?.check({ readingTimeMinutes: 0 })).toEqual({ status: 'pending' });
        });

        it('pending when readingTimeMinutes is missing', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'reading-time');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('author', () => {
        it('done when authorId is a non-empty string', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'author');
            expect(signal?.check({ authorId: 'user-1' })).toEqual({ status: 'done' });
        });

        it('pending when authorId is empty', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'author');
            expect(signal?.check({ authorId: '' })).toEqual({ status: 'pending' });
        });
    });

    describe('related-entity', () => {
        it('done with relatedAccommodationId set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'related-entity');
            expect(signal?.check({ relatedAccommodationId: 'acc-1' })).toEqual({
                status: 'done'
            });
        });

        it('done with relatedDestinationId set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'related-entity');
            expect(signal?.check({ relatedDestinationId: 'dest-1' })).toEqual({
                status: 'done'
            });
        });

        it('done with relatedEventId set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'related-entity');
            expect(signal?.check({ relatedEventId: 'event-1' })).toEqual({ status: 'done' });
        });

        it('done with sponsorshipId set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'related-entity');
            expect(signal?.check({ sponsorshipId: 'sp-1' })).toEqual({ status: 'done' });
        });

        it('pending with no relation fields set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'related-entity');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('published-at', () => {
        it('done when publishedAt is set (string)', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'published-at');
            expect(signal?.check({ publishedAt: '2026-06-01T00:00:00Z' })).toEqual({
                status: 'done'
            });
        });

        it('done when publishedAt is a Date', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'published-at');
            expect(signal?.check({ publishedAt: new Date() })).toEqual({ status: 'done' });
        });

        it('pending when publishedAt is null', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'published-at');
            expect(signal?.check({ publishedAt: null })).toEqual({ status: 'pending' });
        });

        it('pending when publishedAt is missing', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'published-at');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('video-gallery (premium)', () => {
        it('shows premium when the feature is gated', () => {
            const signal = signalsGated.find((s) => s.id === 'video-gallery');
            expect(signal?.check({})).toEqual({ status: 'premium' });
        });

        it('shows done when unlocked and media.videos has entries', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'video-gallery');
            const result = signal?.check({
                media: { videos: [{ url: 'https://youtube.com/x' }] }
            });
            expect(result).toEqual({ status: 'done' });
        });

        it('shows pending when unlocked but no videos yet', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'video-gallery');
            expect(signal?.check({ media: { videos: [] } })).toEqual({ status: 'pending' });
        });
    });

    describe('computeScore end-to-end (unlocked)', () => {
        it('caps at 100 with every main signal complete', () => {
            const entity = {
                title: 'How to plan your trip',
                summary: 'A short excerpt',
                content: 'a'.repeat(500),
                category: 'TRAVEL',
                readingTimeMinutes: 5,
                authorId: 'user-1',
                relatedAccommodationId: 'acc-1',
                publishedAt: '2026-06-01T00:00:00Z',
                media: {
                    featuredImage: { url: 'https://example.com/x.jpg', alt: 'Hero' },
                    gallery: [
                        { url: 'https://a.jpg', alt: 'a' },
                        { url: 'https://b.jpg', alt: 'b' }
                    ]
                }
            };
            const result = computeScore(signalsUnlocked, entity);
            expect(result.score).toBe(100);
        });

        it('returns 0 for a completely empty entity', () => {
            const result = computeScore(signalsUnlocked, {});
            expect(result.score).toBe(0);
        });
    });
});
