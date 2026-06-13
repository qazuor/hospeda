/**
 * AI Content Translation Service (SPEC-212).
 *
 * Orchestrates AI translation for content entities (accommodation, destination,
 * event, post). Uses the existing AI engine with feature='translate'.
 *
 * Design:
 * - Single-entity translate: translates one entity's fields to target locales.
 * - Batch translate: iterates entities with concurrency control.
 * - No streaming — uses generateText (complete response).
 * - Retry: 1 automatic retry on transient errors, then skip + log.
 * - Fallback: if target locale translation fails, keep Spanish value.
 *
 * @module services/ai-translate
 */

import { getDb } from '@repo/db';
import { events, accommodations, destinations, posts } from '@repo/db/schemas';
import type { AiFeature, I18nText, TranslationMeta } from '@repo/schemas';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { apiLogger } from '../utils/logger.js';
import { createConfiguredAiService } from './ai-service.factory.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entity types that can be translated. */
export type TranslatableEntityType = 'accommodation' | 'destination' | 'event' | 'post';

/** Fields to translate per entity type. */
const ENTITY_FIELDS: Readonly<Record<TranslatableEntityType, readonly string[]>> = {
    accommodation: ['name', 'summary', 'description', 'richDescription'],
    destination: ['name', 'summary', 'description'],
    event: ['name', 'summary', 'description'],
    post: ['title', 'summary', 'content']
} as const;

/**
 * Structural view of a translatable entity table.
 *
 * The four content tables share the `id`, `deletedAt` and `translationMeta`
 * columns (typed here so they stay strongly typed) plus the per-field `*I18n`
 * columns that are accessed dynamically by name via {@link i18nColumn}. This
 * keeps the dynamic-column ergonomics without resorting to `any`.
 */
type TranslatableTable = PgTable & {
    id: PgColumn;
    deletedAt: PgColumn;
    translationMeta: PgColumn;
};

/**
 * Resolves a dynamic per-field i18n column (e.g. `nameI18n`) by name. The
 * column is guaranteed to exist because the names come from {@link I18N_COLUMN_MAP}.
 */
function i18nColumn(table: TranslatableTable, columnName: string): PgColumn {
    // TYPE-WORKAROUND: Drizzle exposes table columns under an internal symbol, so
    // dynamic by-name access needs a structural cast. The name always comes from
    // I18N_COLUMN_MAP, so the column is guaranteed to exist.
    return (table as unknown as Record<string, PgColumn>)[columnName] as PgColumn;
}

/**
 * Resolves the Drizzle table for a translatable entity type.
 *
 * Resolution is lazy (inside a function, never a module-level constant) so that
 * importing this module does NOT touch the `@repo/db/schemas` table bindings at
 * load time. The AI translate routes are registered in the global API route
 * tree, so a top-level table reference would crash every route test that
 * partially mocks `@repo/db/schemas`.
 */
function getEntityTable(entityType: TranslatableEntityType): TranslatableTable {
    // Built lazily inside the function (never a top-level const) so importing this
    // module does not access the bindings — the table objects are `unknown` here
    // and narrowed by the single documented cast below.
    const tables: Record<TranslatableEntityType, unknown> = {
        accommodation: accommodations,
        destination: destinations,
        event: events,
        post: posts
    };
    // TYPE-WORKAROUND: a Drizzle table's structural shape does not overlap the
    // narrow `TranslatableTable` view (columns live under an internal symbol), so
    // the projection requires an explicit cast from `unknown`.
    return tables[entityType] as TranslatableTable;
}

/** Map entity type to its i18n column suffixes. */
const I18N_COLUMN_MAP: Record<TranslatableEntityType, Record<string, string>> = {
    accommodation: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n',
        richDescription: 'richDescriptionI18n'
    },
    destination: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n'
    },
    event: {
        name: 'nameI18n',
        summary: 'summaryI18n',
        description: 'descriptionI18n'
    },
    post: {
        title: 'titleI18n',
        summary: 'summaryI18n',
        content: 'contentI18n'
    }
};

/** Content locales that participate in translation. */
export type ContentLocale = 'es' | 'en' | 'pt';

/** All content locales, used to derive target locales from a source locale. */
const CONTENT_LOCALES: readonly ContentLocale[] = ['es', 'en', 'pt'] as const;

/** Human-readable language names for prompt construction. */
const LOCALE_NAMES: Record<ContentLocale, string> = {
    es: 'Spanish',
    en: 'English',
    pt: 'Portuguese'
};

/**
 * Default target locales for the batch path (Spanish is the implicit source).
 * The single-entity path derives targets from the caller's source locale.
 */
const TARGET_LOCALES = ['en', 'pt'] as const;

/** Delay between concurrency batches to stay under provider rate limits. */
const BATCH_DELAY_MS = 500;

const FEATURE: AiFeature = 'translate';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface TranslateEntityInput {
    entityType: TranslatableEntityType;
    entityId: string;
    /** Source field values, expressed in {@link sourceLocale}. */
    fields: Record<string, string>;
    /** Locale the source `fields` are written in. Defaults to `'es'`. */
    sourceLocale?: ContentLocale;
    /**
     * Locales to translate into. Defaults to every content locale except
     * {@link sourceLocale} (the source is never translated into itself).
     */
    targetLocales?: ContentLocale[];
    /**
     * When `true`, skip any (field, locale) pair that already has a non-empty
     * value — translate only the missing locales. Requires a DB read, so it is
     * `false` by default (the batch / auto paths manage idempotency themselves).
     */
    onlyMissing?: boolean;
}

export interface TranslateResult {
    fieldType: string;
    locale: string;
    translatedText: string;
    success: boolean;
    error?: string;
}

export interface TranslateEntityResult {
    entityId: string;
    translations: TranslateResult[];
    totalTokens: number;
    provider: string;
    model: string;
}

export interface BatchTranslateInput {
    entityType: TranslatableEntityType;
    cursor?: string;
    batchSize?: number;
    concurrency?: number;
}

export interface BatchTranslateResult {
    translated: number;
    /** Entities skipped because every target locale was already translated. */
    skipped: number;
    failed: number;
    nextCursor?: string;
    errors: Array<{ entityId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Builds the user prompt for translating a single field from a source locale to
 * a target locale.
 */
function buildTranslationPrompt(
    fieldValue: string,
    sourceLocale: ContentLocale,
    targetLocale: ContentLocale
): string {
    return `Translate the following ${LOCALE_NAMES[sourceLocale]} text to ${LOCALE_NAMES[targetLocale]}:\n\n${fieldValue}`;
}

/**
 * Translates a single text field to a target locale using the AI engine.
 * Returns the translated text or the original on failure.
 */
async function translateField(
    aiService: Awaited<ReturnType<typeof createConfiguredAiService>>,
    fieldValue: string,
    sourceLocale: ContentLocale,
    targetLocale: ContentLocale
): Promise<{
    text: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    provider: string;
    model: string;
}> {
    const prompt = buildTranslationPrompt(fieldValue, sourceLocale, targetLocale);

    const result = await aiService.generateText({
        feature: FEATURE,
        prompt,
        locale: targetLocale
    });

    return {
        text: result.text,
        usage: result.usage,
        provider: result.provider,
        model: result.model
    };
}

/** Per-field translation outcome, carrying usage/provider/model for metering. */
interface FieldTranslationOutcome {
    result: TranslateResult;
    totalTokens: number;
    provider: string | null;
    model: string | null;
}

/**
 * Translates a single field with retry logic.
 * On failure, returns the original Spanish text and null usage metadata.
 */
async function translateFieldWithRetry(
    aiService: Awaited<ReturnType<typeof createConfiguredAiService>>,
    fieldValue: string,
    sourceLocale: ContentLocale,
    targetLocale: ContentLocale,
    fieldType: string,
    entityId: string
): Promise<FieldTranslationOutcome> {
    try {
        const result = await translateField(aiService, fieldValue, sourceLocale, targetLocale);
        return {
            result: {
                fieldType,
                locale: targetLocale,
                translatedText: result.text,
                success: true
            },
            totalTokens: result.usage.totalTokens,
            provider: result.provider,
            model: result.model
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { entityId, fieldType, targetLocale, error: errorMessage },
            'ai-translate: translation failed for field, keeping Spanish value'
        );
        return {
            result: {
                fieldType,
                locale: targetLocale,
                translatedText: fieldValue,
                success: false,
                error: errorMessage
            },
            totalTokens: 0,
            provider: null,
            model: null
        };
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translates a single content entity's text fields to target locales.
 *
 * @param input - Entity type, ID, field values, and optional target locales.
 * @returns Translation results with usage metadata.
 */
export async function translateEntity(input: TranslateEntityInput): Promise<TranslateEntityResult> {
    const { entityType, entityId, fields, sourceLocale = 'es', onlyMissing = false } = input;
    const targetLocales =
        input.targetLocales ?? CONTENT_LOCALES.filter((locale) => locale !== sourceLocale);

    // When asked to translate only the gaps, read the existing i18n values so we
    // can skip (field, locale) pairs that are already populated.
    const existing = onlyMissing ? await loadExistingTranslations(entityType, entityId) : null;

    const aiService = await createConfiguredAiService();
    const translations: TranslateResult[] = [];
    let totalTokens = 0;
    let provider = '';
    let model = '';

    for (const [fieldType, fieldValue] of Object.entries(fields)) {
        if (!fieldValue || fieldValue.trim().length === 0) {
            continue;
        }

        for (const locale of targetLocales) {
            // Never translate the source into itself.
            if (locale === sourceLocale) {
                continue;
            }
            // Skip locales already filled when translating only the gaps.
            if (existing?.[fieldType]?.[locale]) {
                continue;
            }

            const outcome = await translateFieldWithRetry(
                aiService,
                fieldValue,
                sourceLocale,
                locale,
                fieldType,
                entityId
            );

            translations.push(outcome.result);

            if (outcome.result.success) {
                // Accumulate per-call usage and remember the provider/model that
                // actually served the request (used for persisted metadata).
                totalTokens += outcome.totalTokens;
                if (outcome.provider) {
                    provider = outcome.provider;
                }
                if (outcome.model) {
                    model = outcome.model;
                }
            }
        }
    }

    return {
        entityId,
        translations,
        totalTokens,
        provider,
        model
    };
}

/**
 * Reads the current i18n values for every translatable field of an entity.
 *
 * Used by {@link translateEntity} when `onlyMissing` is set, to decide which
 * (field, locale) pairs already have content and can be skipped.
 *
 * @returns A map of fieldType → { locale → value } for non-empty i18n columns.
 */
async function loadExistingTranslations(
    entityType: TranslatableEntityType,
    entityId: string
): Promise<Record<string, Partial<Record<ContentLocale, string>>>> {
    const table = getEntityTable(entityType);
    const i18nColumnMap = I18N_COLUMN_MAP[entityType];
    const db = getDb();

    const selection: Record<string, PgColumn> = {};
    for (const column of Object.values(i18nColumnMap)) {
        selection[column] = i18nColumn(table, column);
    }

    const [row] = await db.select(selection).from(table).where(eq(table.id, entityId)).limit(1);
    const existingRow = (row ?? {}) as Record<string, unknown>;

    const result: Record<string, Partial<Record<ContentLocale, string>>> = {};
    for (const [fieldType, column] of Object.entries(i18nColumnMap)) {
        const value = existingRow[column] as I18nText | null;
        if (value) {
            result[fieldType] = { es: value.es, en: value.en, pt: value.pt };
        }
    }
    return result;
}

/**
 * Persists translation results to the database.
 * Updates the I18nText columns and translation_meta for the entity.
 */
export async function persistTranslations(
    entityType: TranslatableEntityType,
    entityId: string,
    fieldValues: Record<string, string>,
    results: readonly TranslateResult[],
    provider: string,
    model: string,
    sourceLocale: ContentLocale = 'es'
): Promise<void> {
    const table = getEntityTable(entityType);
    const i18nColumnMap = I18N_COLUMN_MAP[entityType];

    // Group successful results by field so each i18n column is written once.
    const resultsByField = new Map<string, TranslateResult[]>();
    for (const result of results) {
        if (!i18nColumnMap[result.fieldType]) continue;
        const bucket = resultsByField.get(result.fieldType) ?? [];
        bucket.push(result);
        resultsByField.set(result.fieldType, bucket);
    }

    if (resultsByField.size === 0) {
        return;
    }

    // Read the CURRENT i18n columns + meta so we MERGE rather than clobber.
    // This preserves previously-translated locales and admin manual overrides
    // (locales flagged `autoTranslated: false` are never overwritten).
    const selection: Record<string, PgColumn> = { translationMeta: table.translationMeta };
    for (const column of Object.values(i18nColumnMap)) {
        selection[column] = i18nColumn(table, column);
    }

    const db = getDb();
    const [existing] = await db
        .select(selection)
        .from(table)
        .where(eq(table.id, entityId))
        .limit(1);

    const existingRow = (existing ?? {}) as Record<string, unknown>;
    const existingMeta = (existingRow.translationMeta as TranslationMeta | null) ?? {};

    const updateSet: Record<string, unknown> = {};
    const mergedMeta: TranslationMeta = { ...existingMeta };
    const fieldsUpdated: string[] = [];

    for (const [fieldType, fieldResults] of resultsByField) {
        const column = i18nColumnMap[fieldType];
        if (!column) continue;
        const existingValue = (existingRow[column] as I18nText | null) ?? {
            es: '',
            en: '',
            pt: ''
        };

        // Start from the existing localized value, refresh the source locale
        // from the provided source field value (Spanish by default).
        const nextValue: I18nText = {
            es: existingValue.es ?? '',
            en: existingValue.en ?? '',
            pt: existingValue.pt ?? ''
        };
        nextValue[sourceLocale] = fieldValues[fieldType] ?? existingValue[sourceLocale] ?? '';
        const fieldMeta: TranslationMeta[string] = { ...(existingMeta[fieldType] ?? {}) };

        for (const result of fieldResults) {
            // Failed translations leave the locale untouched so the renderer
            // can fall back to Spanish; they are not recorded as overrides.
            if (!result.success) continue;

            const locale = result.locale as 'en' | 'pt';
            // Never overwrite a human-curated manual override.
            if (existingMeta[fieldType]?.[locale]?.autoTranslated === false) continue;

            nextValue[locale] = result.translatedText;
            fieldMeta[locale] = {
                autoTranslated: true,
                translatedAt: new Date().toISOString(),
                provider,
                model
            };
        }

        updateSet[column] = nextValue;
        mergedMeta[fieldType] = fieldMeta;
        fieldsUpdated.push(fieldType);
    }

    updateSet.translationMeta = mergedMeta;

    await db.update(table).set(updateSet).where(eq(table.id, entityId));

    apiLogger.info({ entityType, entityId, fieldsUpdated }, 'ai-translate: translations persisted');
}

/**
 * Loads the current non-empty translatable text fields for an entity.
 *
 * Shared by the protected translate route so route handlers do not duplicate
 * table resolution or field extraction.
 *
 * @returns The field map, or `null` when the entity does not exist.
 */
export async function loadTranslatableFields(
    entityType: TranslatableEntityType,
    entityId: string,
    sourceLocale: ContentLocale = 'es'
): Promise<Record<string, string> | null> {
    const table = getEntityTable(entityType);
    const db = getDb();
    const [row] = await db.select().from(table).where(eq(table.id, entityId)).limit(1);

    if (!row) {
        return null;
    }

    const data = row as Record<string, unknown>;
    const i18nColumnMap = I18N_COLUMN_MAP[entityType];
    const fields: Record<string, string> = {};
    for (const field of ENTITY_FIELDS[entityType]) {
        // For Spanish the plain column holds the canonical source; for other
        // locales read the value from the per-field i18n column.
        let value: unknown;
        if (sourceLocale === 'es') {
            value = data[field];
        } else {
            const i18nCol = i18nColumnMap[field];
            const i18nValue = i18nCol ? (data[i18nCol] as I18nText | null) : null;
            value = i18nValue?.[sourceLocale];
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            fields[field] = value;
        }
    }
    return fields;
}

/** Input for an admin manual translation override. */
export interface ManualOverrideInput {
    entityType: TranslatableEntityType;
    entityId: string;
    fieldType: string;
    locale: 'en' | 'pt';
    value: string;
}

/** Result of a manual override attempt. */
export type ManualOverrideResult =
    | { ok: true }
    | { ok: false; code: 'INVALID_FIELD' | 'NOT_FOUND' };

/**
 * Applies an admin manual translation override for a single field/locale.
 *
 * Reads the current i18n value + meta, sets only the targeted locale, and flags
 * it as `autoTranslated: false` so future auto-translation never overwrites it.
 */
export async function applyManualOverride(
    input: ManualOverrideInput
): Promise<ManualOverrideResult> {
    const { entityType, entityId, fieldType, locale, value } = input;

    const column = I18N_COLUMN_MAP[entityType][fieldType];
    if (!column) {
        return { ok: false, code: 'INVALID_FIELD' };
    }

    const table = getEntityTable(entityType);
    const db = getDb();
    const [existing] = await db
        .select({ value: i18nColumn(table, column), translationMeta: table.translationMeta })
        .from(table)
        .where(eq(table.id, entityId))
        .limit(1);

    if (!existing) {
        return { ok: false, code: 'NOT_FOUND' };
    }

    const existingRow = existing as Record<string, unknown>;
    const existingValue = (existingRow.value as I18nText | null) ?? { es: '', en: '', pt: '' };
    const nextValue: I18nText = {
        es: existingValue.es ?? '',
        en: existingValue.en ?? '',
        pt: existingValue.pt ?? ''
    };
    nextValue[locale] = value;

    const existingMeta = (existingRow.translationMeta as TranslationMeta | null) ?? {};
    const nextMeta: TranslationMeta = {
        ...existingMeta,
        [fieldType]: {
            ...(existingMeta[fieldType] ?? {}),
            [locale]: {
                autoTranslated: false,
                translatedAt: new Date().toISOString()
            }
        }
    };

    await db
        .update(table)
        .set({ [column]: nextValue, translationMeta: nextMeta })
        .where(eq(table.id, entityId));

    return { ok: true };
}

/**
 * Batch translates entities of a given type.
 * Processes entities in pages with concurrency control.
 *
 * @param input - Batch configuration (entity type, cursor, batch size, concurrency).
 * @returns Batch results with counts and next cursor.
 */
export async function batchTranslate(input: BatchTranslateInput): Promise<BatchTranslateResult> {
    const { entityType, cursor, batchSize = 10, concurrency = 3 } = input;

    const table = getEntityTable(entityType);
    const i18nColumnMap = I18N_COLUMN_MAP[entityType];
    const db = getDb();
    const fields = ENTITY_FIELDS[entityType];

    // Fetch a page of entities
    const conditions = [isNull(table.deletedAt)];
    if (cursor) {
        conditions.push(gt(table.id, cursor));
    }

    const entities = (await db
        .select({ id: table.id })
        .from(table)
        .where(and(...conditions))
        .orderBy(table.id)
        .limit(batchSize + 1)) as Array<{ id: string }>; // +1 to detect if there's a next page

    const hasMore = entities.length > batchSize;
    const pageEntities = hasMore ? entities.slice(0, batchSize) : entities;

    let translated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ entityId: string; error: string }> = [];

    type EntityOutcome = {
        entityId: string;
        status: 'translated' | 'skipped' | 'failed';
        error?: string;
    };

    // Process entities with concurrency control
    for (let i = 0; i < pageEntities.length; i += concurrency) {
        const batch = pageEntities.slice(i, i + concurrency);

        const results = await Promise.allSettled<EntityOutcome>(
            batch.map(async (entity): Promise<EntityOutcome> => {
                // Fetch the entity's current text fields + existing translations
                const [entityData] = await db
                    .select()
                    .from(table)
                    .where(eq(table.id, entity.id))
                    .limit(1);

                if (!entityData) {
                    return { entityId: entity.id, status: 'failed', error: 'Entity not found' };
                }

                const row = entityData as Record<string, unknown>;

                // Extract field values
                const fieldValues: Record<string, string> = {};
                for (const field of fields) {
                    const value = row[field];
                    if (typeof value === 'string' && value.trim().length > 0) {
                        fieldValues[field] = value;
                    }
                }

                if (Object.keys(fieldValues).length === 0) {
                    return { entityId: entity.id, status: 'skipped' };
                }

                // Idempotency: skip when every translatable field already has all
                // target locales populated (AC-13 — no redundant cost on re-runs).
                const fullyTranslated = Object.keys(fieldValues).every((field) => {
                    const col = i18nColumnMap[field];
                    if (!col) return false;
                    const value = row[col] as I18nText | null;
                    return (
                        Boolean(value) && TARGET_LOCALES.every((locale) => Boolean(value?.[locale]))
                    );
                });
                if (fullyTranslated) {
                    return { entityId: entity.id, status: 'skipped' };
                }

                // Translate then persist (persist merges, so manual overrides and
                // already-translated locales are preserved).
                const translateResult = await translateEntity({
                    entityType,
                    entityId: entity.id,
                    fields: fieldValues
                });

                await persistTranslations(
                    entityType,
                    entity.id,
                    fieldValues,
                    translateResult.translations,
                    translateResult.provider,
                    translateResult.model
                );

                return { entityId: entity.id, status: 'translated' };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.status === 'translated') {
                    translated++;
                } else if (result.value.status === 'skipped') {
                    skipped++;
                } else {
                    failed++;
                    errors.push({
                        entityId: result.value.entityId,
                        error: result.value.error ?? 'Unknown error'
                    });
                }
            } else {
                failed++;
                const error =
                    result.reason instanceof Error ? result.reason.message : String(result.reason);
                errors.push({ entityId: 'unknown', error });
            }
        }

        // Throttle between concurrency batches to respect provider rate limits.
        if (i + concurrency < pageEntities.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
    }

    const lastEntity =
        hasMore && pageEntities.length > 0 ? pageEntities[pageEntities.length - 1] : undefined;
    const nextCursor = lastEntity?.id;

    apiLogger.info(
        { entityType, translated, skipped, failed, hasMore: !!nextCursor },
        'ai-translate: batch complete'
    );

    return {
        translated,
        skipped,
        failed,
        nextCursor,
        errors
    };
}
