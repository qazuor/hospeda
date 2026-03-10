import { describe, expect, it } from 'vitest';
import { getEntitySchema } from '../../../src/lib/validation/schema-registry';
import type { EntityType } from '../../../src/lib/validation/schema-registry';

const ENTITY_TYPES: EntityType[] = [
    'accommodation',
    'amenity',
    'feature',
    'attraction',
    'destination',
    'event',
    'eventLocation',
    'eventOrganizer',
    'post',
    'sponsor',
    'tag',
    'user'
];

describe('getEntitySchema', () => {
    describe('create mode', () => {
        it.each(ENTITY_TYPES)('returns a schema for %s', (entityType) => {
            const schema = getEntitySchema({ entityType, mode: 'create' });
            expect(schema).toBeDefined();
        });
    });

    describe('edit mode', () => {
        it.each(ENTITY_TYPES)('returns a schema for %s', (entityType) => {
            const schema = getEntitySchema({ entityType, mode: 'edit' });
            expect(schema).toBeDefined();
        });
    });

    it('returns undefined for unknown entity type', () => {
        const schema = getEntitySchema({ entityType: 'nonexistent', mode: 'create' });
        expect(schema).toBeUndefined();
    });

    it('create schema requires mandatory fields (safeParse({}) fails)', () => {
        const schema = getEntitySchema({ entityType: 'amenity', mode: 'create' });
        expect(schema).toBeDefined();
        const result = schema!.safeParse({});
        expect(result.success).toBe(false);
    });

    it('edit schema allows empty object (safeParse({}) passes due to .partial())', () => {
        const schema = getEntitySchema({ entityType: 'amenity', mode: 'edit' });
        expect(schema).toBeDefined();
        const result = schema!.safeParse({});
        expect(result.success).toBe(true);
    });
});
