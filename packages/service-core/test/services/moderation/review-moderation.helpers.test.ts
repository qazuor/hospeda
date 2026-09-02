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

    // ---- HOS-376: the host-trade domain's asymmetric defaults ------------------

    describe('host-trade review vs host-trade reply (HOS-376 §6.4)', () => {
        it('returns APPROVED for a clean host-trade review', () => {
            // Stronger evidence than an accommodation review: a usage the
            // counterpart CONFIRMED, not just a conversation that happened.
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        /** AC-19 — content-mod overrides the APPROVED default. */
        it('returns PENDING for a host-trade review whose text scores at threshold', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: MODERATION_PENDING_THRESHOLD
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('returns PENDING for a clean provider reply', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTradeReply',
                    verificationLevel: 'none',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('returns PENDING for a provider reply whose text scores at threshold', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTradeReply',
                    verificationLevel: 'none',
                    moderationScore: MODERATION_PENDING_THRESHOLD
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        /**
         * The one place the reply breaks the shared decision tree.
         *
         * `verified` short-circuits to APPROVED for every other entity type,
         * but verifying the AUTHOR says nothing about the reply's actual risk:
         * the danger is what a provider writes about the host's address, and
         * the most verified provider is precisely the one who was standing at
         * it. A `verified` reply that published itself would be a fail-open.
         */
        it('keeps a verified provider reply PENDING', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTradeReply',
                    verificationLevel: 'verified',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('still lets a verified host-trade review through', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'verified',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        it('honours an injected threshold for both', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0.6,
                    pendingThreshold: 0.8
                })
            ).toBe(ModerationStatusEnum.APPROVED);

            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0.8,
                    pendingThreshold: 0.8
                })
            ).toBe(ModerationStatusEnum.PENDING);
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

    // ---- Degraded engine (HOS-1069) ---------------------------------------------

    /**
     * REGRESSION — HOS-1069.
     *
     * `degraded` means the engine could not form an opinion, so its score is
     * not a measurement of the text — it is a placeholder. Comparing a
     * placeholder against a threshold is how the fail-closed path became a
     * matter of luck: the degraded score happens to be 0.5 and the shipped
     * threshold happens to be 0.5, so the guard held only because two
     * unrelated numbers happened to match. An admin raising the threshold to
     * 0.6 would have silently turned it off.
     *
     * So the check moves ahead of the threshold entirely: unjudged content goes
     * to a human whatever the numbers say.
     */
    describe('a degraded engine forces PENDING regardless of the threshold', () => {
        it('holds even when the score is far below a raised threshold', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'semi',
                    moderationScore: 0.5,
                    pendingThreshold: 0.9,
                    degraded: true
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('holds for a verified author, who otherwise short-circuits to APPROVED', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'accommodation',
                    verificationLevel: 'verified',
                    moderationScore: 0,
                    degraded: true
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        it('holds for hostTrade, the type whose default is APPROVED', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0,
                    degraded: true
                })
            ).toBe(ModerationStatusEnum.PENDING);
        });

        /**
         * The control: without the flag, the same inputs publish. This is what
         * every leak measured in production looked like from here.
         */
        it('a NON-degraded engine with the same numbers still approves', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0,
                    degraded: false
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });

        /**
         * Omitting the flag must read as "the engine answered", not as
         * "unknown" — an absent field defaulting to degraded would send every
         * caller that has not been updated straight to the moderation queue.
         */
        it('an absent flag behaves exactly like degraded: false', () => {
            expect(
                resolveInitialModerationState({
                    entityType: 'hostTrade',
                    verificationLevel: 'none',
                    moderationScore: 0
                })
            ).toBe(ModerationStatusEnum.APPROVED);
        });
    });
});
