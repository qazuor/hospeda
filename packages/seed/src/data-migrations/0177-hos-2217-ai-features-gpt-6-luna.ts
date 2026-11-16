/**
 * @fileoverview
 * Data migration: 0177-hos-2217-ai-features-gpt-6-luna
 *
 * Moves every configured AI feature to `gpt-6-luna` with the reasoning effort
 * the HOS-2217 model-migration sweep chose (705 calls, 2026-11-16), and adds
 * `modelRates` for the two luna models.
 *
 * - A feature is updated ONLY when its current model is a previous default
 *   (`gpt-5.4-nano` or `gpt-5.4-mini`). Any other model was set by an operator
 *   and is kept, with a warning.
 * - A feature already on `gpt-6-luna` is left alone (whatever its effort), so
 *   the migration is a no-op where the values were set by hand first.
 * - A `modelRates` entry is added only when the model has none; an operator
 *   rate is never replaced.
 *
 * `chat_venue` gets `none` for now. Moving it to `low` is safe only once the
 * classifier fix of HOS-2217 (explicit `reasoningEffort: 'none'` in
 * `buildChatAnswerClassifierRequest`) is deployed: before it, the classifier
 * inherits the venue chat effort and `low` empties its 16-token output.
 *
 * Baseline: there is no seed fixture for `ai_settings.features` (the blob is
 * operator-created; `required/aiSettings.seed.ts` only promotes cost
 * ceilings), and fresh-DB rates come from `MODEL_RATES` in
 * `@repo/ai-core`, which already carries both luna models. So this migration
 * is the whole dual-write.
 */
import { aiSettings, eq } from '@repo/db';
import { AiSettingsKeySchema } from '@repo/schemas';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0177-hos-2217-ai-features-gpt-6-luna',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The model every feature moves to. */
export const LUNA_MODEL = 'gpt-6-luna';

/** Models this migration may replace: the defaults before HOS-2217. */
export const PREVIOUS_DEFAULT_MODELS: readonly string[] = ['gpt-5.4-nano', 'gpt-5.4-mini'];

/** Reasoning effort per feature, from the HOS-2217 sweep results. */
export const LUNA_EFFORT_BY_FEATURE = {
    chat: 'none',
    chat_experience: 'none',
    // `low` scored best in the sweep, but stays `none` until the classifier fix
    // (explicit reasoningEffort 'none') is deployed; see the file header.
    chat_venue: 'none',
    search: 'none',
    translate: 'none',
    post_generate: 'none',
    text_improve: 'low',
    accommodation_import: 'low',
    faq_draft: 'low',
    support: 'low'
} as const;

/** `ai_settings.modelRates` entries added when absent (µUSD per 1M tokens). */
export const LUNA_MODEL_RATES = {
    'gpt-6-luna': {
        inputMicroUsdPerMillionTokens: 100_000,
        outputMicroUsdPerMillionTokens: 500_000
    },
    'gpt-5.6-luna': {
        inputMicroUsdPerMillionTokens: 200_000,
        outputMicroUsdPerMillionTokens: 1_200_000
    }
} as const;

type FeatureConfig = Record<string, unknown>;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const key = AiSettingsKeySchema.value;
    const rows = await ctx.db.select().from(aiSettings).where(eq(aiSettings.key, key)).limit(1);
    const row = rows[0];
    if (!row || typeof row.value !== 'object' || row.value === null) {
        return {
            summary: 'No global AI settings row; skipped.',
            counts: { updated: 0, alreadyLuna: 0, operatorEdited: 0, ratesAdded: 0 }
        };
    }
    const value = row.value as Record<string, unknown>;
    const features =
        value.features && typeof value.features === 'object'
            ? (value.features as Record<string, FeatureConfig>)
            : {};

    const nextFeatures: Record<string, FeatureConfig> = { ...features };
    let updated = 0;
    let alreadyLuna = 0;
    const operatorEdited: string[] = [];
    for (const [feature, effort] of Object.entries(LUNA_EFFORT_BY_FEATURE)) {
        const config = features[feature];
        if (!config || typeof config !== 'object') continue;
        if (config.model === LUNA_MODEL) {
            alreadyLuna += 1;
            continue;
        }
        if (typeof config.model !== 'string' || !PREVIOUS_DEFAULT_MODELS.includes(config.model)) {
            operatorEdited.push(feature);
            continue;
        }
        const params =
            config.params && typeof config.params === 'object'
                ? (config.params as Record<string, unknown>)
                : {};
        nextFeatures[feature] = {
            ...config,
            model: LUNA_MODEL,
            params: { ...params, reasoningEffort: effort }
        };
        updated += 1;
    }
    if (operatorEdited.length > 0) {
        logger.warn(
            `HOS-2217: kept the operator-edited model of ${operatorEdited.join(', ')} (not a previous default).`
        );
    }

    const rates =
        value.modelRates && typeof value.modelRates === 'object'
            ? (value.modelRates as Record<string, unknown>)
            : {};
    const nextRates: Record<string, unknown> = { ...rates };
    let ratesAdded = 0;
    for (const [model, rate] of Object.entries(LUNA_MODEL_RATES)) {
        if (model in rates) continue;
        nextRates[model] = { ...rate };
        ratesAdded += 1;
    }

    const counts = { updated, alreadyLuna, operatorEdited: operatorEdited.length, ratesAdded };
    if (updated === 0 && ratesAdded === 0) {
        return {
            summary: 'HOS-2217: nothing to change (already luna or operator-edited).',
            counts
        };
    }
    await ctx.db
        .update(aiSettings)
        .set({ value: { ...value, features: nextFeatures, modelRates: nextRates } })
        .where(eq(aiSettings.key, key));
    return {
        summary: `HOS-2217: moved ${updated} AI feature(s) to ${LUNA_MODEL}; added ${ratesAdded} model rate(s).`,
        counts
    };
}
