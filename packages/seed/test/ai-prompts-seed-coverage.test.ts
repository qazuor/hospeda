/**
 * Regression guard for the AI prompt seed coverage.
 *
 * The seed used to iterate a hand-maintained literal
 * `['text_improve','chat','search','support']`, which silently skipped the
 * later-added features `translate`, `accommodation_import`, and
 * `post_generate`. Their `ai_prompt_versions` rows were therefore never
 * seeded, so the admin prompt editor rendered an empty textarea for them even
 * though the engine still resolved the in-code default at runtime.
 *
 * This guard pins the seed's feature list to `AiFeatureSchema.options` (the
 * single source of truth) so any future `AiFeature` is seeded automatically
 * and no editor is ever left blank. It also confirms every seeded feature has
 * a concrete default prompt + rules to insert.
 */

import { DEFAULT_PROMPTS, DEFAULT_RULES } from '@repo/ai-core';
import { AiFeatureSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { PROMPT_SEED_FEATURES } from '../src/required/aiPrompts.seed.js';

describe('AI prompt seed coverage', () => {
    it('seeds a default prompt row for every AiFeature (no drift vs the enum)', () => {
        // Arrange
        const expected = new Set<string>(AiFeatureSchema.options);

        // Act
        const seeded = new Set<string>(PROMPT_SEED_FEATURES);

        // Assert
        expect(seeded).toEqual(expected);
    });

    it('covers the features that the old hardcoded list dropped (regression)', () => {
        // Arrange
        const previouslyMissing = ['translate', 'accommodation_import', 'post_generate'] as const;

        // Act + Assert
        for (const feature of previouslyMissing) {
            expect(PROMPT_SEED_FEATURES).toContain(feature);
        }
    });

    it('has a concrete default prompt and rules for every seeded feature', () => {
        // Act + Assert — a seeded feature with no default would insert an empty
        // prompt, defeating the purpose of the seed.
        for (const feature of PROMPT_SEED_FEATURES) {
            expect(DEFAULT_PROMPTS[feature]?.length ?? 0).toBeGreaterThan(0);
            expect(DEFAULT_RULES[feature]?.length ?? 0).toBeGreaterThan(0);
        }
    });
});
