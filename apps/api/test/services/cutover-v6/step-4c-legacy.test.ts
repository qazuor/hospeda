import type { DrizzleClient } from '@repo/db';
import { getAffectedCacheTags } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import {
    createPrefixPurgeTransport,
    createRevalidationPagePurger
} from '../../../src/services/cutover-v6/step-4c.adapters.js';
import {
    mergeUnique,
    parseListFile,
    parseStep4cArgs
} from '../../../src/services/cutover-v6/step-4c.args.js';
import {
    buildLegacyEntityTags,
    buildLegacyPrefixes,
    LEGACY_COLLECTION_TAGS,
    LEGACY_ENTITY_TAG_PREFIX
} from '../../../src/services/cutover-v6/step-4c.legacy.js';
import type { PagePurger } from '../../../src/services/cutover-v6/step-4c.service.js';
import { runStep4c } from '../../../src/services/cutover-v6/step-4c.service.js';

// The suite-wide mock of `@repo/db` has no `sql` helper; the service only needs
// a tagged template and `raw`, and the fake `execute` below ignores the query.
vi.mock('@repo/db', () => {
    const sql = Object.assign(() => ({}), { raw: () => ({}) });
    return { sql };
});

describe('step 4c legacy vocabulary is pinned', () => {
    it('names exactly the retired collection tag and entity prefix', () => {
        // Assert
        expect(LEGACY_COLLECTION_TAGS).toEqual(['list-gastro']);
        expect(LEGACY_ENTITY_TAG_PREFIX).toBe('gastro');
    });

    it('is disjoint from the live vocabulary (otherwise it would purge live tags)', () => {
        // Arrange
        const live = (['accommodation', 'venue', 'experience'] as const).flatMap((entityType) =>
            getAffectedCacheTags({ entityType, id: 'x', slug: 'y' })
        );
        // Assert
        expect(live).toContain('list-venue');
        for (const tag of LEGACY_COLLECTION_TAGS) expect(live).not.toContain(tag);
        expect(live.some((tag) => tag.startsWith(`${LEGACY_ENTITY_TAG_PREFIX}-`))).toBe(false);
    });

    it('builds the 54 prefixes, 27 per host, with no scheme', () => {
        // Act
        const prefixes = buildLegacyPrefixes();
        // Assert
        expect(prefixes).toHaveLength(54);
        expect(new Set(prefixes).size).toBe(54);
        expect(prefixes).toContain('hospeda.com.ar/es/comer-y-salir/');
        expect(prefixes).toContain('www.hospeda.com.ar/pt/publicar-restaurante/');
        expect(prefixes).toContain('www.hospeda.com.ar/en/planes/gastronomia/');
        expect(
            prefixes.some((prefix) => prefix.includes('://') || prefix.includes('staging'))
        ).toBe(false);
    });

    it('builds gastro-<slug> and gastro-<id> tags, skipping a missing slug', () => {
        // Act
        const tags = buildLegacyEntityTags({
            listings: [{ id: 'id-1', slug: 'bar-uno' }, { id: 'id-2', slug: null }, { id: 'id-3' }]
        });
        // Assert
        expect(tags).toEqual(['gastro-bar-uno', 'gastro-id-1', 'gastro-id-2', 'gastro-id-3']);
    });
});

describe('step 4c arguments', () => {
    it('accepts the two optional file flags in both spellings', () => {
        // Act
        const result = parseStep4cArgs({
            argv: ['--confirm-purge', '--extra-tags-file', 't.txt', '--extra-prefixes-file=p.txt']
        });
        // Assert
        expect(result).toEqual({
            ok: true,
            value: {
                dryRun: false,
                confirmPurge: true,
                extraTagsFile: 't.txt',
                extraPrefixesFile: 'p.txt'
            }
        });
    });

    it('keeps the flags optional', () => {
        expect(parseStep4cArgs({ argv: ['--dry-run'] })).toEqual({
            ok: true,
            value: { dryRun: true, confirmPurge: false }
        });
    });

    it.each([
        [['--bogus']],
        [['--extra-tags-file']],
        [['--extra-tags-file', '--dry-run']]
    ])('rejects %j', (argv) => {
        expect(parseStep4cArgs({ argv }).ok).toBe(false);
    });

    it('reads one value per line, ignoring blanks and # comments', () => {
        // Act
        const values = parseListFile({ content: '# header\n\n  list-a  \r\nlist-b\n   \n#skip\n' });
        // Assert
        expect(values).toEqual(['list-a', 'list-b']);
    });

    it('de-duplicates across lists keeping first-seen order', () => {
        expect(
            mergeUnique({
                lists: [
                    ['a', 'b'],
                    ['b', 'c', 'a']
                ]
            })
        ).toEqual(['a', 'b', 'c']);
    });
});

describe('prefix purge transport (429 handling)', () => {
    const transport = (response: Response | Error) =>
        createPrefixPurgeTransport({
            siteUrl: 'https://hospeda.com.ar/',
            secret: 's e',
            fetchImpl: vi.fn(async () => {
                if (response instanceof Error) throw response;
                return response;
            }) as unknown as typeof fetch
        });

    it('succeeds only on a 2xx whose body confirms ok:true', async () => {
        const ok = await transport(new Response('{"ok":true,"purged":1}'))({ prefixes: ['a/b/'] });
        expect(ok).toEqual({ ok: true, status: 200 });
        const unconfirmed = await transport(new Response('{"ok":false}'))({ prefixes: ['a/b/'] });
        expect(unconfirmed.ok).toBe(false);
    });

    it('treats a 429 as a purge that did not happen', async () => {
        const result = await transport(new Response('slow down', { status: 429 }))({
            prefixes: ['a/b/']
        });
        expect(result).toEqual({ ok: false, status: 429 });
    });

    it('treats a network error as a failure, not an exception', async () => {
        const result = await transport(new Error('boom'))({ prefixes: ['a/b/'] });
        expect(result).toEqual({ ok: false, status: 0 });
    });

    it('posts to the slashed endpoint with the encoded secret', async () => {
        const fetchImpl = vi.fn(async () => new Response('{"ok":true}'));
        await createPrefixPurgeTransport({
            siteUrl: 'https://hospeda.com.ar/',
            secret: 's e',
            fetchImpl: fetchImpl as unknown as typeof fetch
        })({ prefixes: ['a/b/'] });
        expect(fetchImpl.mock.calls[0]?.[0]).toBe(
            'https://hospeda.com.ar/api/revalidate/?secret=s%20e'
        );
    });
});

describe('page purger prefix grouping', () => {
    it('chunks prefixes at 100 and fails the whole run when any chunk is rejected', async () => {
        // Arrange
        const prefixes = Array.from({ length: 150 }, (_, i) => `h/${i}/`);
        const statuses = [200, 429];
        const prefixTransport = vi.fn(async () => {
            const status = statuses.shift() ?? 200;
            return { ok: status === 200, status };
        });
        const service = { getAdapterName: () => 'Fake' } as never;
        const purger = createRevalidationPagePurger({ service, prefixTransport });
        // Act
        const result = await purger.purgePrefixes({ group: 'legacy-prefixes', prefixes });
        // Assert
        expect(prefixTransport).toHaveBeenCalledTimes(2);
        expect(result.ok).toBe(false);
        expect(result.failed).toEqual(prefixes.slice(100));
    });
});

describe('runStep4c legacy groups', () => {
    /** `execute` answers in the order the service issues its four queries. */
    function fakeDb(): DrizzleClient {
        return {
            execute: vi
                .fn()
                .mockResolvedValueOnce({ rows: [{ table_name: 'cutover_v6_deleted_listing' }] })
                .mockResolvedValueOnce({
                    rows: [
                        { entityType: 'venue', entityId: '14820000-0000-4000-8000-000000000002' }
                    ]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ id: 'live-id', slug: 'live-slug' }] })
        } as unknown as DrizzleClient;
    }

    function recordingPurger({ failGroup }: { readonly failGroup?: string } = {}) {
        const calls: { group: string; items: readonly string[] }[] = [];
        const purger: PagePurger = {
            async purge({ group, tags }) {
                calls.push({ group, items: tags });
                return group === failGroup
                    ? { ok: false, failed: tags.slice(0, 1) }
                    : { ok: true, failed: [] };
            },
            async purgePrefixes({ group, prefixes }) {
                calls.push({ group, items: prefixes });
                return group === failGroup
                    ? { ok: false, failed: prefixes.slice(0, 1) }
                    : { ok: true, failed: [] };
            }
        };
        return { purger, calls };
    }

    it('purges legacy tags and the 54 prefixes, merging and de-duplicating the extras', async () => {
        // Arrange
        const { purger, calls } = recordingPurger();
        // Act
        const result = await runStep4c({
            db: fakeDb(),
            pagePurger: purger,
            dryRun: false,
            extraTags: ['gastro-extra', 'list-gastro', 'gastro-live-slug'],
            extraPrefixes: ['hospeda.com.ar/es/gastronomia/', 'hospeda.com.ar/es/otra/']
        });
        // Assert
        const legacyTags = calls.find(({ group }) => group === 'legacy-tags')?.items ?? [];
        expect(legacyTags).toEqual([
            'gastro-14820000-0000-4000-8000-000000000002',
            'gastro-extra',
            'gastro-live-id',
            'gastro-live-slug',
            'list-gastro'
        ]);
        expect(calls.find(({ group }) => group === 'legacy-prefixes')?.items).toHaveLength(55);
        expect(result.status).toBe('completed');
    });

    it('fails and stops at the first rejected group (a 429 must not be skipped over)', async () => {
        // Arrange
        const { purger, calls } = recordingPurger({ failGroup: 'legacy-tags' });
        // Act
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: false });
        // Assert
        expect(result.status).toBe('failed');
        expect(result.haltedAfter).toBe('legacy-tags');
        expect(calls.map(({ group }) => group)).not.toContain('legacy-prefixes');
    });

    it('fails when only the prefix purge is rejected', async () => {
        const { purger } = recordingPurger({ failGroup: 'legacy-prefixes' });
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: false });
        expect(result.status).toBe('failed');
        expect(result.groups.at(-1)).toMatchObject({ name: 'legacy-prefixes', ok: false });
    });

    it('calls nothing on a dry run but still counts the legacy groups', async () => {
        const { purger, calls } = recordingPurger();
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: true });
        expect(calls).toEqual([]);
        expect(result.status).toBe('dry_run');
        expect(result.groups.at(-1)).toMatchObject({ name: 'legacy-prefixes', tagCount: 54 });
    });
});
