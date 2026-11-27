/**
 * Translation service adapter for SPEC-212.
 *
 * Bridges the `TranslationService` interface (from @repo/service-core)
 * with the real AI translation implementation (from apps/api).
 *
 * Initialized once at API startup and registered as a singleton
 * via `initializeTranslationService()`.
 *
 * HOS-2658: when the input carries `billing` (a listing save), the run goes
 * through `runMeteredTranslation` — gated by the owner's `ai_translate` plan,
 * metered, and skipping MANUAL pairs before any provider call. Without
 * `billing` (destination, event, post) the legacy unmetered run is kept.
 *
 * @module services/translation-service.adapter
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError, type TranslationInput, type TranslationService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import type { TranslatableEntityType } from './ai-translate.service';
import { persistTranslations, translateEntity } from './ai-translate.service';
import { LISTING_TRANSLATION_QUOTA_VERTICAL } from './translation/listing-translation-state';
import { runMeteredTranslation } from './translation/metered-translation';

/** Entity types that can be translated. */
const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set([
    'accommodation',
    'destination',
    'event',
    'post',
    'venue',
    'experience'
]);

/** Gate refusals: an expected outcome of an on-save run, logged at `info`. */
const GATE_ERROR_CODES: ReadonlySet<ServiceErrorCode> = new Set([
    ServiceErrorCode.ENTITLEMENT_REQUIRED,
    ServiceErrorCode.LIMIT_REACHED
]);

/**
 * Runs a billed listing on-save translation. Never throws: gate refusals are
 * logged at `info`, every other failure (and an all-failed run) at `warn`.
 */
async function runBilledOnSave({
    entityType,
    entityId,
    fields,
    billing
}: {
    readonly entityType: TranslatableEntityType;
    readonly entityId: string;
    readonly fields: Readonly<Record<string, string>>;
    readonly billing: NonNullable<TranslationInput['billing']>;
}): Promise<void> {
    try {
        const result = await runMeteredTranslation({
            trigger: 'on-save',
            entityType,
            entityId,
            vertical: LISTING_TRANSLATION_QUOTA_VERTICAL[billing.vertical],
            billedUserId: billing.ownerId,
            fields
        });
        if (result.outcome === 'all-failed') {
            apiLogger.warn(
                { entityType, entityId, outcome: result.outcome },
                'listing-translation: on-save run failed'
            );
            return;
        }
        apiLogger.info(
            { entityType, entityId, outcome: result.outcome },
            'listing-translation: on-save run completed'
        );
    } catch (error) {
        if (error instanceof ServiceError && GATE_ERROR_CODES.has(error.code)) {
            apiLogger.info(
                { entityType, entityId, code: error.code },
                'listing-translation: on-save skipped by gate'
            );
            return;
        }
        apiLogger.warn(
            {
                entityType,
                entityId,
                outcome: 'error',
                error: error instanceof Error ? error.message : String(error)
            },
            'listing-translation: on-save run failed'
        );
    }
}

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

            if (input.billing) {
                await runBilledOnSave({
                    entityType: entityType as TranslatableEntityType,
                    entityId,
                    fields,
                    billing: input.billing
                });
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
