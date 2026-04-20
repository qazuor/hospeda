import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CLOUDINARY_CACHE_VERSION,
    deleteCache,
    flushCache,
    isCacheHit,
    readCache,
    updateCacheEntry,
    validateCacheEntries,
    writeCache
} from '../../src/utils/cloudinary-cache.js';
import type { CacheEntry, ImageCache } from '../../src/utils/cloudinary-cache.js';
import { logger } from '../../src/utils/logger.js';

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

/** Writes a versioned envelope matching the current schema to `path`. */
function writeEnvelope(path: string, cache: ImageCache): void {
    writeFileSync(
        path,
        JSON.stringify({ version: CLOUDINARY_CACHE_VERSION, entries: cache }),
        'utf-8'
    );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;
let cachePath: string;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'seed-cache-test-'));
    cachePath = join(tmpDir, '.cloudinary-cache.json');
});

// ---------------------------------------------------------------------------
// readCache (+ Zod validation — GAP-078-120)
// ---------------------------------------------------------------------------

describe('readCache', () => {
    it('should return empty object when cache file does not exist', () => {
        const result = readCache(cachePath);
        expect(result).toEqual({});
    });

    it('should return parsed cache when file contains valid JSON + valid envelope', () => {
        writeEnvelope(cachePath, SAMPLE_CACHE);
        const result = readCache(cachePath);
        expect(result).toEqual(SAMPLE_CACHE);
    });

    it('should log warning, delete corrupt file, and return empty object when JSON is invalid', () => {
        writeFileSync(cachePath, 'not valid json!!!', 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalledWith('[seed] Cache file corrupted, starting fresh');
        expect(existsSync(cachePath)).toBe(false);

        warnSpy.mockRestore();
    });

    it('should reject an array at the top level and return empty object (GAP-078-120)', () => {
        writeFileSync(cachePath, JSON.stringify([1, 2, 3]), 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy.mock.calls[0]?.[0]).toMatch(/schema validation/);

        warnSpy.mockRestore();
    });

    it('should reject null top-level and return empty object', () => {
        writeFileSync(cachePath, 'null', 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('should reject a file missing the `version` field', () => {
        writeFileSync(cachePath, JSON.stringify({ entries: SAMPLE_CACHE }), 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy.mock.calls[0]?.[0]).toMatch(/schema validation/);

        warnSpy.mockRestore();
    });

    it('should reject a file with an unsupported version literal', () => {
        writeFileSync(cachePath, JSON.stringify({ version: 999, entries: SAMPLE_CACHE }), 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy.mock.calls[0]?.[0]).toMatch(/schema validation/);

        warnSpy.mockRestore();
    });

    it('should reject when an entry has a malformed shape', () => {
        const bad = {
            version: CLOUDINARY_CACHE_VERSION,
            entries: {
                'hospeda/test/abc': {
                    originalUrl: '',
                    cloudinaryUrl: 'https://res.cloudinary.com/demo/abc',
                    uploadedAt: '2024-01-01T00:00:00.000Z',
                    fileModifiedAt: null
                }
            }
        };
        writeFileSync(cachePath, JSON.stringify(bad), 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy.mock.calls[0]?.[0]).toMatch(/schema validation/);

        warnSpy.mockRestore();
    });

    it('should reject legacy unversioned map files (forces migration path)', () => {
        // Pre-GAP-078-120 files were a bare map keyed by publicId. They now
        // fail Zod validation and are discarded with a warning.
        writeFileSync(cachePath, JSON.stringify(SAMPLE_CACHE), 'utf-8');
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = readCache(cachePath);

        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});

// ---------------------------------------------------------------------------
// writeCache / flushCache
// ---------------------------------------------------------------------------

describe('writeCache', () => {
    it('should create the cache file with versioned envelope', () => {
        writeCache(cachePath, SAMPLE_CACHE);

        expect(existsSync(cachePath)).toBe(true);

        const content: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
        expect(content).toEqual({
            version: CLOUDINARY_CACHE_VERSION,
            entries: SAMPLE_CACHE
        });
    });

    it('should overwrite an existing cache file with new content', () => {
        writeFileSync(cachePath, JSON.stringify({ old: 'data' }), 'utf-8');

        writeCache(cachePath, SAMPLE_CACHE);

        const content = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
            version: number;
            entries: ImageCache;
        };
        expect(content.entries).toEqual(SAMPLE_CACHE);
    });

    it('should not leave a temp file behind after writing', () => {
        writeCache(cachePath, SAMPLE_CACHE);

        const tmpFiles = readdirSync(tmpDir).filter((f: string) => f.endsWith('.tmp'));

        expect(tmpFiles).toHaveLength(0);
    });
});

describe('flushCache', () => {
    it('should persist the in-memory cache using the current envelope format', () => {
        flushCache(cachePath, SAMPLE_CACHE);

        const content = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
            version: number;
            entries: ImageCache;
        };
        expect(content.version).toBe(CLOUDINARY_CACHE_VERSION);
        expect(content.entries).toEqual(SAMPLE_CACHE);
    });

    it('should write exactly one file (single flush semantics)', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
            publicId: 'hospeda/one',
            originalUrl: 'https://unsplash.com/one',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/one'
        });
        updateCacheEntry({
            cache,
            publicId: 'hospeda/two',
            originalUrl: 'https://unsplash.com/two',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/two'
        });

        // No writes happened yet — only flushCache persists.
        expect(existsSync(cachePath)).toBe(false);

        flushCache(cachePath, cache);

        expect(existsSync(cachePath)).toBe(true);
        const content = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
            entries: ImageCache;
        };
        expect(Object.keys(content.entries)).toHaveLength(2);
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
// updateCacheEntry — GAP-078-033 (deferred flush)
// ---------------------------------------------------------------------------

describe('updateCacheEntry', () => {
    it('should add the entry to the in-memory cache object', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
            publicId: 'hospeda/accommodation/new-photo',
            originalUrl: 'https://pexels.com/photo/999',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/new-photo'
        });

        expect(cache['hospeda/accommodation/new-photo']).toBeDefined();
        expect(cache['hospeda/accommodation/new-photo']?.originalUrl).toBe(
            'https://pexels.com/photo/999'
        );
        expect(cache['hospeda/accommodation/new-photo']?.cloudinaryUrl).toBe(
            'https://res.cloudinary.com/demo/image/upload/new-photo'
        );
        expect(cache['hospeda/accommodation/new-photo']?.fileModifiedAt).toBeNull();
        expect(cache['hospeda/accommodation/new-photo']?.uploadedAt).toBeTruthy();
    });

    it('should NOT write to disk on update (GAP-078-033 — deferred flush)', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
            cachePath, // legacy field — ignored
            publicId: 'hospeda/test/xyz',
            originalUrl: 'https://pexels.com/photo/zzz',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/xyz'
        });

        // The old behavior persisted every update; new behavior defers.
        expect(existsSync(cachePath)).toBe(false);
    });

    it('should store fileModifiedAt when provided', () => {
        const cache: ImageCache = {};

        updateCacheEntry({
            cache,
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
            publicId: 'hospeda/test/abc',
            originalUrl: 'https://unsplash.com/photo/updated',
            cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/updated'
        });

        expect(cache['hospeda/test/abc']?.originalUrl).toBe('https://unsplash.com/photo/updated');
    });
});

// ---------------------------------------------------------------------------
// validateCacheEntries — GAP-078-079
// ---------------------------------------------------------------------------

describe('validateCacheEntries', () => {
    const entryGood: CacheEntry = {
        originalUrl: 'https://unsplash.com/good',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/good',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        fileModifiedAt: null
    };
    const entryStale: CacheEntry = {
        originalUrl: 'https://unsplash.com/stale',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/stale',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        fileModifiedAt: null
    };
    const entryNetErr: CacheEntry = {
        originalUrl: 'https://unsplash.com/err',
        cloudinaryUrl: 'https://res.cloudinary.com/demo/err',
        uploadedAt: '2024-01-01T00:00:00.000Z',
        fileModifiedAt: null
    };

    it('keeps entries that respond 200, drops non-200 and network errors', async () => {
        const cache: ImageCache = {
            good: entryGood,
            stale: entryStale,
            err: entryNetErr
        };

        const fetchMock = vi.fn(async (url: RequestInfo | URL): Promise<Response> => {
            const href = typeof url === 'string' ? url : url.toString();
            if (href.endsWith('/good')) return { ok: true, status: 200 } as Response;
            if (href.endsWith('/stale')) return { ok: false, status: 404 } as Response;
            throw new Error('network down');
        }) as unknown as typeof fetch;

        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = await validateCacheEntries({ cache, fetchImpl: fetchMock });

        expect(result).toEqual({ checked: 3, removed: 2, kept: 1 });
        expect(Object.keys(cache)).toEqual(['good']);
        expect(warnSpy).toHaveBeenCalledTimes(2);

        warnSpy.mockRestore();
    });

    it('treats a fetch abort/timeout as stale', async () => {
        const cache: ImageCache = { slow: entryStale };
        const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
            return await new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new Error('aborted'));
                });
            });
        }) as unknown as typeof fetch;

        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

        const result = await validateCacheEntries({
            cache,
            fetchImpl: fetchMock,
            timeoutMs: 10
        });

        expect(result).toEqual({ checked: 1, removed: 1, kept: 0 });
        expect(cache.slow).toBeUndefined();

        warnSpy.mockRestore();
    });

    it('issues a HEAD request (not GET)', async () => {
        const cache: ImageCache = { good: entryGood };
        const fetchMock = vi.fn(
            async () => ({ ok: true, status: 200 }) as Response
        ) as unknown as typeof fetch;

        await validateCacheEntries({ cache, fetchImpl: fetchMock });

        const mockedFn = fetchMock as unknown as ReturnType<typeof vi.fn>;
        expect(mockedFn).toHaveBeenCalledTimes(1);
        const initArg = mockedFn.mock.calls[0]?.[1] as RequestInit | undefined;
        expect(initArg?.method).toBe('HEAD');
    });

    it('returns zero counts for an empty cache without any fetch calls', async () => {
        const cache: ImageCache = {};
        const fetchMock = vi.fn() as unknown as typeof fetch;

        const result = await validateCacheEntries({ cache, fetchImpl: fetchMock });

        expect(result).toEqual({ checked: 0, removed: 0, kept: 0 });
        expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    });
});
