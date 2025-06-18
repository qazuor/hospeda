/**
 * utilsFactory.ts
 *
 * Shared helpers for test factories in service-core.
 * Includes getMockId for generating valid UUIDs for each entity type.
 */

import crypto from 'node:crypto';

export type IdTypes =
    | 'user'
    | 'accommodation'
    | 'destination'
    | 'post'
    | 'event'
    | 'tag'
    | 'feature';

function generateValidUuidFromLabel(label: string): string {
    const rawUuid = crypto.randomUUID();
    const prefix = crypto.createHash('md5').update(label).digest('hex').slice(0, 8);
    return `${prefix}-${rawUuid.slice(9)}`;
}

const idTypeStrings: Record<IdTypes, string> = {
    user: generateValidUuidFromLabel('user'),
    accommodation: generateValidUuidFromLabel('accommodation'),
    destination: generateValidUuidFromLabel('destination'),
    post: generateValidUuidFromLabel('post'),
    event: generateValidUuidFromLabel('event'),
    tag: generateValidUuidFromLabel('tag'),
    feature: generateValidUuidFromLabel('feature')
};

/**
 * Returns a valid UUID for the given entity type.
 * @param type - The entity type
 * @param id - Optional custom string to hash into a UUID
 * @returns string (UUID)
 */
export const getMockId = (type: IdTypes, id?: string): string => {
    if (id && /^[0-9a-fA-F-]{36}$/.test(id)) return id;
    if (id) {
        const hash = crypto.createHash('md5').update(id).digest('hex');
        return (
            `${hash.substring(0, 8)}-` +
            `${hash.substring(8, 12)}-` +
            `${hash.substring(12, 16)}-` +
            `${hash.substring(16, 20)}-` +
            `${hash.substring(20, 32)}`
        );
    }
    return idTypeStrings[type];
};
