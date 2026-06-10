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

    // ---- DB-backed pendingThreshold injection (SPEC-195) -----------------------

    describe('injected pendingThreshold overrides the package constant', () => {
        it('score < injected threshold → entity default applies (accommodation APPROVED)', () => {
            // threshold 0.8, score 0.6 → below → APPROVED for accommodation
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0.6,
                    pendingThreshold: 0.8
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('score >= injected threshold → PENDING (overrides entity default)', () => {
            // threshold 0.8, score 0.8 → at threshold → PENDING even for accommodation
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0.8,
                    pendingThreshold: 0.8
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('score 0.6 with default threshold (0.5) → PENDING; with elevated threshold (0.8) → APPROVED', () => {
            // Without injected threshold, 0.6 >= 0.5 → PENDING
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0.6
                })
            ).toBe(ModerationStatusEnum.PENDING);

            // With injected threshold 0.8, 0.6 < 0.8 → APPROVED
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0.6,
                    pendingThreshold: 0.8
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('injected threshold of 0 → any score >= 0 is PENDING (strict admin lockdown)', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0,
                    pendingThreshold: 0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });
    });
});
