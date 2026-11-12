/**
 * Adds the FAQ draft AI feature while preserving the operator's provider and
 * fallback settings from accommodation chat.
 */
import { aiSettings, eq, SYSTEM_USER_ID } from '@repo/db';
import { AiSettingsKeySchema, AiSettingsValueSchema } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0167-hos-2105-faq-draft-ai-settings',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Adds the default FAQ drafting configuration if it is not already present. */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const key = AiSettingsKeySchema.value;
    const rows = await db
        .select({ value: aiSettings.value })
        .from(aiSettings)
        .where(eq(aiSettings.key, key))
        .limit(1);
    const row = rows[0];
    if (!row)
        return {
            summary: 'HOS-2105: no global AI settings row exists.',
            counts: { featuresAdded: 0 }
        };
    const value = row.value as Record<string, unknown>;
    const features =
        value.features && typeof value.features === 'object'
            ? (value.features as Record<string, unknown>)
            : {};
    if ('faq_draft' in features)
        return {
            summary: 'HOS-2105: FAQ draft configuration already exists.',
            counts: { featuresAdded: 0 }
        };
    const chat =
        features.chat && typeof features.chat === 'object'
            ? (features.chat as Record<string, unknown>)
            : {};
    const featuresNext = {
        ...features,
        faq_draft: {
            enabled: chat.enabled === true,
            primaryProvider:
                typeof chat.primaryProvider === 'string' ? chat.primaryProvider : 'stub',
            fallbackChain: Array.isArray(chat.fallbackChain) ? chat.fallbackChain : [],
            model: 'gpt-5.4-mini',
            params: chat.params && typeof chat.params === 'object' ? chat.params : {}
        }
    };
    const parsed = AiSettingsValueSchema.safeParse({ ...value, features: featuresNext });
    if (!parsed.success)
        throw new Error(`HOS-2105: updated AI settings failed validation: ${parsed.error.message}`);
    await db
        .update(aiSettings)
        .set({
            value: parsed.data as Record<string, unknown>,
            updatedBy: SYSTEM_USER_ID,
            updatedAt: new Date()
        })
        .where(eq(aiSettings.key, key));
    return {
        summary: 'HOS-2105: added faq_draft configuration using gpt-5.4-mini.',
        counts: { featuresAdded: 1 }
    };
}
