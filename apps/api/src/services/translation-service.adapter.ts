/**
 * Translation service adapter for SPEC-212.
 *
 * Bridges the `TranslationService` interface (from @repo/service-core)
 * with the real AI translation implementation (from apps/api).
 *
 * Initialized once at API startup and registered as a singleton
 * via `initializeTranslationService()`.
 *
 * @module services/translation-service.adapter
 */

import type { TranslationService, TranslationInput } from '@repo/service-core';
import { translateEntity, persistTranslations } from './ai-translate.service';
import type { TranslatableEntityType } from './ai-translate.service';
import { apiLogger } from '../utils/logger';

/** Entity types that can be translated. */
const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set([
    'accommodation',
    'destination',
    'event',
    'post'
]);

/**
 * Creates the real translation service implementation.
 * Called once at API startup.
 */
export function createTranslationServiceAdapter(): TranslationService {
    return {
        async translate(input: TranslationInput): Promise<void> {
            const { entityType, entityId, fields } = input;

            if (!VALID_ENTITY_TYPES.has(entityType)) {
                apiLogger.debug(
                    { entityType, entityId },
                    'translation-service.adapter: skipping non-translatable entity type'
                );
                return;
            }

            if (Object.keys(fields).length === 0) {
                return;
            }

            try {
                const result = await translateEntity({
                    entityType: entityType as TranslatableEntityType,
                    entityId,
                    fields
                });

                await persistTranslations(
                    entityType as TranslatableEntityType,
                    entityId,
                    fields,
                    result.translations,
                    result.provider,
                    result.model
                );

                apiLogger.info(
                    { entityType, entityId, translationsCount: result.translations.length },
                    'translation-service.adapter: auto-translation completed'
                );
            } catch (error) {
                // Fire-and-forget: never throw back to the caller
                apiLogger.warn(
                    {
                        entityType,
                        entityId,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'translation-service.adapter: auto-translation failed (non-blocking)'
                );
            }
        }
    };
}
