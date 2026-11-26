/**
 * The one runner for gated + metered listing translation (HOS-2658, spec §9.4).
 *
 * Both the on-save run (fired by the listing services after a Spanish save) and
 * the owner's "Traducir con IA" button go through {@link runMeteredTranslation}:
 * MANUAL pairs are dropped BEFORE the gate and the provider, the billed owner's
 * `ai_translate` entitlement and monthly limit are enforced, the provider is
 * called only for the remaining pairs, the results are persisted through the
 * single writer, and exactly one `ai_usage` row is written per request that
 * actually spent provider tokens.
 *
 * @module services/translation/metered-translation
 */

import { getDb } from '@repo/db';
import { type AiFeature, type TranslationMeta, VerticalEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import type { ProtectedTranslatableEntityType } from '../../routes/ai/protected/translate.authorization.js';
import { meterAiUsage } from '../../utils/ai-usage-metering.js';
import { enforceAiQuota } from '../../utils/listing-access/ai-quota-gate.js';
import { persistTranslations, translateEntity } from '../ai-translate.service.js';
import { getEntityTable, type TranslatableEntityType } from './translatable-entities.js';

const FEATURE: AiFeature = 'translate';

/** Target locales of a listing translation (Spanish is always the source). */
export type MeteredTranslationLocale = 'en' | 'pt';

const DEFAULT_TARGET_LOCALES: readonly MeteredTranslationLocale[] = ['en', 'pt'];

/**
 * Quota vertical of each entity type reachable through the legacy protected
 * translate route (`POST /api/v1/protected/ai/translate`).
 *
 * Destinations, events and posts are editorial content with no vertical of
 * their own: they keep today's behaviour of being metered under the
 * ACCOMMODATION vertical (spec OQ-3). The map replaces the literal the route
 * used to hard-code (AC-32).
 */
export const TRANSLATE_QUOTA_VERTICAL: Readonly<
    Record<ProtectedTranslatableEntityType, VerticalEnum>
> = {
    accommodation: VerticalEnum.ACCOMMODATION,
    destination: VerticalEnum.ACCOMMODATION,
    event: VerticalEnum.ACCOMMODATION,
    post: VerticalEnum.ACCOMMODATION
};

/** Outcome of {@link runMeteredTranslation}. */
export type MeteredTranslationOutcome =
    | { readonly outcome: 'translated'; readonly written: number; readonly failed: number }
    | { readonly outcome: 'nothing-to-do' }
    | { readonly outcome: 'all-failed' };

/** Input of {@link runMeteredTranslation}. */
export interface RunMeteredTranslationInput {
    /** What fired the run; carried into the metering log context. */
    readonly trigger: 'on-save' | 'button';
    readonly entityType: TranslatableEntityType;
    readonly entityId: string;
    /** Vertical whose plan grants `ai_translate` for this listing. */
    readonly vertical: VerticalEnum;
    /** Listing owner: gated, metered and billed (DL-3). */
    readonly billedUserId: string;
    /** Field id → Spanish source. Empty sources are ignored. */
    readonly fields: Readonly<Record<string, string>>;
    /** Locales to translate into. Defaults to `['en', 'pt']`. */
    readonly targetLocales?: readonly MeteredTranslationLocale[];
    /** Button only: regenerate the requested pairs even when they are MANUAL. */
    readonly overrideManual?: boolean;
}

/** `"field:locale"` key used by `skipPairs` and `overrideManualPairs`. */
function pairKey(field: string, locale: string): string {
    return `${field}:${locale}`;
}

/** Reads the stored `translationMeta` of a row, or `null` when the row is absent. */
async function loadTranslationMeta({
    entityType,
    entityId
}: {
    readonly entityType: TranslatableEntityType;
    readonly entityId: string;
}): Promise<TranslationMeta | null> {
    const table = getEntityTable(entityType);
    const [row] = await getDb()
        .select({ translationMeta: table.translationMeta })
        .from(table)
        .where(eq(table.id, entityId))
        .limit(1);
    if (!row) return null;
    return ((row as { translationMeta: TranslationMeta | null }).translationMeta ??
        {}) as TranslationMeta;
}

/**
 * Runs one gated, metered translation of a listing's Spanish fields.
 *
 * Steps (spec §9.4): (1) load meta and build `skipPairs` from the MANUAL pairs
 * unless `overrideManual`; (2) every requested pair skipped → `nothing-to-do`
 * without calling the gate; (3) `enforceAiQuota` for the billed owner and
 * vertical; (4) `translateEntity` with `skipPairs`; (5) persist through the
 * writer, mirroring the Spanish sources; (6) meter `success` after persistence,
 * `error` when persistence throws, nothing when no call delivered; (7)
 * `all-failed` when at least one call was attempted and none succeeded.
 *
 * @param input - {@link RunMeteredTranslationInput}
 * @returns The run outcome.
 * @throws ServiceError `ENTITLEMENT_REQUIRED` / `LIMIT_REACHED` from the gate,
 *   or the persistence error (after metering the spend as `error`).
 */
export async function runMeteredTranslation(
    input: RunMeteredTranslationInput
): Promise<MeteredTranslationOutcome> {
    const startedAtMs = Date.now();
    const { trigger, entityType, entityId, vertical, billedUserId, overrideManual = false } = input;
    const targetLocales = input.targetLocales ?? DEFAULT_TARGET_LOCALES;

    const fields: Record<string, string> = {};
    for (const [field, source] of Object.entries(input.fields)) {
        if (source.trim().length > 0) fields[field] = source;
    }
    const requested = Object.keys(fields).flatMap((field) =>
        targetLocales.map((locale) => pairKey(field, locale))
    );
    if (requested.length === 0) {
        return { outcome: 'nothing-to-do' };
    }

    // (1) MANUAL pairs are dropped before the gate and the provider (AC-7/AC-8).
    const meta = await loadTranslationMeta({ entityType, entityId });
    if (meta === null) {
        return { outcome: 'nothing-to-do' };
    }
    const skipPairs = new Set<string>();
    if (!overrideManual) {
        for (const field of Object.keys(fields)) {
            for (const locale of targetLocales) {
                if (meta[field]?.[locale]?.autoTranslated === false) {
                    skipPairs.add(pairKey(field, locale));
                }
            }
        }
    }
    // (2) Nothing left: no gate call, no ai_usage row (AC-8).
    if (requested.every((key) => skipPairs.has(key))) {
        return { outcome: 'nothing-to-do' };
    }

    // (3) Throws ServiceError ENTITLEMENT_REQUIRED / LIMIT_REACHED.
    await enforceAiQuota({
        userId: billedUserId,
        vertical,
        feature: FEATURE,
        entitlementKey: 'ai_translate',
        limitKey: 'max_ai_translate_per_month'
    });

    // (4)
    const result = await translateEntity({
        entityType,
        entityId,
        fields,
        sourceLocale: 'es',
        targetLocales: [...targetLocales],
        skipPairs
    });
    const attempted = result.translations.length;
    const succeeded = result.translations.filter((translation) => translation.success).length;
    if (attempted === 0) {
        return { outcome: 'nothing-to-do' };
    }

    const logContext = { entityType, entityId, trigger };
    const spend =
        succeeded > 0
            ? {
                  provider: result.provider || 'unknown',
                  model: result.model || 'unknown',
                  promptTokens: result.promptTokens,
                  completionTokens: result.completionTokens
              }
            : null;

    // (5) Persist; (6) meter after persistence so a failed write never burns quota.
    let written = 0;
    try {
        const persisted = await persistTranslations(
            entityType,
            entityId,
            fields,
            result.translations,
            result.provider,
            result.model,
            'es',
            overrideManual ? new Set(requested) : undefined
        );
        written = persisted.written.length;
    } catch (error) {
        if (spend) {
            await meterAiUsage({
                userId: billedUserId,
                feature: FEATURE,
                ...spend,
                latencyMs: Date.now() - startedAtMs,
                status: 'error',
                logContext
            });
        }
        throw error;
    }

    if (spend) {
        await meterAiUsage({
            userId: billedUserId,
            feature: FEATURE,
            ...spend,
            latencyMs: Date.now() - startedAtMs,
            status: 'success',
            logContext
        });
    }

    // (7)
    if (succeeded === 0) {
        return { outcome: 'all-failed' };
    }
    return { outcome: 'translated', written, failed: attempted - succeeded };
}
