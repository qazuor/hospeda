/**
 * AI Settings seed (SPEC-211 T-002).
 *
 * Writes the default `costCeilings` into the `ai_settings` blob on first run.
 * Idempotent and divergence-respecting: if a `costCeilings` key already exists
 * in the stored blob, the seed skips silently so operator-edited values are
 * never clobbered.
 *
 * ## Why this seed exists
 *
 * The runtime fallback in `checkCostCeiling` (ceiling.ts) uses
 * `DEFAULT_COST_CEILINGS` when the blob has no `costCeilings` field, so the
 * platform is always protected even before this seed runs. This seed promotes
 * the defaults into the DB so admins can inspect and override them through
 * the admin UI without needing to know the in-code constant values.
 *
 * ## Idempotency
 *
 * - If no `ai_settings` row exists: SKIPS. A valid `ai_settings` blob requires a
 *   complete providers/features configuration (every `AiFeature` needs a config
 *   with provider + model), which is an operator/admin concern this seed has no
 *   business inventing. The runtime fallback (`DEFAULT_COST_CEILINGS` in
 *   `ceiling.ts`) already protects spend before any blob exists, so skipping is
 *   safe — this seed only promotes the ceilings into an already-configured blob.
 * - If a row exists and `costCeilings` is already set: skips (operator wins).
 * - If a row exists but `costCeilings` is absent: merges `DEFAULT_COST_CEILINGS`
 *   into the blob while preserving all other fields.
 *
 * @module seed/required/aiSettings
 */

import { DEFAULT_COST_CEILINGS, readAiSettings, writeAiSettings } from '@repo/ai-core';
import { SYSTEM_USER_ID } from '@repo/db';
import type { AiSettingsValue } from '@repo/schemas';
import { logger } from '../utils/logger.js';

/**
 * Seeds `costCeilings` into the `ai_settings` blob.
 *
 * Does NOT overwrite an existing `costCeilings` value — only writes when
 * the field is absent so admin-edited overrides are preserved.
 *
 * @returns Promise that resolves when the seed is complete.
 */
export async function seedAiSettings(): Promise<void> {
    logger.info('  → Seeding AI settings (costCeilings defaults)...');

    const existing = await readAiSettings();

    if (existing !== null && existing.costCeilings !== undefined) {
        // Operator has already set cost ceilings — respect their configuration.
        logger.debug('    · ai_settings.costCeilings already set — skipped');
        logger.info('  → AI settings: costCeilings already present, skipped');
        return;
    }

    // Only promote costCeilings into an EXISTING ai_settings blob. We never
    // synthesise a fresh blob: a valid AiSettingsValue requires a complete
    // providers/features map (each AiFeature needs provider + model), which this
    // seed cannot legitimately invent. When no row exists, the runtime fallback
    // (DEFAULT_COST_CEILINGS in ceiling.ts) already caps spend, so skipping is
    // safe. (Without this guard, writing a `{ providers: {}, features: {} }` blob
    // fails AiSettingsValueSchema validation and aborts the whole seed run.)
    if (existing === null) {
        logger.info(
            '  → AI settings: no ai_settings blob yet — costCeilings active via runtime fallback, seed skipped'
        );
        return;
    }

    const merged: AiSettingsValue = {
        ...existing,
        costCeilings: DEFAULT_COST_CEILINGS
    };

    await writeAiSettings({
        value: merged,
        actorId: SYSTEM_USER_ID
    });

    logger.debug(
        `    ✓ ai_settings.costCeilings seeded (global=${String(DEFAULT_COST_CEILINGS.globalMonthlyMicroUsd)} µUSD)`
    );
    logger.info('  → AI settings: costCeilings defaults written');
}
