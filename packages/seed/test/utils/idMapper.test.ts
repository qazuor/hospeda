import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';

/**
 * Creates an IdMapper pointing to a temporary directory to avoid
 * polluting the real project mappings/ folder.
 */
const createTempMapper = (): { mapper: IdMapper; dir: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idmapper-'));
    // Override cwd so IdMapper creates the mappings dir inside our temp dir
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const mapper = new IdMapper(true); // dontLoadSavedMappings = true
    vi.restoreAllMocks();
    return { mapper, dir };
};

describe('IdMapper', () => {
    let mapper: IdMapper;
    let tempDir: string;

    beforeEach(() => {
        const created = createTempMapper();
        mapper = created.mapper;
        tempDir = created.dir;
    });

    afterEach(() => {
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('setMapping / getRealId', () => {
        it('stores a seed-id → real-id mapping and retrieves it', () => {
            // Arrange
            const seedId = 'seed-user-001';
            const realId = '550e8400-e29b-41d4-a716-446655440000';

            // Act
            mapper.setMapping('users', seedId, realId);

            // Assert
            expect(mapper.getRealId('users', seedId)).toBe(realId);
        });

        it('returns undefined for unknown seed IDs', () => {
            expect(mapper.getRealId('users', 'nonexistent')).toBeUndefined();
        });

        it('returns undefined for unknown entity types', () => {
            mapper.setMapping('users', 'seed-001', 'real-001');
            expect(mapper.getRealId('destinations', 'seed-001')).toBeUndefined();
        });
    });

    describe('hasMapping', () => {
        it('returns true when mapping exists', () => {
            mapper.setMapping('destinations', 'seed-dest-001', 'uuid-dest-001');
            expect(mapper.hasMapping('destinations', 'seed-dest-001')).toBe(true);
        });

        it('returns false when mapping does not exist', () => {
            expect(mapper.hasMapping('destinations', 'missing')).toBe(false);
        });
    });

    describe('getDisplayName', () => {
        it('returns stored name when available', () => {
            mapper.setMapping('users', 'seed-001', 'real-001', 'Alice');
            expect(mapper.getDisplayName('users', 'seed-001')).toBe('Alice');
        });

        it('falls back to seedId when no name was stored', () => {
            mapper.setMapping('users', 'seed-002', 'real-002');
            expect(mapper.getDisplayName('users', 'seed-002')).toBe('seed-002');
        });

        it('falls back to seedId for unknown mapping', () => {
            expect(mapper.getDisplayName('users', 'unknown-id')).toBe('unknown-id');
        });
    });

    describe('getMappingData', () => {
        it('returns full mapping data including name', () => {
            mapper.setMapping('amenities', 'seed-wifi', 'real-wifi-uuid', 'Wi-Fi');

            const data = mapper.getMappingData('amenities', 'seed-wifi');

            expect(data).toBeDefined();
            expect(data?.id).toBe('real-wifi-uuid');
            expect(data?.name).toBe('Wi-Fi');
        });

        it('returns undefined for unknown seed ID', () => {
            expect(mapper.getMappingData('amenities', 'missing')).toBeUndefined();
        });
    });

    describe('getRealIds', () => {
        it('returns array of real IDs matching seed IDs order', () => {
            mapper.setMapping('tags', 'seed-tag-1', 'real-tag-1');
            mapper.setMapping('tags', 'seed-tag-2', 'real-tag-2');

            const result = mapper.getRealIds('tags', ['seed-tag-1', 'seed-tag-2', 'missing']);

            expect(result).toEqual(['real-tag-1', 'real-tag-2', undefined]);
        });
    });

    describe('getValidRealIds', () => {
        it('filters out undefined values', () => {
            mapper.setMapping('tags', 'seed-1', 'real-1');

            const result = mapper.getValidRealIds('tags', ['seed-1', 'nonexistent']);

            expect(result).toEqual(['real-1']);
            expect(result).toHaveLength(1);
        });
    });

    describe('validateMappings', () => {
        it('returns isValid true when all IDs have mappings', () => {
            mapper.setMapping('features', 'feat-1', 'real-feat-1');
            mapper.setMapping('features', 'feat-2', 'real-feat-2');

            const result = mapper.validateMappings('features', ['feat-1', 'feat-2']);

            expect(result.isValid).toBe(true);
            expect(result.missingIds).toHaveLength(0);
            expect(result.validIds).toEqual(['real-feat-1', 'real-feat-2']);
        });

        it('returns isValid false when some IDs are missing', () => {
            mapper.setMapping('features', 'feat-1', 'real-feat-1');

            const result = mapper.validateMappings('features', ['feat-1', 'missing-feat']);

            expect(result.isValid).toBe(false);
            expect(result.missingIds).toContain('missing-feat');
            expect(result.validIds).toContain('real-feat-1');
        });
    });

    describe('getMappingStats', () => {
        it('returns zero count for unknown entity type', () => {
            const stats = mapper.getMappingStats('unknown');
            expect(stats.count).toBe(0);
            expect(stats.examples).toHaveLength(0);
        });

        it('returns correct count after adding mappings', () => {
            mapper.setMapping('posts', 'seed-post-1', 'real-post-1', 'Post One');
            mapper.setMapping('posts', 'seed-post-2', 'real-post-2', 'Post Two');

            const stats = mapper.getMappingStats('posts');

            expect(stats.count).toBe(2);
            expect(stats.examples.length).toBeGreaterThan(0);
        });
    });

    describe('clearEntityType', () => {
        it('removes all mappings for a specific entity type', () => {
            mapper.setMapping('events', 'seed-evt-1', 'real-evt-1');
            mapper.clearEntityType('events');

            expect(mapper.hasMapping('events', 'seed-evt-1')).toBe(false);
        });

        it('does not affect other entity types', () => {
            mapper.setMapping('events', 'seed-evt-1', 'real-evt-1');
            mapper.setMapping('users', 'seed-usr-1', 'real-usr-1');

            mapper.clearEntityType('events');

            expect(mapper.hasMapping('users', 'seed-usr-1')).toBe(true);
        });
    });

    describe('clearAll', () => {
        it('removes all mappings across all entity types', () => {
            mapper.setMapping('users', 'seed-usr-1', 'real-usr-1');
            mapper.setMapping('events', 'seed-evt-1', 'real-evt-1');

            mapper.clearAll();

            expect(mapper.hasMapping('users', 'seed-usr-1')).toBe(false);
            expect(mapper.hasMapping('events', 'seed-evt-1')).toBe(false);
        });
    });

    describe('entity-specific convenience methods', () => {
        it('getMappedUserId delegates to getRealId for users', () => {
            mapper.setMapping('users', 'seed-user-abc', 'real-user-abc');
            expect(mapper.getMappedUserId('seed-user-abc')).toBe('real-user-abc');
        });

        it('getMappedDestinationId delegates to getRealId for destinations', () => {
            mapper.setMapping('destinations', 'seed-dest-abc', 'real-dest-abc');
            expect(mapper.getMappedDestinationId('seed-dest-abc')).toBe('real-dest-abc');
        });

        it('getMappedAccommodationId delegates to getRealId for accommodations', () => {
            mapper.setMapping('accommodations', 'seed-acc-abc', 'real-acc-abc');
            expect(mapper.getMappedAccommodationId('seed-acc-abc')).toBe('real-acc-abc');
        });

        it('getMappedAmenityId delegates to getRealId for amenities', () => {
            mapper.setMapping('amenities', 'seed-amenity-abc', 'real-amenity-abc');
            expect(mapper.getMappedAmenityId('seed-amenity-abc')).toBe('real-amenity-abc');
        });

        it('getMappedTagId delegates to getRealId for tags', () => {
            mapper.setMapping('tags', 'seed-tag-abc', 'real-tag-abc');
            expect(mapper.getMappedTagId('seed-tag-abc')).toBe('real-tag-abc');
        });
    });
});
