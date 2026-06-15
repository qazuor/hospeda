import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Creates an IdMapper pointing to a temporary directory to avoid
 * polluting the real project mappings/ folder.
 */
const createTempMapper = (): { mapper: IdMapper; dir: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idmapper-extra-'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const mapper = new IdMapper(true); // dontLoadSavedMappings = true
    vi.restoreAllMocks();
    return { mapper, dir };
};

describe('IdMapper — saveMappingsToFile / getMappingsFilePath', () => {
    let mapper: IdMapper;
    let tempDir: string;

    beforeEach(() => {
        const created = createTempMapper();
        mapper = created.mapper;
        tempDir = created.dir;
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    describe('getMappingsFilePath', () => {
        it('should return the path to the id-mappings.json file inside mappings/', () => {
            // Act
            const filePath = mapper.getMappingsFilePath();

            // Assert
            expect(filePath).toMatch(/mappings[/\\]id-mappings\.json$/);
        });

        it('should return an absolute path', () => {
            // Act
            const filePath = mapper.getMappingsFilePath();

            // Assert
            expect(path.isAbsolute(filePath)).toBe(true);
        });
    });

    describe('saveMappingsToFile', () => {
        it('should persist mappings to the JSON file and log the path', () => {
            // Arrange
            mapper.setMapping('users', 'seed-u1', 'real-u1', 'Alice');
            const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

            // Act
            mapper.saveMappingsToFile();

            // Assert: the file exists and contains the mapping
            const filePath = mapper.getMappingsFilePath();
            expect(fs.existsSync(filePath)).toBe(true);

            const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
                string,
                Record<string, unknown>
            >;
            expect(content.users?.['seed-u1']).toEqual({ id: 'real-u1', name: 'Alice' });

            // Assert: logger.info was called with the file path
            const logCall = infoSpy.mock.calls.find((args) =>
                String(args[0]).includes('Mappings saved to')
            );
            expect(logCall).toBeDefined();
            expect(String(logCall?.[0])).toContain('id-mappings.json');

            infoSpy.mockRestore();
        });

        it('should write an empty object when no mappings exist', () => {
            // Arrange — no mappings set, suppress logger
            vi.spyOn(logger, 'info').mockImplementation(() => {});

            // Act
            mapper.saveMappingsToFile();

            // Assert
            const filePath = mapper.getMappingsFilePath();
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
                string,
                unknown
            >;
            expect(Object.keys(content)).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Convenience getters — display name by real ID (previously uncovered)
// ---------------------------------------------------------------------------

describe('IdMapper — getDisplayNameByRealId convenience methods', () => {
    let mapper: IdMapper;
    let tempDir: string;

    beforeEach(() => {
        const created = createTempMapper();
        mapper = created.mapper;
        tempDir = created.dir;
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('getDisplayNameByRealUserId should return name when mapping exists', () => {
        mapper.setMapping('users', 'seed-u1', 'real-u1', 'Bob');
        expect(mapper.getDisplayNameByRealUserId('real-u1')).toBe('Bob');
    });

    it('getDisplayNameByRealUserId should return realId as fallback', () => {
        expect(mapper.getDisplayNameByRealUserId('unknown-real-id')).toBe('unknown-real-id');
    });

    it('getDisplayNameByRealDestinationId should return name when mapping exists', () => {
        mapper.setMapping('destinations', 'seed-d1', 'real-d1', 'Concepcion');
        expect(mapper.getDisplayNameByRealDestinationId('real-d1')).toBe('Concepcion');
    });

    it('getDisplayNameByRealAccommodationId should return realId as fallback', () => {
        expect(mapper.getDisplayNameByRealAccommodationId('no-such-id')).toBe('no-such-id');
    });

    it('getDisplayNameByRealAttractionId should return name when mapping exists', () => {
        mapper.setMapping('attractions', 'seed-a1', 'real-a1', 'Museum');
        expect(mapper.getDisplayNameByRealAttractionId('real-a1')).toBe('Museum');
    });

    it('getDisplayNameByRealPostId should return realId as fallback for unknown entity', () => {
        expect(mapper.getDisplayNameByRealPostId('no-post')).toBe('no-post');
    });

    it('getDisplayNameByRealEventId should return name when mapping exists', () => {
        mapper.setMapping('events', 'seed-e1', 'real-e1', 'Carnival');
        expect(mapper.getDisplayNameByRealEventId('real-e1')).toBe('Carnival');
    });

    it('getDisplayNameByRealTagId should return realId as fallback for unknown entity type', () => {
        expect(mapper.getDisplayNameByRealTagId('unknown-tag')).toBe('unknown-tag');
    });

    it('getDisplayNameByRealAmenityId should return name when mapping exists', () => {
        mapper.setMapping('amenities', 'seed-am1', 'real-am1', 'Pool');
        expect(mapper.getDisplayNameByRealAmenityId('real-am1')).toBe('Pool');
    });

    it('getDisplayNameByRealFeatureId should return realId as fallback', () => {
        expect(mapper.getDisplayNameByRealFeatureId('no-feature')).toBe('no-feature');
    });
});

// ---------------------------------------------------------------------------
// getAllMappingStats / printAllMappingStats / printMappingStats
// ---------------------------------------------------------------------------

describe('IdMapper — getAllMappingStats / printMappingStats / printAllMappingStats', () => {
    let mapper: IdMapper;
    let tempDir: string;

    beforeEach(() => {
        const created = createTempMapper();
        mapper = created.mapper;
        tempDir = created.dir;
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('getAllMappingStats should return empty record when no mappings', () => {
        const stats = mapper.getAllMappingStats();
        expect(Object.keys(stats)).toHaveLength(0);
    });

    it('getAllMappingStats should include stats for every entity type', () => {
        mapper.setMapping('users', 'seed-u1', 'real-u1');
        mapper.setMapping('tags', 'seed-t1', 'real-t1');
        mapper.setMapping('tags', 'seed-t2', 'real-t2');

        const stats = mapper.getAllMappingStats();

        expect(stats.users?.count).toBe(1);
        expect(stats.tags?.count).toBe(2);
    });

    it('printMappingStats should not throw for an entity with zero mappings', () => {
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        expect(() => mapper.printMappingStats('nonexistent')).not.toThrow();
    });

    it('printMappingStats should not throw when examples exist', () => {
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        mapper.setMapping('posts', 'seed-p1', 'real-p1', 'My Post');
        expect(() => mapper.printMappingStats('posts')).not.toThrow();
    });

    it('printAllMappingStats should not throw when no mappings exist', () => {
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        expect(() => mapper.printAllMappingStats()).not.toThrow();
    });

    it('printAllMappingStats should not throw when mappings exist', () => {
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        mapper.setMapping('users', 'seed-u1', 'real-u1', 'Alice');
        mapper.setMapping('events', 'seed-e1', 'real-e1');
        expect(() => mapper.printAllMappingStats()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// loadMappings — file-based persistence round-trip
// ---------------------------------------------------------------------------

describe('IdMapper — persistence round-trip (loadMappings)', () => {
    let tempDir: string;

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('should load previously saved mappings on construction', () => {
        // Arrange: create a mapper, save mappings, then create another pointing at the same dir
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idmapper-persist-'));
        tempDir = dir;

        vi.spyOn(process, 'cwd').mockReturnValue(dir);
        const writer = new IdMapper(true);
        vi.restoreAllMocks();

        writer.setMapping('users', 'seed-u1', 'real-u1', 'Alice');

        // Act: create a new mapper in the same dir (with dontLoadSavedMappings = false)
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(process, 'cwd').mockReturnValue(dir);
        const reader = new IdMapper(false);
        vi.restoreAllMocks();

        // Assert: the mapping was persisted and loaded
        expect(reader.getRealId('users', 'seed-u1')).toBe('real-u1');
        expect(reader.getDisplayName('users', 'seed-u1')).toBe('Alice');
    });

    it('should handle legacy string-format mappings in the JSON file', () => {
        // Arrange: write a legacy file where values are plain strings (old format)
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idmapper-legacy-'));
        tempDir = dir;

        const mappingsDir = path.join(dir, 'mappings');
        fs.mkdirSync(mappingsDir);
        const legacyData = { users: { 'seed-u1': 'real-u1' } }; // old plain-string format
        fs.writeFileSync(path.join(mappingsDir, 'id-mappings.json'), JSON.stringify(legacyData));

        // Act
        vi.spyOn(logger, 'info').mockImplementation(() => {});
        vi.spyOn(process, 'cwd').mockReturnValue(dir);
        const mapper = new IdMapper(false);
        vi.restoreAllMocks();

        // Assert: legacy format is transparently upgraded
        expect(mapper.getRealId('users', 'seed-u1')).toBe('real-u1');
    });

    it('should not crash when the mappings file is corrupt JSON', () => {
        // Arrange
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-idmapper-corrupt-'));
        tempDir = dir;

        const mappingsDir = path.join(dir, 'mappings');
        fs.mkdirSync(mappingsDir);
        fs.writeFileSync(path.join(mappingsDir, 'id-mappings.json'), 'NOT VALID JSON!!!');

        vi.spyOn(process, 'cwd').mockReturnValue(dir);

        // Act — should not throw even with corrupt JSON
        let mapper: IdMapper | undefined;
        expect(() => {
            mapper = new IdMapper(false);
        }).not.toThrow();

        vi.restoreAllMocks();

        // Assert: mapper is still usable after corrupt file
        expect(mapper).toBeDefined();
        expect(mapper?.getRealId('users', 'seed-u1')).toBeUndefined();
    });
});
