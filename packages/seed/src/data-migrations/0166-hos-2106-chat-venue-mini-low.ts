/**
 * @fileoverview
 * Data migration: 0166-hos-2106-chat-venue-mini-low
 *
 * Moves chat_venue from the previous gpt-5.4-nano default to gpt-5.4-mini
 * with low reasoning effort, preserving every other setting. Operator-changed
 * models are counted and left untouched.
 */
import { aiSettings, eq } from '@repo/db';
import { AiSettingsKeySchema } from '@repo/schemas';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0166-hos-2106-chat-venue-mini-low',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const key = AiSettingsKeySchema.value;
    const rows = await ctx.db.select().from(aiSettings).where(eq(aiSettings.key, key)).limit(1);
    const row = rows[0];
    if (!row || typeof row.value !== 'object' || row.value === null) {
        return { summary: 'No global AI settings row; skipped.' };
    }
    const value = row.value as Record<string, unknown>;
    const features = value.features as Record<string, Record<string, unknown>> | undefined;
    const venue = features?.chat_venue;
    if (!venue) return { summary: 'chat_venue is not configured; skipped.' };
    if (venue.model !== 'gpt-5.4-nano') {
        logger.warn(
            'HOS-2106: skipped chat_venue model update because it no longer matches gpt-5.4-nano (operator-edited).'
        );
        return {
            summary: 'Skipped chat_venue: model differs from previous default.',
            counts: { updated: 0, skipped: 1 }
        };
    }
    const nextFeatures = {
        ...features,
        chat_venue: {
            ...venue,
            model: 'gpt-5.4-mini',
            params: {
                ...(venue.params as Record<string, unknown> | undefined),
                reasoningEffort: 'low'
            }
        }
    };
    await ctx.db
        .update(aiSettings)
        .set({ value: { ...value, features: nextFeatures } })
        .where(eq(aiSettings.key, key));
    return {
        summary: 'Updated chat_venue model and reasoning effort.',
        counts: { updated: 1, skipped: 0 }
    };
}
