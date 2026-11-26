import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { isResponseDegraded, markResponseDegraded } from '@/lib/cache/response-cache';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/destinos/[...path].astro'),
    'utf8'
);
// Run the actual route's load and cache decision with the surrounding APIs doubled.
const start = source.indexOf('function settledLoadFailed(');
const end = source.indexOf("if (statsResult.status === 'fulfilled'", start);
const block = ts.transpile(
    `(async () => { ${source.slice(start, end)} } catch (error) { throw error; } })()`
);

async function loadProvince({
    result,
    isProvince = true
}: {
    readonly result:
        | { readonly ok: boolean; readonly data?: { readonly descendants: readonly unknown[] } }
        | Error;
    readonly isProvince?: boolean;
}) {
    const locals = {} as App.Locals;
    const getDescendants =
        result instanceof Error
            ? vi.fn().mockRejectedValue(result)
            : vi.fn().mockResolvedValue(result);
    const emptyList = vi.fn().mockResolvedValue({ ok: true, data: [] });
    const context = {
        Astro: { locals },
        markResponseDegraded,
        isProvince,
        destId: 'destination-id',
        parentDestinationId: undefined,
        provinceCities: [],
        accCards: [],
        eventCards: [],
        accCount: 0,
        eventsCount: 0,
        destinationsApi: { getStats: emptyList, getDescendants },
        accommodationsApi: { getByDestination: emptyList },
        eventsApi: { list: emptyList },
        postsApi: { getByRelatedDestination: emptyList }
    };
    await runInNewContext(block, context);
    return {
        degraded: isResponseDegraded({ locals }),
        cities: context.provinceCities,
        getDescendants
    };
}

describe('province city lookup cache policy', () => {
    it.each([
        { ok: false },
        new Error('API unavailable')
    ])('demotes shared caching after a failed lookup: %s', async (result) => {
        const { degraded, cities, getDescendants } = await loadProvince({ result });
        expect(getDescendants).toHaveBeenCalledWith({
            id: 'destination-id',
            destinationType: 'CITY'
        });
        expect(cities).toEqual([]);
        expect(degraded).toBe(true);
    });

    it('leaves caching eligible when the lookup succeeds with no cities', async () => {
        const { degraded, cities, getDescendants } = await loadProvince({
            result: { ok: true, data: { descendants: [] } }
        });
        expect(getDescendants).toHaveBeenCalledOnce();
        expect(cities).toEqual([]);
        expect(degraded).toBe(false);
    });

    it('does not request cities or demote a non-province response', async () => {
        const { degraded, getDescendants } = await loadProvince({
            isProvince: false,
            result: { ok: false }
        });
        expect(getDescendants).not.toHaveBeenCalled();
        expect(degraded).toBe(false);
    });
});
