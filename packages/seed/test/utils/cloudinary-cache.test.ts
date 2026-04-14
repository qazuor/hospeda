import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    deleteCache,
    isCacheHit,
    readCache,
    updateCacheEntry,
    writeCache
} from '../../src/utils/cloudinary-cache.js';
import type { CacheEntry, ImageCache } from '../../src/utils/cloudinary-cache.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ENTRY: CacheEntry = {
    originalUrl: 'https://unsplash.com/photo/abc',
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/abc',
    uploadedAt: '2024-01-01T00:00:00.000Z',
    fileModifiedAt: null
};

const SAMPLE_CACHE: ImageCache = {
    'hospeda/test/abc': SAMPLE_ENTRY
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;
let cachePath: string;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-cache-test-'));
    cachePath = join(tmpDir, '.cloudinary-cache.json');
});

// tmpdir is cleaned up by the OS; no manual cleanup needed in tests.

// ---------------------------------------------------------------------------
// readCache
// ---------------------------------------------------------------------------

describe('readCache', () => {
    it('should return empty object when cache file does not exist', () => {
        const result = readCache(cachePath);
        expect(result).toEqual({});
    });

    it('should return parsed cache when file contains valid JSON', () => {
        writeFileSync(cachePath, JSON.stringify(SAMPLE_CACHE), 'utf-8');

        const result = readCache(cachePath);

        expect(result).toEqual(SAMPLE_CACHE);
    });

    it('should log warning, delete corrupt file, and return empty object when JSON is invalid', () => {
        writeFileSync(cachePath, 'not valid json!!!', 'utf-8');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith('[seed] Cache file corrupted, starting fresh');
        expect(existsSync(cachePath)).toBe(false);

        warnSpy.mockRestore();
    });

    it('should log warning and return empty object when JSON is an array (invalid structure)', () => {
        writeFileSync(cachePath, JSON.stringify([1, 2, 3]), 'utf-8');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith('[seed] Cache file corrupted, starting fresh');

        warnSpy.mockRestore();
    });

    it('should log warning and return empty object when JSON is null', () => {
        writeFileSync(cachePath, 'null', 'utf-8');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith('[seed] Cache file corrupted, starting fresh');

        warnSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// writeCache
// ---------------------------------------------------------------------------

describe('writeCache', () => {
    it('should create the cache file with correct JSON content', () => {
        writeCache(cachePath, SAMPLE_CACHE);

        expect(existsSync(cachePath)).toBe(true);

        const content: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
        expect(content).toEqual(SAMPLE_CACHE);
    });

    it('should overwrite an existing cache file with new content', () => {
        writeFileSync(cachePath, JSON.stringify({ old: 'data' }), 'utf-8');

        writeCache(cachePath, SAMPLE_CACHE);

        const content: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
        expect(content).toEqual(SAMPLE_CACHE);
    });

    it('should not leave a temp file behind after writing', () => {
        writeCache(cachePath, SAMPLE_CACHE);

        const tmpFiles = readdirSync(tmpDir).filter((f: string) => f.endsWith('.tmp'));

        expect(tmpFiles).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// deleteCache
// ---------------------------------------------------------------------------

describe('deleteCache', () => {
    it('should remove the cache file when it exists', () => {
        writeFileSync(cachePath, '{}', 'utf-8');
        expect(existsSync(cachePath)).toBe(true);

        deleteCache(cachePath);

        expect(existsSync(cachePath)).toBe(false);
    });

    it('should not throw when the file does not exist', () => {
        expect(() => deleteCache(cachePath)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// isCacheHit
// ---------------------------------------------------------------------------

describe('isCacheHit', () => {
    const entry: CacheEntry = {
        originalUrl: 'https://unsplash.com/photo/xyz',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/xyz',
        uploadedAt: '2024-06-01T12:00:00.000Z',
        fileModifiedAt: '2024-05-15T08:30:00.000Z'
    };

    it('should return true when currentUrl matches entry originalUrl', () => {
        const result = isCacheHit({
            cacheEntry: entry,
            currentUrl: 'https://unsplash.com/photo/xyz'
        });
        expect(result).toBe(true);
    });

    it('should return false when currentUrl does not match entry originalUrl', () => {
        const result = isCacheHit({
            cacheEntry: entry,
            currentUrl: 'https://unsplash.com/photo/different'
        });
        expect(result).toBe(false);
    });

    it('should return false when cacheEntry is undefined', () => {
        const result = isCacheHit({
            cacheEntry: undefined,
            currentUrl: 'https://unsplash.com/photo/xyz'
        });
        expect(result).toBe(false);
    });

    it('should return true when currentFileMtime matches entry fileModifiedAt', () => {
        const result = isCacheHit({
            cacheEntry: entry,
            currentFileMtime: '2024-05-15T08:30:00.000Z'
        });
        expect(result).toBe(true);
    });

    it('should return false when currentFileMtime does not match entry fileModifiedAt', () => {
        const result = isCacheHit({
            cacheEntry: entry,
            currentFileMtime: '2024-05-16T10:00:00.000Z'
        });
        expect(result).toBe(false);
    });

    it('should return false when no currentUrl or currentFileMtime is provided', () => {
        const result = isCacheHit({ cacheEntry: entry });
        expect(result).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// updateCacheEntry
// ---------------------------------------------------------------------------

describe('updateCacheEntry', () => {
    it('should add the entry to the cache object and persist it to disk', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
            cachePath,
            publicId: 'hospeda/accommodation/new-photo',
            originalUrl: 'https://pexels.com/photo/999',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/new-photo'
        });

        // In-memory cache updated
        expect(cache['hospeda/accommodation/new-photo']).toBeDefined();
        expect(cache['hospeda/accommodation/new-photo']?.originalUrl).toBe(
            'https://pexels.com/photo/999'
        );
        expect(cache['hospeda/accommodation/new-photo']?.cloudinaryUrl).toBe(
            'https://res.cloudinary.com/demo/image/upload/new-photo'
        );
        expect(cache['hospeda/accommodation/new-photo']?.fileModifiedAt).toBeNull();
        expect(cache['hospeda/accommodation/new-photo']?.uploadedAt).toBeTruthy();

        // Persisted to disk
        const persisted: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
        expect((persisted as ImageCache)['hospeda/accommodation/new-photo']).toBeDefined();
    });

    it('should store fileModifiedAt when provided', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
            cachePath,
            publicId: 'hospeda/local/file-photo',
            originalUrl: '/local/file.jpg',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/file-photo',
            fileModifiedAt: '2024-03-10T14:00:00.000Z'
        });

        expect(cache['hospeda/local/file-photo']?.fileModifiedAt).toBe('2024-03-10T14:00:00.000Z');
    });

    it('should overwrite an existing entry for the same publicId', () => {
        const cache: ImageCache = {
            'hospeda/test/abc': SAMPLE_ENTRY
        };

        updateCacheEntry({
            cache,
            cachePath,
            publicId: 'hospeda/test/abc',
            originalUrl: 'https://unsplash.com/photo/updated',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/updated'
        });

        expect(cache['hospeda/test/abc']?.originalUrl).toBe('https://unsplash.com/photo/updated');
    });
});
