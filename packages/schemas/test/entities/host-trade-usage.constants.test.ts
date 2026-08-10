import { describe, expect, it } from 'vitest';
import {
    HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE,
    HOST_TRADE_REJECTION_SUSPEND_THRESHOLD,
    HOST_TRADE_REJECTION_WINDOW_DAYS,
    HOST_TRADE_REVIEW_CONTENT_MAX,
    HOST_TRADE_REVIEW_CONTENT_MIN,
    HOST_TRADE_REVIEW_RATING_MAX,
    HOST_TRADE_REVIEW_RATING_MIN,
    HOST_TRADE_REVIEW_REPLY_MAX,
    HOST_TRADE_REVIEW_REPLY_MIN,
    HOST_TRADE_USAGE_EXPIRY_DAYS,
    HOST_TRADE_USAGE_NOTE_MAX,
    HOST_TRADE_USAGE_REMINDER_DAYS
} from '../../src/entities/host-trade/host-trade-usage.constants.js';

// ============================================================================
// HOS-376 T-012 — one home for every tuned number in the domain.
//
// These are not arbitrary: each encodes a decision that was argued and can be
// re-argued. Scattering them as literals across the service, the crons and the
// UI is how a "30 days" in one place quietly becomes a "30 days" that means
// something else in another.
// ============================================================================

describe('HOS-376 usage/review domain constants (T-012)', () => {
    describe('timing', () => {
        it('expires a confirmation request at 30 days', () => {
            expect(HOST_TRADE_USAGE_EXPIRY_DAYS).toBe(30);
        });

        it('sends the single reminder at day 10', () => {
            expect(HOST_TRADE_USAGE_REMINDER_DAYS).toBe(10);
        });

        it('reminds strictly before it expires, with real margin left', () => {
            // A reminder that lands on (or near) the expiry date is worse than
            // none: it tells the host about something they can no longer act on.
            expect(HOST_TRADE_USAGE_REMINDER_DAYS).toBeLessThan(HOST_TRADE_USAGE_EXPIRY_DAYS);
            expect(
                HOST_TRADE_USAGE_EXPIRY_DAYS - HOST_TRADE_USAGE_REMINDER_DAYS
            ).toBeGreaterThanOrEqual(7);
        });
    });

    describe('anti-collusion', () => {
        it('suspends declaration at 3 rejections', () => {
            expect(HOST_TRADE_REJECTION_SUSPEND_THRESHOLD).toBe(3);
        });

        it('counts rejections over a 90-day window', () => {
            expect(HOST_TRADE_REJECTION_WINDOW_DAYS).toBe(90);
        });

        it('never suspends on a single rejection', () => {
            // One rejection can be a misunderstanding or a mis-tap. The whole
            // point of a threshold is that it takes a pattern, not an accident.
            expect(HOST_TRADE_REJECTION_SUSPEND_THRESHOLD).toBeGreaterThan(1);
        });

        it('keeps the window wide enough to span more than one expiry cycle', () => {
            expect(HOST_TRADE_REJECTION_WINDOW_DAYS).toBeGreaterThan(HOST_TRADE_USAGE_EXPIRY_DAYS);
        });
    });

    describe('display threshold', () => {
        it('hides the average below 3 reviews', () => {
            expect(HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE).toBe(3);
        });

        it('requires more than one review before showing an average', () => {
            // With n=1 the "average" is one person's opinion wearing a star
            // rating, and it outranks a provider with 40 reviews and a 4.6.
            expect(HOST_TRADE_MIN_REVIEWS_FOR_AVERAGE).toBeGreaterThan(1);
        });
    });

    describe('rating bounds', () => {
        it('rates from 1 to 5', () => {
            expect(HOST_TRADE_REVIEW_RATING_MIN).toBe(1);
            expect(HOST_TRADE_REVIEW_RATING_MAX).toBe(5);
        });

        it('has no zero-star option', () => {
            // Zero is not an opinion, it is an empty form. The scale starts at
            // 1 so "I did not rate" and "I rated the lowest" stay distinct.
            expect(HOST_TRADE_REVIEW_RATING_MIN).toBeGreaterThan(0);
        });
    });

    describe('text bounds', () => {
        it('bounds the usage note at 300 characters', () => {
            expect(HOST_TRADE_USAGE_NOTE_MAX).toBe(300);
        });

        it('bounds review content between 10 and 2000 characters', () => {
            expect(HOST_TRADE_REVIEW_CONTENT_MIN).toBe(10);
            expect(HOST_TRADE_REVIEW_CONTENT_MAX).toBe(2000);
        });

        it('bounds a provider reply between 10 and 1000 characters', () => {
            expect(HOST_TRADE_REVIEW_REPLY_MIN).toBe(10);
            expect(HOST_TRADE_REVIEW_REPLY_MAX).toBe(1000);
        });

        it('gives the reply less room than the review it answers', () => {
            // The review is the primary content; the reply is a right of
            // response, not a platform for a longer counter-argument.
            expect(HOST_TRADE_REVIEW_REPLY_MAX).toBeLessThan(HOST_TRADE_REVIEW_CONTENT_MAX);
        });

        it('keeps every min strictly below its max', () => {
            expect(HOST_TRADE_REVIEW_CONTENT_MIN).toBeLessThan(HOST_TRADE_REVIEW_CONTENT_MAX);
            expect(HOST_TRADE_REVIEW_REPLY_MIN).toBeLessThan(HOST_TRADE_REVIEW_REPLY_MAX);
        });
    });
});
