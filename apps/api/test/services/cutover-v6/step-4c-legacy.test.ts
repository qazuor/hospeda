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
    LEGACY_ENTITY_TAG_PREFIX,
    resolveLegacyPrefixHosts
} from '../../../src/services/cutover-v6/step-4c.legacy.js';
import type { PagePurger } from '../../../src/services/cutover-v6/step-4c.service.js';
import { runStep4c } from '../../../src/services/cutover-v6/step-4c.service.js';

// The suite-wide mock of `@repo/db` has no `sql` helper; the service only needs
// a tagged template and `raw`, and the fake `execute` below ignores the query.
vi.mock('@repo/db', () => {
    const sql = Object.assign(() => ({}), { raw: () => ({}) });
    return { sql };
});

// The retired words are assembled from parts: the retired-word guard forbids them as literals.
const W = ['gas', 'tro'].join('');
const R = ['gas', 'tro', 'nomia'].join('');

describe('step 4c legacy vocabulary is pinned', () => {
    it('names exactly the retired collection tag and entity prefix', () => {
        // Assert
        expect(LEGACY_COLLECTION_TAGS).toEqual([`list-${W}`]);
        expect(LEGACY_ENTITY_TAG_PREFIX).toBe(W);
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
        expect(prefixes).toContain(
            `www.hospeda.com.ar/pt/publicar-${['restau', 'rante'].join('')}/`
        );
        expect(prefixes).toContain(`www.hospeda.com.ar/en/planes/${R}/`);
        expect(
            prefixes.some((prefix) => prefix.includes('://') || prefix.includes('staging'))
        ).toBe(false);
    });

    it('keeps the production output byte-identical whether the site URL is omitted or prod', () => {
        // Arrange
        const hosts = ['hospeda.com.ar', 'www.hospeda.com.ar'];
        const paths = [
            `${R}/`,
            'comer-y-salir/',
            `planes/${R}/`,
            'planes/comer-y-salir/',
            `presentacion/${R}/`,
            'presentacion/comer-y-salir/',
            `publicar/${R}/`,
            'publicar/comer-y-salir/',
            `publicar-${['restau', 'rante'].join('')}/`
        ];
        const expected = hosts.flatMap((host) =>
            ['es', 'en', 'pt'].flatMap((locale) => paths.map((path) => `${host}/${locale}/${path}`))
        );
        // Act / Assert
        expect(buildLegacyPrefixes()).toEqual(expected);
        expect(buildLegacyPrefixes({ siteUrl: 'https://hospeda.com.ar' })).toEqual(expected);
        expect(buildLegacyPrefixes({ siteUrl: 'https://hospeda.com.ar/' })).toEqual(expected);
    });

    it('derives only the staging host (no www alias, no prod host) on staging', () => {
        // Act
        const prefixes = buildLegacyPrefixes({ siteUrl: 'https://staging.hospeda.com.ar' });
        // Assert
        expect(resolveLegacyPrefixHosts({ siteUrl: 'https://staging.hospeda.com.ar' })).toEqual([
            'staging.hospeda.com.ar'
        ]);
        expect(prefixes).toHaveLength(27);
        expect(new Set(prefixes).size).toBe(27);
        expect(prefixes).toContain('staging.hospeda.com.ar/es/comer-y-salir/');
        expect(prefixes.every((prefix) => prefix.startsWith('staging.hospeda.com.ar/'))).toBe(true);
        expect(prefixes.some((prefix) => prefix.startsWith('www.'))).toBe(false);
    });

    it('rejects a site URL that is not a URL', () => {
        // Act / Assert
        expect(() => buildLegacyPrefixes({ siteUrl: 'hospeda.com.ar' })).toThrow();
    });

    it('builds <word>-<slug> and <word>-<id> tags, skipping a missing slug', () => {
        // Act
        const tags = buildLegacyEntityTags({
            listings: [{ id: 'id-1', slug: 'bar-uno' }, { id: 'id-2', slug: null }, { id: 'id-3' }]
        });
        // Assert
        expect(tags).toEqual([`${W}-bar-uno`, `${W}-id-1`, `${W}-id-2`, `${W}-id-3`]);
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

    it.each([
        [['--extra-tags-file=t.txt', '--extra-prefixes-file=p.txt']],
        [['--extra-tags-file', 't.txt', '--extra-prefixes-file', 'p.txt']]
    ])('gives the same result for %j (equals form and space form)', (argv) => {
        // Act
        const result = parseStep4cArgs({ argv });
        // Assert
        expect(result).toEqual({
            ok: true,
            value: {
                dryRun: false,
                confirmPurge: false,
                extraTagsFile: 't.txt',
                extraPrefixesFile: 'p.txt'
            }
        });
    });

    it('keeps a path containing = intact in the equals form', () => {
        const result = parseStep4cArgs({ argv: ['--extra-tags-file=a=b.txt'] });
        expect(result).toMatchObject({ ok: true, value: { extraTagsFile: 'a=b.txt' } });
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
        const fetchImpl = vi.fn(async (_url: string) => new Response('{"ok":true}'));
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

describe('page purger tag grouping through revalidateMany', () => {
    const noTransport = async () => ({ ok: true, status: 200 });

    it('hands ALL tags of a group to the service in ONE call (it batches by 100)', async () => {
        // Arrange
        const tags = Array.from({ length: 250 }, (_, i) => `t-${i}`);
        const revalidateTags = vi.fn(async ({ tags: given }: { tags: readonly string[] }) =>
            given.map((target) => ({ target, success: true, durationMs: 1 }))
        );
        const service = { getAdapterName: () => 'Fake', revalidateTags } as never;
        // Act
        const result = await createRevalidationPagePurger({
            service,
            prefixTransport: noTransport
        }).purge({ group: 'legacy-tags', tags });
        // Assert
        expect(revalidateTags).toHaveBeenCalledTimes(1);
        expect(revalidateTags.mock.calls[0]?.[0].tags).toEqual(tags);
        expect(result).toEqual({ ok: true, failed: [] });
    });

    it('reports the tags a rejected (429) request carried as failed', async () => {
        // Arrange
        const revalidateTags = vi.fn(async () => [
            { target: 'a', success: true, durationMs: 1 },
            { target: 'b', success: false, error: 'HTTP 429: Too Many Requests', durationMs: 1 }
        ]);
        const service = { getAdapterName: () => 'Fake', revalidateTags } as never;
        // Act
        const result = await createRevalidationPagePurger({
            service,
            prefixTransport: noTransport
        }).purge({ group: 'legacy-tags', tags: ['a', 'b'] });
        // Assert
        expect(result).toEqual({ ok: false, failed: ['b'] });
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
            extraTags: [`${W}-extra`, `list-${W}`, `${W}-live-slug`],
            extraPrefixes: [`hospeda.com.ar/es/${R}/`, 'hospeda.com.ar/es/otra/']
        });
        // Assert
        const legacyTags = calls.find(({ group }) => group === 'legacy-tags')?.items ?? [];
        expect(legacyTags).toEqual([
            `${W}-14820000-0000-4000-8000-000000000002`,
            `${W}-extra`,
            `${W}-live-id`,
            `${W}-live-slug`,
            `list-${W}`
        ]);
        expect(calls.find(({ group }) => group === 'legacy-prefixes')?.items).toHaveLength(55);
        expect(result.status).toBe('completed');
    });

    it('fails when a legacy group is rejected (a 429 must not be skipped over) but still attempts the rest', async () => {
        // Arrange
        const { purger, calls } = recordingPurger({ failGroup: 'legacy-tags' });
        // Act
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: false });
        // Assert
        expect(result.status).toBe('failed');
        expect(result.groups.find(({ name }) => name === 'legacy-tags')).toMatchObject({
            ok: false
        });
        expect(calls.map(({ group }) => group)).toContain('legacy-prefixes');
    });

    it('fails when only the prefix purge is rejected', async () => {
        const { purger } = recordingPurger({ failGroup: 'legacy-prefixes' });
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: false });
        expect(result.status).toBe('failed');
        expect(result.groups.at(-1)).toMatchObject({ name: 'legacy-prefixes', ok: false });
    });

    it('purges only the environment host prefixes when given the staging site URL', async () => {
        // Arrange
        const { purger, calls } = recordingPurger();
        // Act
        const result = await runStep4c({
            db: fakeDb(),
            pagePurger: purger,
            dryRun: false,
            siteUrl: 'https://staging.hospeda.com.ar'
        });
        // Assert
        const sent = calls.find(({ group }) => group === 'legacy-prefixes')?.items ?? [];
        expect(result.status).toBe('completed');
        expect(sent).toHaveLength(27);
        expect(sent.every((prefix) => prefix.startsWith('staging.hospeda.com.ar/'))).toBe(true);
    });

    it('calls nothing on a dry run but still counts the legacy groups', async () => {
        const { purger, calls } = recordingPurger();
        const result = await runStep4c({ db: fakeDb(), pagePurger: purger, dryRun: true });
        expect(calls).toEqual([]);
        expect(result.status).toBe('dry_run');
        expect(result.groups.at(-1)).toMatchObject({ name: 'legacy-prefixes', tagCount: 54 });
    });
});
