/**
 * Translation service singleton initialization (SPEC-212).
 *
 * Follows the same pattern as revalidation-init.ts:
 * - Interface defined in service-core (packages can import it)
 * - Real implementation provided by apps/api at startup
 * - Entity services call getTranslationService() in their hooks
 *
 * @module translation-init
 */

import { createLogger } from '@repo/logger';

const logger = createLogger('translation-init');

/**
 * Input for the translation function.
 * Generic enough to work with any translatable entity.
 */
export interface TranslationInput {
    /** Entity type (accommodation, destination, event, post). */
    entityType: string;
    /** Entity ID (UUID). */
    entityId: string;
    /** Field name → Spanish text value. Only non-empty fields are translated. */
    fields: Record<string, string>;
}

/**
 * Interface for the translation service.
 * Implemented in apps/api, consumed in packages/service-core.
 */
export interface TranslationService {
    /**
     * Translates a content entity's text fields asynchronously.
     * Fire-and-forget: the caller does NOT await this.
     */
    translate(input: TranslationInput): Promise<void>;
}

let _instance: TranslationService | undefined;

/**
 * Initialize the translation service singleton.
 * Called once at API startup from apps/api.
 *
 * @param service - The translation service implementation.
 * @returns The same service instance.
 */
export function initializeTranslationService(service: TranslationService): TranslationService {
    if (_instance !== undefined) {
        logger.warn('[TranslationService] Already initialized — ignoring new instance');
        return _instance;
    }
    _instance = service;
    return _instance;
}

/**
 * Returns the initialized translation service singleton.
 * Returns `undefined` if not yet initialized (e.g. in tests or before startup).
 */
export function getTranslationService(): TranslationService | undefined {
    return _instance;
}

/**
 * Resets the singleton. Use only in tests.
 */
export function _resetTranslationService(): void {
    _instance = undefined;
}
