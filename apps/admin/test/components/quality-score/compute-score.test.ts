import { computeScore } from '@/components/quality-score/compute-score';
import type { SignalConfig } from '@/components/quality-score/types';
import { describe, expect, it } from 'vitest';

/**
 * Tests for the quality-score engine. The engine is pure so all tests use
 * plain in-memory signal lists and entity records — no hooks, no DOM.
 *
 * The signal labelKey field is typed `TranslationKey`; for tests we cast a
 * synthetic literal so we don't have to register fake keys with i18n. The
 * engine never inspects the label string.
 */
const fakeKey = 'admin-entities.qualityScore.signals.summary.label' as const;

function makeSignal(
    id: string,
    weight: number,
    status: 'done' | 'pending' | 'premium',
    progress?: number
): SignalConfig<Record<string, unknown>> {
    return {
        id,
        labelKey: fakeKey,
        weight,
        sectionId: 'mock-section',
        check: () => ({ status, progress })
    };
}

describe('computeScore', () => {
    it('returns 0 with empty signal list', () => {
        // Arrange — no signals at all.
        const signals: SignalConfig<Record<string, unknown>>[] = [];

        // Act
        const result = computeScore(signals, {});

        // Assert
        expect(result.score).toBe(0);
        expect(result.done).toEqual([]);
        expect(result.pending).toEqual([]);
        expect(result.premium).toEqual([]);
    });

    it('returns 100 when every non-premium signal is done', () => {
        // Arrange
        const signals = [makeSignal('a', 10, 'done'), makeSignal('b', 5, 'done')];

        // Act
        const result = computeScore(signals, {});

        // Assert
        expect(result.score).toBe(100);
        expect(result.done).toHaveLength(2);
        expect(result.pending).toHaveLength(0);
    });

    it('returns 0 when every signal is pending with no progress', () => {
        // Arrange
        const signals = [makeSignal('a', 10, 'pending'), makeSignal('b', 5, 'pending')];

        // Act
        const result = computeScore(signals, {});

        // Assert
        expect(result.score).toBe(0);
        expect(result.done).toHaveLength(0);
        expect(result.pending).toHaveLength(2);
    });

    it('weights signals by their `weight` field', () => {
        // Arrange — total weight 30, only the 20-weight done one is satisfied.
        const signals = [makeSignal('big', 20, 'done'), makeSignal('small', 10, 'pending')];

        // Act
        const result = computeScore(signals, {});

        // Assert — 20 / 30 = 66.66 → rounds to 67.
        expect(result.score).toBe(67);
    });

    it('awards partial credit when a pending signal reports progress', () => {
        // Arrange — single signal, weight 10, at 40% progress.
        const signals = [makeSignal('partial', 10, 'pending', 0.4)];

        // Act
        const result = computeScore(signals, {});

        // Assert — 0.4 * 10 / 10 = 40%.
        expect(result.score).toBe(40);
        // Still classified as pending so the popover shows it in "Para mejorar".
        expect(result.pending).toHaveLength(1);
        expect(result.pending[0]?.progress).toBe(0.4);
    });

    it('clamps progress above 1 and ignores below 0 or NaN', () => {
        // Arrange — three pending signals with malformed progress values.
        const signals = [
            makeSignal('over', 10, 'pending', 3),
            makeSignal('under', 10, 'pending', -1),
            makeSignal('nan', 10, 'pending', Number.NaN)
        ];

        // Act
        const result = computeScore(signals, {});

        // Assert — over=clamped to 1 (full credit), under=NaN normalized to 0.
        // Weighted achieved = 10 + 0 + 0 = 10 / 30 → 33.
        expect(result.score).toBe(33);
    });

    it('excludes premium signals from the denominator (Premium no penaliza)', () => {
        // Arrange — one done normal signal + two premium pending. The premium
        // ones MUST NOT lower the score.
        const signals = [
            makeSignal('normal', 10, 'done'),
            makeSignal('locked-1', 5, 'premium'),
            makeSignal('locked-2', 5, 'premium')
        ];

        // Act
        const result = computeScore(signals, {});

        // Assert
        expect(result.score).toBe(100);
        expect(result.done).toHaveLength(1);
        expect(result.pending).toHaveLength(0);
        expect(result.premium).toHaveLength(2);
    });

    it('passes through the hint payload to the evaluated signal', () => {
        // Arrange
        const signalsWithHint: SignalConfig<Record<string, unknown>>[] = [
            {
                id: 'with-hint',
                labelKey: fakeKey,
                weight: 1,
                sectionId: 'mock',
                check: () => ({
                    status: 'pending',
                    progress: 0.2,
                    hint: {
                        key: 'admin-entities.qualityScore.signals.galleryPhotos.hint',
                        params: { current: 1, target: 5 }
                    }
                })
            }
        ];

        // Act
        const result = computeScore(signalsWithHint, {});

        // Assert
        expect(result.pending[0]?.hint).toEqual({
            key: 'admin-entities.qualityScore.signals.galleryPhotos.hint',
            params: { current: 1, target: 5 }
        });
    });

    it('rounds the final score to an integer', () => {
        // Arrange — 1 done + 2 pending, weights 1/1/1 → 1/3 = 0.333… → 33.
        const signals = [
            makeSignal('a', 1, 'done'),
            makeSignal('b', 1, 'pending'),
            makeSignal('c', 1, 'pending')
        ];

        // Act
        const result = computeScore(signals, {});

        // Assert
        expect(Number.isInteger(result.score)).toBe(true);
        expect(result.score).toBe(33);
    });
});
