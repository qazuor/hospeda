/**
 * AI Prompt Versions seed (SPEC-173).
 *
 * Seeds the default system prompts for EVERY AI feature in `AiFeatureSchema`
 * into `ai_prompt_versions`. These are the same prompts used as fallback by
 * `DEFAULT_PROMPTS` in `@repo/ai-core`, but stored in the DB so admins can
 * edit them via the admin UI without code changes.
 *
 * The feature list is derived from `AiFeatureSchema.options` (the single
 * source of truth) rather than a hand-maintained literal, so a newly added
 * `AiFeature` is seeded automatically and its admin prompt editor is never
 * left blank. The prior hardcoded `['text_improve','chat','search','support']`
 * list silently skipped `translate`, `accommodation_import`, and
 * `post_generate`, leaving their editors empty even though the engine still
 * resolved the in-code default at runtime.
 *
 * Uses `ON CONFLICT ... DO NOTHING` so the seed is idempotent —
 * re-running does NOT overwrite admin-edited prompts.
 */

import { DEFAULT_PROMPTS, DEFAULT_RULES } from '@repo/ai-core';
import { aiPromptVersions, getDb, users } from '@repo/db';
import type { AiFeature } from '@repo/schemas';
import { AiFeatureSchema } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

/**
 * Every AI feature that gets a default prompt row seeded — derived from the
 * `AiFeatureSchema` enum so this never drifts out of sync with the features
 * the platform actually supports. Exported so the regression guard can assert
 * full coverage.
 */
export const PROMPT_SEED_FEATURES: readonly AiFeature[] = AiFeatureSchema.options;

export async function seedAiPrompts(): Promise<void> {
    logger.info('  → Seeding AI prompt versions...');

    const db = getDb();

    // Use the super admin as the creator
    const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'SUPER_ADMIN'))
        .limit(1);

    if (!admin) {
        logger.warn('  → No SUPER_ADMIN found — skipping AI prompt seed');
        return;
    }

    let inserted = 0;

    for (const feature of PROMPT_SEED_FEATURES) {
        const content = DEFAULT_PROMPTS[feature];
        const rules = DEFAULT_RULES[feature];

        const result = await db
            .insert(aiPromptVersions)
            .values({
                feature,
                version: 1,
                content,
                rules,
                isActive: true,
                createdBy: admin.id
            })
            .onConflictDoNothing();

        if (result.rowCount && result.rowCount > 0) {
            inserted++;
            logger.debug(`    ✓ Prompt v1 for '${feature}' seeded`);
        } else {
            logger.debug(`    · Prompt for '${feature}' already exists — skipped`);
        }
    }

    logger.info(
        `  → AI prompts: ${inserted} created, ${PROMPT_SEED_FEATURES.length - inserted} skipped (already exist)`
    );
}
