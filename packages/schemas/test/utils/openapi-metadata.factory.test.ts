/**
 * Tests for OpenAPI Metadata Factory
 * Validates consistent metadata generation across entities
 */
import { describe, expect, it } from 'vitest';
import {
    createCrudMetadata,
    createEntityMetadata,
    createListMetadata,
    createSearchMetadata
} from '../../src/utils/openapi-metadata.factory.js';

describe('OpenAPI Metadata Factory', () => {
    describe('createSearchMetadata', () => {
        it('should create basic search metadata with defaults', () => {
            const metadata = createSearchMetadata({
                entityName: 'User',
                entityNameLower: 'user'
            });

            expect(metadata.ref).toBe('UserSearch');
            expect(metadata.description).toBe('Schema for searching and filtering user entities');
            expect(metadata.title).toBe('User Search Parameters');
            expect(metadata.tags).toEqual(['users', 'search']);
        });
    });

    describe('createEntityMetadata', () => {
        it('should create basic entity metadata', () => {
            const metadata = createEntityMetadata({
                entityName: 'User',
                entityNameLower: 'user'
            });

            expect(metadata.ref).toBe('User');
            expect(metadata.description).toBe('Complete user entity schema');
            expect(metadata.title).toBe('User Entity');
            expect(metadata.tags).toEqual(['users']);
        });
    });

    describe('createListMetadata', () => {
        it('should create basic list metadata', () => {
            const metadata = createListMetadata({
                entityName: 'User',
                entityNameLower: 'user'
            });

            expect(metadata.ref).toBe('UserList');
            expect(metadata.description).toBe('Paginated list of user entities');
            expect(metadata.title).toBe('User List Response');
        });
    });

    describe('createCrudMetadata', () => {
        it('should create all metadata types at once', () => {
            const metadata = createCrudMetadata('User', 'user');

            expect(metadata.entity).toBeDefined();
            expect(metadata.search).toBeDefined();
            expect(metadata.list).toBeDefined();

            expect(metadata.entity.ref).toBe('User');
            expect(metadata.search.ref).toBe('UserSearch');
            expect(metadata.list.ref).toBe('UserList');
        });
    });
});
