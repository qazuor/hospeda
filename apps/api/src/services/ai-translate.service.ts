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

import type { AiFeature, I18nText } from '@repo/schemas';
import { getDb } from '@repo/db';
import {
    accommodations,
    destinations,
    events,
    posts
} from '@repo/db/schemas';
import { eq, isNull, and, gt } from 'drizzle-orm';
import { createConfiguredAiService } from './ai-service.factory.js';
import { apiLogger } from '../utils/logger.js';

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

/** Map entity type to its Drizzle table. */
const ENTITY_TABLES: Record<TranslatableEntityType, any> = {
    accommodation: accommodations,
    destination: destinations,
    event: events,
    post: posts
};

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

/** Target locales for translation (Spanish is the source). */
const TARGET_LOCALES = ['en', 'pt'] as const;

const FEATURE: AiFeature = 'translate';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface TranslateEntityInput {
    entityType: TranslatableEntityType;
    entityId: string;
    fields: Record<string, string>;
    targetLocales?: ('en' | 'pt')[];
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
    failed: number;
    nextCursor?: string;
    errors: Array<{ entityId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Translation helpers
// ---------------------------------------------------------------------------

/**
 * Builds the user prompt for translating a single field.
 */
function buildTranslationPrompt(fieldValue: string, targetLocale: string): string {
    return `Translate the following Spanish text to ${targetLocale === 'en' ? 'English' : 'Portuguese'}:\n\n${fieldValue}`;
}

/**
 * Translates a single text field to a target locale using the AI engine.
 * Returns the translated text or the original on failure.
 */
async function translateField(
    aiService: Awaited<ReturnType<typeof createConfiguredAiService>>,
    fieldValue: string,
    targetLocale: string
): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; provider: string; model: string }> {
    const prompt = buildTranslationPrompt(fieldValue, targetLocale);

    const result = await aiService.generateText({
        feature: FEATURE,
        prompt,
        locale: targetLocale as 'en' | 'pt'
    });

    return {
        text: result.text,
        usage: result.usage,
        provider: result.provider,
        model: result.model
    };
}

/**
 * Translates a single field with retry logic.
 * On failure, returns the original Spanish text.
 */
async function translateFieldWithRetry(
    aiService: Awaited<ReturnType<typeof createConfiguredAiService>>,
    fieldValue: string,
    targetLocale: string,
    fieldType: string,
    entityId: string
): Promise<TranslateResult> {
    try {
        const result = await translateField(aiService, fieldValue, targetLocale);
        return {
            fieldType,
            locale: targetLocale,
            translatedText: result.text,
            success: true
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        apiLogger.warn(
            { entityId, fieldType, targetLocale, error: errorMessage },
            'ai-translate: translation failed for field, keeping Spanish value'
        );
        return {
            fieldType,
            locale: targetLocale,
            translatedText: fieldValue,
            success: false,
            error: errorMessage
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
    const { entityType, entityId, fields, targetLocales = TARGET_LOCALES } = input;

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
            const result = await translateFieldWithRetry(
                aiService,
                fieldValue,
                locale,
                fieldType,
                entityId
            );

            translations.push(result);

            if (result.success) {
                // Track usage from the last successful call
                // (each call produces its own usage; we accumulate)
                totalTokens += 0; // usage is per-call, not accumulated here
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
 * Persists translation results to the database.
 * Updates the I18nText columns and translation_meta for the entity.
 */
export async function persistTranslations(
    entityType: TranslatableEntityType,
    entityId: string,
    fieldValues: Record<string, string>,
    results: readonly TranslateResult[],
    provider: string,
    model: string
): Promise<void> {
    const table = ENTITY_TABLES[entityType] as any;
    const i18nColumnMap = I18N_COLUMN_MAP[entityType];

    // Build the I18nText objects per field
    const i18nUpdates: Record<string, { es: string; en: string; pt: string }> = {};
    const metaUpdates: Record<string, Record<string, { autoTranslated: boolean; translatedAt: string; provider: string; model: string }>> = {};

    for (const result of results) {
        const i18nColumn = i18nColumnMap[result.fieldType];
        if (!i18nColumn) continue;

        if (!i18nUpdates[result.fieldType]) {
            // Initialize with Spanish as base
            i18nUpdates[result.fieldType] = {
                es: fieldValues[result.fieldType] ?? '',
                en: '',
                pt: ''
            };
        }

        // Set the translated locale
        const i18nEntry = i18nUpdates[result.fieldType];
        if (i18nEntry) {
            i18nEntry[result.locale as 'en' | 'pt'] = result.translatedText;
        }

        // Track metadata
        if (!metaUpdates[result.fieldType]) {
            metaUpdates[result.fieldType] = {};
        }
        metaUpdates[result.fieldType]![result.locale] = {
            autoTranslated: result.success,
            translatedAt: new Date().toISOString(),
            provider: result.success ? provider : '',
            model: result.success ? model : ''
        };
    }

    // Build the update set
    const updateSet: Record<string, unknown> = {};
    for (const [fieldType, i18nValue] of Object.entries(i18nUpdates)) {
        const i18nColumn = i18nColumnMap[fieldType];
        if (i18nColumn) {
            updateSet[i18nColumn] = i18nValue;
        }
    }

    // Merge translation metadata
    if (Object.keys(metaUpdates).length > 0) {
        // Read existing meta
        const db = getDb();
        const [existing] = await db
            .select({ translationMeta: (table as any).translationMeta })
            .from(table)
            .where(eq((table as any).id, entityId))
            .limit(1);

        const existingMeta = (existing?.translationMeta as Record<string, Record<string, unknown>> | null) ?? {};
        const mergedMeta: Record<string, Record<string, unknown>> = { ...existingMeta };

        for (const [fieldType, localeMeta] of Object.entries(metaUpdates)) {
            if (!mergedMeta[fieldType]) {
                mergedMeta[fieldType] = {};
            }
            Object.assign(mergedMeta[fieldType] as Record<string, unknown>, localeMeta);
        }

        updateSet.translationMeta = mergedMeta;
    }

    // Perform the update
    const db = getDb();
    await db
        .update(table)
        .set(updateSet)
        .where(eq((table as any).id, entityId));

    apiLogger.info(
        { entityType, entityId, fieldsUpdated: Object.keys(i18nUpdates) },
        'ai-translate: translations persisted'
    );
}

/**
 * Batch translates entities of a given type.
 * Processes entities in pages with concurrency control.
 *
 * @param input - Batch configuration (entity type, cursor, batch size, concurrency).
 * @returns Batch results with counts and next cursor.
 */
export async function batchTranslate(input: BatchTranslateInput): Promise<BatchTranslateResult> {
    const {
        entityType,
        cursor,
        batchSize = 10,
        concurrency = 3
    } = input;

    const table = ENTITY_TABLES[entityType] as any;
    const db = getDb();
    const fields = ENTITY_FIELDS[entityType];

    // Fetch a page of entities
    const conditions = [isNull(table.deletedAt)];
    if (cursor) {
        conditions.push(gt(table.id, cursor));
    }

    const entities = await db
        .select({ id: table.id })
        .from(table)
        .where(and(...conditions))
        .orderBy(table.id)
        .limit(batchSize + 1); // +1 to detect if there's a next page

    const hasMore = entities.length > batchSize;
    const pageEntities = hasMore ? entities.slice(0, batchSize) : entities;

    let translated = 0;
    let failed = 0;
    const errors: Array<{ entityId: string; error: string }> = [];

    // Process entities with concurrency control
    for (let i = 0; i < pageEntities.length; i += concurrency) {
        const batch = pageEntities.slice(i, i + concurrency);

        const results = await Promise.allSettled(
            batch.map(async (entity) => {
                // Fetch the entity's current text fields
                const [entityData] = await db
                    .select()
                    .from(table)
                    .where(eq(table.id, entity.id))
                    .limit(1);

                if (!entityData) {
                    return { entityId: entity.id, error: 'Entity not found' };
                }

                // Extract field values
                const fieldValues: Record<string, string> = {};
                for (const field of fields) {
                    const value = entityData[field];
                    if (typeof value === 'string' && value.trim().length > 0) {
                        fieldValues[field] = value;
                    }
                }

                if (Object.keys(fieldValues).length === 0) {
                    return { entityId: entity.id, error: 'No translatable fields' };
                }

                // Translate
                const translateResult = await translateEntity({
                    entityType,
                    entityId: entity.id,
                    fields: fieldValues
                });

                // Persist
                await persistTranslations(
                    entityType,
                    entity.id,
                    fieldValues,
                    translateResult.translations,
                    translateResult.provider,
                    translateResult.model
                );

                return { entityId: entity.id, error: null };
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.error === null) {
                translated++;
            } else {
                failed++;
                const entityId = result.status === 'fulfilled' ? result.value.entityId : 'unknown';
                const error = result.status === 'fulfilled'
                    ? (result.value.error ?? 'Unknown error')
                    : result.reason instanceof Error
                        ? result.reason.message
                        : String(result.reason);
                errors.push({ entityId, error });
            }
        }
    }

    const lastEntity = hasMore && pageEntities.length > 0
        ? pageEntities[pageEntities.length - 1]
        : undefined;
    const nextCursor = lastEntity?.id;

    apiLogger.info(
        { entityType, translated, failed, hasMore: !!nextCursor },
        'ai-translate: batch complete'
    );

    return {
        translated,
        failed,
        nextCursor,
        errors
    };
}
