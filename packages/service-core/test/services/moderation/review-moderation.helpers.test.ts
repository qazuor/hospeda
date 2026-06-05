/**
 * Tests for resolveInitialModerationState helper (SPEC-166 T-010).
 *
 * Covers every branch + boundary at the MODERATION_PENDING_THRESHOLD.
 */
import { ModerationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    MODERATION_PENDING_THRESHOLD,
    resolveInitialModerationState
} from '../../../src/services/moderation/review-moderation.helpers';

describe('resolveInitialModerationState', () => {
    // ---- Threshold boundary tests -----------------------------------------------

    describe('content-moderation score at / above threshold → PENDING', () => {
        it('returns PENDING when score equals PENDING_THRESHOLD (accommodation)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: MODERATION_PENDING_THRESHOLD
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('returns PENDING when score equals PENDING_THRESHOLD (destination)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'destination',
                    verificationLevel: 'none',
                    moderationScore: MODERATION_PENDING_THRESHOLD
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('returns PENDING when score is 1.0 (stub engine blocked-word hit, accommodation)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 1.0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('returns PENDING when score is 1.0 (stub engine blocked-word hit, destination)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'destination',
                    verificationLevel: 'none',
                    moderationScore: 1.0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('content-mod PENDING overrides verified level for accommodation', () => {
            // Even a "verified" reviewer gets PENDING when content-mod fires.
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'verified',
                    moderationScore: 1.0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });
    });

    describe('score just below threshold → entity default applies', () => {
        it('returns APPROVED for accommodation when score is just below threshold', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: MODERATION_PENDING_THRESHOLD - 0.001
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('returns PENDING for destination when score is just below threshold', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'destination',
                    verificationLevel: 'none',
                    moderationScore: MODERATION_PENDING_THRESHOLD - 0.001
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });
    });

    // ---- Clean text (score = 0) entity-default tests ----------------------------

    describe('clean text (score = 0) → per-entity default', () => {
        it('returns APPROVED for clean accommodation review (semi-verified)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('returns PENDING for clean destination review (unverified)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'destination',
                    verificationLevel: 'none',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });
    });

    // ---- Verified level (future reservation system) ----------------------------

    describe('verificationLevel = verified → APPROVED (below threshold)', () => {
        it('returns APPROVED for verified destination review with clean text', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'destination',
                    verificationLevel: 'verified',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('returns APPROVED for verified accommodation review with clean text', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'verified',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });
    });

    // ---- PENDING_THRESHOLD constant sanity -------------------------------------

    it('PENDING_THRESHOLD is in (0, 1] so the stub binary result maps cleanly', () => {
        expect(MODERATION_PENDING_THRESHOLD).toBeGreaterThan(0);
        expect(MODERATION_PENDING_THRESHOLD).toBeLessThanOrEqual(1);
    });
});
