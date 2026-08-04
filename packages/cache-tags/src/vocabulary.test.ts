import { describe, expect, it } from 'vitest';
import {
    buildEntityCacheTag,
    buildEntityCacheTags,
    CACHE_TAG_ALL,
    CACHE_TAG_COLLECTIONS,
    CACHE_TAG_ENTITY_PREFIXES,
    CACHE_TAG_HOME,
    CACHE_TAG_PRICING,
    CACHE_TAG_SITE_CONFIG,
    isValidCacheTag,
    MAX_CACHE_TAG_HEADER_BYTES,
    MAX_CACHE_TAG_LENGTH,
    MAX_CACHE_TAGS_PER_RESPONSE,
    normalizeCacheTagKey,
    serializeCacheTags
} from './vocabulary.js';

describe('isValidCacheTag', () => {
    it('accepts a plain slug tag', () => {
        expect(isValidCacheTag({ tag: 'accom-cabana-del-rio' })).toBe(true);
    });

    it('rejects an empty tag', () => {
        expect(isValidCacheTag({ tag: '' })).toBe(false);
    });

    it('rejects a tag containing a comma, because the comma separates the list', () => {
        expect(isValidCacheTag({ tag: 'accom-a,b' })).toBe(false);
    });

    it('rejects a tag containing a space', () => {
        expect(isValidCacheTag({ tag: 'accom-la casa' })).toBe(false);
    });

    it('rejects non-ASCII characters', () => {
        expect(isValidCacheTag({ tag: 'dest-concepción' })).toBe(false);
    });

    it('rejects a tag over the Cloudflare length limit', () => {
        expect(isValidCacheTag({ tag: 'a'.repeat(MAX_CACHE_TAG_LENGTH + 1) })).toBe(false);
        expect(isValidCacheTag({ tag: 'a'.repeat(MAX_CACHE_TAG_LENGTH) })).toBe(true);
    });
});

describe('normalizeCacheTagKey', () => {
    it('lowercases, so the emitter and the purger agree under case-insensitive matching', () => {
        expect(normalizeCacheTagKey({ key: 'Cabana-Del-Rio' })).toBe('cabana-del-rio');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeCacheTagKey({ key: '  hotel-plaza  ' })).toBe('hotel-plaza');
    });

    it('returns null for a key that is only whitespace', () => {
        expect(normalizeCacheTagKey({ key: '   ' })).toBeNull();
    });

    it('returns null for a key that cannot yield a valid tag', () => {
        expect(normalizeCacheTagKey({ key: 'a b' })).toBeNull();
    });
});

describe('buildEntityCacheTag', () => {
    it('prefixes the key with the entity prefix', () => {
        expect(buildEntityCacheTag({ entity: 'accommodation', key: 'cabana-del-rio' })).toBe(
            'accom-cabana-del-rio'
        );
        expect(buildEntityCacheTag({ entity: 'destination', key: 'colon' })).toBe('dest-colon');
        expect(buildEntityCacheTag({ entity: 'event', key: 'fiesta' })).toBe('event-fiesta');
        expect(buildEntityCacheTag({ entity: 'post', key: 'nota' })).toBe('post-nota');
    });

    it('returns null rather than a malformed tag Cloudflare would silently drop', () => {
        expect(buildEntityCacheTag({ entity: 'accommodation', key: '' })).toBeNull();
    });
});

describe('buildEntityCacheTags', () => {
    it('emits a tag for BOTH the slug and the id, because call sites carry different ones', () => {
        const tags = buildEntityCacheTags({
            entity: 'accommodation',
            slug: 'cabana-del-rio',
            id: '3f1a2b4c-0000-4000-8000-000000000001'
        });

        expect(tags).toEqual([
            'accom-cabana-del-rio',
            'accom-3f1a2b4c-0000-4000-8000-000000000001'
        ]);
    });

    it('emits just the slug tag when no id is known', () => {
        expect(buildEntityCacheTags({ entity: 'destination', slug: 'colon' })).toEqual([
            'dest-colon'
        ]);
    });

    it('emits just the id tag when the slug lookup failed', () => {
        expect(buildEntityCacheTags({ entity: 'accommodation', id: 'abc-123' })).toEqual([
            'accom-abc-123'
        ]);
    });

    it('returns nothing when neither identifier is usable', () => {
        expect(buildEntityCacheTags({ entity: 'post', slug: '', id: undefined })).toEqual([]);
    });

    it('deduplicates when slug and id happen to be the same string', () => {
        expect(buildEntityCacheTags({ entity: 'event', slug: 'x', id: 'x' })).toEqual(['event-x']);
    });
});

describe('vocabulary tables', () => {
    it('declares a collection tag for every entity that has an entity prefix', () => {
        expect(Object.keys(CACHE_TAG_COLLECTIONS).sort()).toEqual(
            Object.keys(CACHE_TAG_ENTITY_PREFIXES).sort()
        );
    });

    it('emits only valid tags for every collection', () => {
        for (const tag of Object.values(CACHE_TAG_COLLECTIONS)) {
            expect(isValidCacheTag({ tag })).toBe(true);
        }
    });
});

describe('serializeCacheTags', () => {
    it('joins tags with commas', () => {
        const result = serializeCacheTags({ tags: ['accom-a', 'list-accom'] });
        expect(result.header).toBe('accom-a,list-accom');
        expect(result.tagCount).toBe(2);
        expect(result.droppedCount).toBe(0);
    });

    it('lowercases so a mixed-case emitter still matches a lowercase purge', () => {
        expect(serializeCacheTags({ tags: ['Accom-A'] }).header).toBe('accom-a');
    });

    it('deduplicates', () => {
        const result = serializeCacheTags({ tags: ['home', 'home'] });
        expect(result.header).toBe('home');
        expect(result.droppedCount).toBe(1);
    });

    it('drops invalid tags and counts them instead of shipping them', () => {
        const result = serializeCacheTags({ tags: ['ok-tag', 'bad tag', 'with,comma'] });
        expect(result.header).toBe('ok-tag');
        expect(result.tagCount).toBe(1);
        expect(result.droppedCount).toBe(2);
    });

    it('returns a null header when nothing valid survives', () => {
        const result = serializeCacheTags({ tags: ['bad tag'] });
        expect(result.header).toBeNull();
        expect(result.tagCount).toBe(0);
    });

    it('caps at the Cloudflare per-response tag count, keeping the head of the list', () => {
        const tags = Array.from({ length: MAX_CACHE_TAGS_PER_RESPONSE + 5 }, (_, i) => `t-${i}`);
        const result = serializeCacheTags({ tags });

        expect(result.tagCount).toBe(MAX_CACHE_TAGS_PER_RESPONSE);
        expect(result.droppedCount).toBe(5);
        expect(result.header?.startsWith('t-0,t-1,')).toBe(true);
    });

    it('caps at the 16 KB aggregate header budget', () => {
        // Each tag is 100 chars + 1 separator, so ~162 fit in 16 KB.
        const tags = Array.from(
            { length: 400 },
            (_, i) => `${String(i).padStart(4, '0')}${'x'.repeat(96)}`
        );
        const result = serializeCacheTags({ tags });

        expect(result.header).not.toBeNull();
        expect((result.header as string).length).toBeLessThanOrEqual(MAX_CACHE_TAG_HEADER_BYTES);
        expect(result.droppedCount).toBeGreaterThan(0);
        expect(result.tagCount + result.droppedCount).toBe(400);
    });
});

describe('CACHE_TAG_ALL', () => {
    it('is a bare vocabulary word, so it is namespaced by the same path as any other tag', () => {
        // A pre-namespaced constant would be a SECOND way of spelling a tag,
        // and two spellings is how the emitter and the purger drift apart.
        expect(CACHE_TAG_ALL).toBe('all');
        expect(CACHE_TAG_ALL).not.toContain(':');
        expect(isValidCacheTag({ tag: CACHE_TAG_ALL })).toBe(true);
    });

    it('cannot collide with any other tag the vocabulary can produce', () => {
        // Entity tags always carry a `<prefix>-` and collection tags are
        // `list-*`; the remaining constants are asserted explicitly.
        const entityTags = Object.values(CACHE_TAG_ENTITY_PREFIXES).map(
            (prefix) => `${prefix}-${CACHE_TAG_ALL}`
        );
        const others = [
            ...Object.values(CACHE_TAG_COLLECTIONS),
            ...entityTags,
            CACHE_TAG_HOME,
            CACHE_TAG_PRICING,
            CACHE_TAG_SITE_CONFIG
        ];

        expect(others).not.toContain(CACHE_TAG_ALL);
    });

    it('costs under 16 bytes on the wire, prefix and separator included', () => {
        // The budget argument for putting it on EVERY response: worst case is
        // the longest environment name plus its colon plus a comma.
        const worstCase = `preview:${CACHE_TAG_ALL},`;
        expect(worstCase.length).toBeLessThan(16);
    });
});

describe('serializeCacheTags truncation ordering (why the catch-all leads)', () => {
    it('keeps a leading catch-all and drops the tail when over the count limit', () => {
        // The property the emitter relies on. `<env>:all` is the only tag whose
        // loss would remove a response's last-resort purge path: every other
        // tag's loss is still covered BY it, so it goes first and the specific
        // tags are what truncation eats.
        const tags = [
            `test:${CACHE_TAG_ALL}`,
            ...Array.from({ length: MAX_CACHE_TAGS_PER_RESPONSE + 10 }, (_, i) => `test:t-${i}`)
        ];

        const result = serializeCacheTags({ tags });

        expect(result.tagCount).toBe(MAX_CACHE_TAGS_PER_RESPONSE);
        expect(result.droppedCount).toBe(11);
        expect((result.header as string).split(',')[0]).toBe(`test:${CACHE_TAG_ALL}`);
        expect(result.header).toContain(`test:${CACHE_TAG_ALL}`);
    });

    it('would DROP the catch-all if it were placed last — the case the ordering avoids', () => {
        // The counterfactual, asserted rather than argued: with the catch-all at
        // the tail of an over-long list, the environment flush could no longer
        // reach this response at all.
        const tags = [
            ...Array.from({ length: MAX_CACHE_TAGS_PER_RESPONSE + 10 }, (_, i) => `test:t-${i}`),
            `test:${CACHE_TAG_ALL}`
        ];

        const result = serializeCacheTags({ tags });

        expect(result.header).not.toContain(`test:${CACHE_TAG_ALL}`);
    });

    it('keeps a leading catch-all when the 16 KB byte budget is what binds', () => {
        // The other truncation trigger. Same conclusion, different limit.
        const tags = [
            `test:${CACHE_TAG_ALL}`,
            ...Array.from(
                { length: 400 },
                (_, i) => `test:${String(i).padStart(4, '0')}${'x'.repeat(96)}`
            )
        ];

        const result = serializeCacheTags({ tags });

        expect(result.droppedCount).toBeGreaterThan(0);
        expect((result.header as string).split(',')[0]).toBe(`test:${CACHE_TAG_ALL}`);
    });
});
