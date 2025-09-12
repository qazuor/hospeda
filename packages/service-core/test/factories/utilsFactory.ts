/**
 * utilsFactory.ts
 *
 * Shared helpers for test factories in service-core.
 * Includes getMockId for generating valid UUIDs for each entity type.
 */

import crypto from 'node:crypto';

/**
 * Supported entity types for generating mock IDs.
 */
export type IdTypes =
    | 'user'
    | 'accommodation'
    | 'destination'
    | 'destinationReview'
    | 'post'
    | 'event'
    | 'tag'
    | 'feature'
    | 'iaData';

function generateValidUuidFromLabel(label: string): string {
    const hash = crypto.createHash('md5').update(label).digest('hex');
    // Create RFC 4122 compliant UUID (version 4 variant)
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where x is any hex digit and y is 8, 9, A, or B
    return (
        `${hash.substring(0, 8)}-` +
        `${hash.substring(8, 12)}-` +
        `4${hash.substring(13, 16)}-` +
        `${((Number.parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.substring(18, 20)}-` +
        `${hash.substring(20, 32)}`
    );
}

/**
 * Returns a valid UUID for the given entity type, optionally using a custom string for deterministic output.
 *
 * If an explicit UUID is provided as id, it is returned as-is. Otherwise, a deterministic UUID is generated
 * based on the provided id string, or a random UUID for the entity type if no id is given.
 *
 * @param type - The entity type for which to generate a mock ID.
 * @param id - Optional custom string to hash into a UUID, or an explicit UUID.
 * @returns {string} A valid UUID string for the entity type.
 *
 * @example
 * const userId = getMockId('user');
 * const customId = getMockId('accommodation', 'my-custom-key');
 */
export const getMockId = (type: IdTypes, id?: string): string => {
    if (id && /^[0-9a-fA-F-]{36}$/.test(id)) return id;
    if (id) {
        const hash = crypto.createHash('md5').update(id).digest('hex');
        return (
            `${hash.substring(0, 8)}-` +
            `${hash.substring(8, 12)}-` +
            `4${hash.substring(13, 16)}-` +
            `${((Number.parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.substring(18, 20)}-` +
            `${hash.substring(20, 32)}`
        );
    }
    return generateValidUuidFromLabel(type);
};

/**
 * Returns a mock FAQ ID for use in tests, using the 'feature' entity type.
 * @param id - Optional custom string to hash into a UUID, or an explicit UUID.
 * @returns {string} A valid UUID string for a FAQ entity.
 *
 * @example
 * const faqId = getMockFaqId();
 * const customFaqId = getMockFaqId('faq-123');
 */
export const getMockFaqId = (id?: string): string => getMockId('feature', id);

/**
 * Returns a mock AI data ID for use in tests, using the 'iaData' entity type.
 * @param id - Optional custom string to hash into a UUID, or an explicit UUID.
 * @returns {string} A valid UUID string for an AI data entity.
 *
 * @example
 * const iaDataId = getMockIaDataId();
 * const customIaDataId = getMockIaDataId('ia-data-123');
 */
export const getMockIaDataId = (id?: string): string => getMockId('iaData', id);
