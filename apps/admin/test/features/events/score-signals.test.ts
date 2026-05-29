import { computeScore } from '@/components/quality-score';
import { createEventSignals } from '@/features/events/config/score-signals';
import { describe, expect, it } from 'vitest';

const signalsUnlocked = createEventSignals({ hasVideoGalleryFeature: true });
const signalsGated = createEventSignals({ hasVideoGalleryFeature: false });

describe('createEventSignals', () => {
    it('returns the expected signal ids', () => {
        const ids = signalsUnlocked.map((s) => s.id);
        expect(ids).toEqual([
            'featured-image',
            'gallery-photos',
            'photos-alt',
            'summary',
            'description',
            'category',
            'dates',
            'price',
            'location',
            'organizer',
            'contact',
            'video-gallery'
        ]);
    });

    it('main signal weights sum to 100 (video-gallery is premium / weight 0)', () => {
        const total = signalsUnlocked.reduce((acc, s) => acc + s.weight, 0);
        expect(total).toBe(100);
    });

    describe('featured-image', () => {
        it('done when media.featuredImage.url is set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'featured-image');
            const result = signal?.check({
                media: { featuredImage: { url: 'https://example.com/x.jpg' } }
            });
            expect(result).toEqual({ status: 'done' });
        });

        it('pending when no featured image', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'featured-image');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('dates', () => {
        it('done when date.start is set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'dates');
            const result = signal?.check({
                date: { start: new Date('2026-08-15T10:00:00Z') }
            });
            expect(result).toEqual({ status: 'done' });
        });

        it('pending when date.start is empty string', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'dates');
            expect(signal?.check({ date: { start: '' } })).toEqual({ status: 'pending' });
        });

        it('pending when no date object', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'dates');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('price', () => {
        it('done when pricing.isFree is true (regardless of price)', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'price');
            expect(signal?.check({ pricing: { isFree: true } })).toEqual({ status: 'done' });
        });

        it('done when pricing.price > 0', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'price');
            expect(signal?.check({ pricing: { isFree: false, price: 1500 } })).toEqual({
                status: 'done'
            });
        });

        it('done when pricing.priceFrom > 0', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'price');
            expect(signal?.check({ pricing: { isFree: false, priceFrom: 500 } })).toEqual({
                status: 'done'
            });
        });

        it('pending when paid event has no price set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'price');
            expect(signal?.check({ pricing: { isFree: false } })).toEqual({ status: 'pending' });
        });

        it('pending when no pricing block', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'price');
            expect(signal?.check({})).toEqual({ status: 'pending' });
        });
    });

    describe('contact', () => {
        it('done with at least one contact channel set', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'contact');
            const result = signal?.check({ contact: { email: 'host@example.com' } });
            expect(result).toEqual({ status: 'done' });
        });

        it('pending when all contact channels are empty', () => {
            const signal = signalsUnlocked.find((s) => s.id === 'contact');
            expect(signal?.check({ contact: {} })).toEqual({ status: 'pending' });
        });
    });

    describe('video-gallery (premium)', () => {
        it('shows premium status when the feature is gated', () => {
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

    describe('computeScore end-to-end (unlocked, fully populated)', () => {
        it('caps at 100 with every main signal complete', () => {
            const entity = {
                name: 'Festival',
                summary: 'A great event',
                description: 'a'.repeat(200),
                category: 'CULTURAL',
                date: { start: new Date('2026-09-01') },
                pricing: { isFree: true },
                locationId: 'loc-1',
                organizerId: 'org-1',
                contact: { email: 'host@example.com' },
                media: {
                    featuredImage: { url: 'https://example.com/x.jpg', alt: 'Hero' },
                    gallery: [
                        { url: 'https://a.jpg', alt: 'a' },
                        { url: 'https://b.jpg', alt: 'b' },
                        { url: 'https://c.jpg', alt: 'c' }
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
