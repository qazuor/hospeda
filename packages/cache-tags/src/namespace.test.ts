import { describe, expect, it } from 'vitest';
import {
    buildCacheTagNamespace,
    CACHE_TAG_ENVIRONMENTS,
    CACHE_TAG_NAMESPACE_SEPARATOR,
    isCacheTagEnvironment,
    namespaceCacheTag,
    namespaceCacheTags,
    parseNamespacedCacheTag,
    resolveCacheTagEnvironment
} from './namespace.js';
import {
    buildEntityCacheTags,
    CACHE_TAG_COLLECTIONS,
    CACHE_TAG_HOME,
    CACHE_TAG_PRICING,
    CACHE_TAG_SITE_CONFIG,
    isValidCacheTag,
    MAX_CACHE_TAG_HEADER_BYTES,
    MAX_CACHE_TAG_LENGTH,
    serializeCacheTags
} from './vocabulary.js';

describe('isCacheTagEnvironment', () => {
    it('accepts every value of the closed vocabulary', () => {
        for (const environment of CACHE_TAG_ENVIRONMENTS) {
            expect(isCacheTagEnvironment({ value: environment })).toBe(true);
        }
    });

    it('rejects spellings that are not the shared vocabulary', () => {
        expect(isCacheTagEnvironment({ value: 'staging' })).toBe(false);
        expect(isCacheTagEnvironment({ value: 'stg' })).toBe(false);
        expect(isCacheTagEnvironment({ value: 'production' })).toBe(false);
        expect(isCacheTagEnvironment({ value: 'PROD' })).toBe(false);
    });

    it('rejects absent values', () => {
        expect(isCacheTagEnvironment({ value: undefined })).toBe(false);
        expect(isCacheTagEnvironment({ value: null })).toBe(false);
        expect(isCacheTagEnvironment({ value: '' })).toBe(false);
    });
});

describe('buildCacheTagNamespace', () => {
    it('appends the separator to the environment', () => {
        expect(buildCacheTagNamespace({ environment: 'prod' })).toBe('prod:');
        expect(buildCacheTagNamespace({ environment: 'preview' })).toBe('preview:');
    });

    it('uses a separator Cloudflare accepts inside a tag', () => {
        expect(isValidCacheTag({ tag: `x${CACHE_TAG_NAMESPACE_SEPARATOR}y` })).toBe(true);
    });
});

describe('namespaceCacheTag', () => {
    it('prefixes a bare vocabulary tag', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: 'list-accom' })).toBe(
            'prod:list-accom'
        );
        expect(namespaceCacheTag({ environment: 'preview', tag: 'home' })).toBe('preview:home');
    });

    it('namespaces production symmetrically — prod is not the bare form', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: CACHE_TAG_HOME })).toBe('prod:home');
        expect(namespaceCacheTag({ environment: 'prod', tag: CACHE_TAG_PRICING })).toBe(
            'prod:pricing'
        );
    });

    it('lowercases so the emitter and the purger produce byte-identical strings', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: 'Accom-Cabana' })).toBe(
            'prod:accom-cabana'
        );
    });

    it('trims surrounding whitespace', () => {
        expect(namespaceCacheTag({ environment: 'dev', tag: '  home  ' })).toBe('dev:home');
    });

    it('is idempotent for the SAME environment, so double-namespacing cannot happen', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: 'prod:home' })).toBe('prod:home');
    });

    it('refuses a tag already namespaced by a DIFFERENT environment', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: 'preview:home' })).toBeNull();
        expect(namespaceCacheTag({ environment: 'preview', tag: 'prod:list-accom' })).toBeNull();
    });

    it('returns null for an empty or whitespace-only tag', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: '' })).toBeNull();
        expect(namespaceCacheTag({ environment: 'prod', tag: '   ' })).toBeNull();
    });

    it('returns null for a tag Cloudflare would reject anyway', () => {
        expect(namespaceCacheTag({ environment: 'prod', tag: 'has space' })).toBeNull();
        expect(namespaceCacheTag({ environment: 'prod', tag: 'has,comma' })).toBeNull();
        expect(namespaceCacheTag({ environment: 'prod', tag: 'concepción' })).toBeNull();
    });

    it('returns null when the prefix pushes the tag over the per-tag length ceiling', () => {
        const atCeiling = 'a'.repeat(MAX_CACHE_TAG_LENGTH);
        expect(isValidCacheTag({ tag: atCeiling })).toBe(true);
        expect(namespaceCacheTag({ environment: 'prod', tag: atCeiling })).toBeNull();

        const withRoom = 'a'.repeat(MAX_CACHE_TAG_LENGTH - 'prod:'.length);
        expect(namespaceCacheTag({ environment: 'prod', tag: withRoom })).toBe(`prod:${withRoom}`);
    });

    it('produces a tag that still passes the Cloudflare validity rule', () => {
        for (const environment of CACHE_TAG_ENVIRONMENTS) {
            for (const tag of [
                ...Object.values(CACHE_TAG_COLLECTIONS),
                CACHE_TAG_HOME,
                CACHE_TAG_PRICING,
                CACHE_TAG_SITE_CONFIG,
                ...buildEntityCacheTags({
                    entity: 'accommodation',
                    slug: 'cabana-del-rio',
                    id: '3f1a2b4c-0000-4000-8000-000000000001'
                })
            ]) {
                const namespaced = namespaceCacheTag({ environment, tag });
                expect(namespaced).not.toBeNull();
                expect(isValidCacheTag({ tag: namespaced as string })).toBe(true);
            }
        }
    });
});

describe('namespaceCacheTags', () => {
    it('preserves input order, because serializeCacheTags truncates from the tail', () => {
        expect(
            namespaceCacheTags({
                environment: 'prod',
                tags: ['accom-x', 'list-accom', 'home']
            })
        ).toEqual(['prod:accom-x', 'prod:list-accom', 'prod:home']);
    });

    it('deduplicates tags that collapse onto the same namespaced string', () => {
        expect(
            namespaceCacheTags({ environment: 'prod', tags: ['home', 'HOME', 'prod:home'] })
        ).toEqual(['prod:home']);
    });

    it('drops unusable tags instead of emitting malformed ones', () => {
        expect(
            namespaceCacheTags({
                environment: 'prod',
                tags: ['home', 'bad tag', '', 'preview:home', 'list-accom']
            })
        ).toEqual(['prod:home', 'prod:list-accom']);
    });

    it('returns an empty list when nothing survives', () => {
        expect(namespaceCacheTags({ environment: 'prod', tags: ['bad tag', ''] })).toEqual([]);
    });
});

describe('parseNamespacedCacheTag', () => {
    it('splits a namespaced tag at the first colon', () => {
        expect(parseNamespacedCacheTag({ tag: 'prod:accom-cabana-del-rio' })).toEqual({
            environment: 'prod',
            tag: 'accom-cabana-del-rio'
        });
    });

    it('round-trips everything namespaceCacheTag produces', () => {
        for (const environment of CACHE_TAG_ENVIRONMENTS) {
            const namespaced = namespaceCacheTag({ environment, tag: 'list-accom' }) as string;
            expect(parseNamespacedCacheTag({ tag: namespaced })).toEqual({
                environment,
                tag: 'list-accom'
            });
        }
    });

    it('returns null for a bare, un-namespaced tag', () => {
        expect(parseNamespacedCacheTag({ tag: 'list-accom' })).toBeNull();
    });

    it('returns null when the prefix is not a known environment', () => {
        expect(parseNamespacedCacheTag({ tag: 'staging:home' })).toBeNull();
        expect(parseNamespacedCacheTag({ tag: 'PROD:home' })).toBeNull();
    });

    it('returns null for a leading or trailing separator', () => {
        expect(parseNamespacedCacheTag({ tag: ':home' })).toBeNull();
        expect(parseNamespacedCacheTag({ tag: 'prod:' })).toBeNull();
    });

    it('keeps a second colon inside the tag body rather than treating it as a boundary', () => {
        expect(parseNamespacedCacheTag({ tag: 'prod:prod:home' })).toEqual({
            environment: 'prod',
            tag: 'prod:home'
        });
    });
});

describe('resolveCacheTagEnvironment', () => {
    it('honours an explicit HOSPEDA_DEPLOY_ENV from the closed vocabulary', () => {
        for (const environment of CACHE_TAG_ENVIRONMENTS) {
            expect(
                resolveCacheTagEnvironment({ deployEnv: environment, nodeEnv: 'production' })
            ).toBe(environment);
        }
    });

    it('trims a padded value rather than failing on whitespace', () => {
        expect(
            resolveCacheTagEnvironment({ deployEnv: '  preview  ', nodeEnv: 'production' })
        ).toBe('preview');
    });

    it('lets HOSPEDA_DEPLOY_ENV win over NODE_ENV', () => {
        expect(resolveCacheTagEnvironment({ deployEnv: 'preview', nodeEnv: 'production' })).toBe(
            'preview'
        );
        expect(resolveCacheTagEnvironment({ deployEnv: 'prod', nodeEnv: 'development' })).toBe(
            'prod'
        );
    });

    it('infers the unambiguously local environments when the variable is unset', () => {
        expect(resolveCacheTagEnvironment({ deployEnv: undefined, nodeEnv: 'test' })).toBe('test');
        expect(resolveCacheTagEnvironment({ deployEnv: undefined, nodeEnv: 'development' })).toBe(
            'dev'
        );
        expect(resolveCacheTagEnvironment({ deployEnv: undefined, nodeEnv: undefined })).toBe(
            'dev'
        );
        expect(resolveCacheTagEnvironment({ deployEnv: '   ', nodeEnv: '' })).toBe('dev');
    });

    it('THROWS for NODE_ENV=production with no HOSPEDA_DEPLOY_ENV — the measured staging-web case', () => {
        expect(() =>
            resolveCacheTagEnvironment({ deployEnv: undefined, nodeEnv: 'production' })
        ).toThrow(/HOSPEDA_DEPLOY_ENV is not set/);
    });

    it('THROWS for a value outside the vocabulary rather than silently ignoring it', () => {
        expect(() =>
            resolveCacheTagEnvironment({ deployEnv: 'staging', nodeEnv: 'production' })
        ).toThrow(/not one of/);
        expect(() =>
            resolveCacheTagEnvironment({ deployEnv: 'stg', nodeEnv: 'production' })
        ).toThrow(/not one of/);
    });
});

describe('namespacing composed with serializeCacheTags', () => {
    it('survives the serializer unchanged — no re-lowercasing, no re-dedup surprises', () => {
        const namespaced = namespaceCacheTags({
            environment: 'preview',
            tags: ['accom-x', 'list-accom', 'home']
        });

        const result = serializeCacheTags({ tags: namespaced });

        expect(result.header).toBe('preview:accom-x,preview:list-accom,preview:home');
        expect(result.tagCount).toBe(3);
        expect(result.droppedCount).toBe(0);
    });

    it('lets the serializer dedup tags that only collide after namespacing', () => {
        const result = serializeCacheTags({
            tags: namespaceCacheTags({ environment: 'prod', tags: ['home', 'Home'] })
        });

        expect(result.header).toBe('prod:home');
        expect(result.tagCount).toBe(1);
    });

    it('charges the prefix against the 16 KB budget, so fewer tags fit than unprefixed', () => {
        const bare = Array.from(
            { length: 400 },
            (_, i) => `${String(i).padStart(4, '0')}${'x'.repeat(96)}`
        );

        const bareCount = serializeCacheTags({ tags: bare }).tagCount;
        const namespacedCount = serializeCacheTags({
            tags: namespaceCacheTags({ environment: 'preview', tags: bare })
        }).tagCount;

        expect(namespacedCount).toBeLessThan(bareCount);
    });

    it('never emits a header over the budget once tags are namespaced', () => {
        const bare = Array.from(
            { length: 400 },
            (_, i) => `${String(i).padStart(4, '0')}${'x'.repeat(96)}`
        );

        const result = serializeCacheTags({
            tags: namespaceCacheTags({ environment: 'preview', tags: bare })
        });

        expect(result.header).not.toBeNull();
        expect((result.header as string).length).toBeLessThanOrEqual(MAX_CACHE_TAG_HEADER_BYTES);
        expect(result.tagCount + result.droppedCount).toBe(400);
    });
});
