import { describe, expect, it } from 'bun:test';
import { parseCatalog } from '../src/commands/whats-new/catalog.ts';
import { dropBranchName, dropPrBody, planDrop } from '../src/commands/whats-new/drop-core.ts';

/** Builds a catalog with the given entry blocks. */
function makeSource({ entries }: { readonly entries: string }): string {
    return `export const whatsNewEntries: WhatsNewEntry[] = WhatsNewCatalogSchema.parse([
${entries}
] satisfies z.input<typeof WhatsNewCatalogSchema>);
`;
}

function pendingEntry({
    id,
    origin = '#3271'
}: {
    readonly id: string;
    readonly origin?: string;
}): string {
    return `    // origin: ${origin}
    {
        id: '${id}',
        publishedAt: 'on-promotion',
        title: { es: 'T ${id}' },
        body: { es: 'B ${id}' }
    }`;
}

function publishedEntry({ id }: { readonly id: string }): string {
    return `    {
        id: '${id}',
        publishedAt: '2026-09-01T00:00:00Z',
        title: { es: 'T' },
        body: { es: 'B' }
    }`;
}

describe('planDrop', () => {
    it('should remove the named entry and leave the others intact', () => {
        const source = makeSource({
            entries: `${pendingEntry({ id: 'a' })},\n${pendingEntry({ id: 'b', origin: '#99' })}`
        });

        const outcome = planDrop({ content: source, ids: ['a'] });

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.plan.dropped.map((entry) => entry.id)).toEqual(['a']);
        expect(parseCatalog({ content: outcome.plan.content }).map((entry) => entry.id)).toEqual([
            'b'
        ]);
        // The removal takes the entry's own `// origin:` comment with it.
        expect(outcome.plan.content).not.toContain('#3271');
        expect(outcome.plan.content).toContain('#99');
    });

    it('should collect the origin PRs of every dropped entry, deduplicated', () => {
        const source = makeSource({
            entries: `${pendingEntry({ id: 'a', origin: '#1, #2' })},\n${pendingEntry({
                id: 'b',
                origin: '#2, #3'
            })}`
        });

        const outcome = planDrop({ content: source, ids: ['a', 'b'] });

        expect(outcome.ok).toBe(true);
        if (outcome.ok) expect(outcome.plan.originPrs).toEqual([1, 2, 3]);
    });

    it('should report entries that recorded no origin, instead of silently having nothing to relabel', () => {
        const source = makeSource({
            entries: `    {
        id: 'orphan',
        publishedAt: 'on-promotion',
        title: { es: 'T' },
        body: { es: 'B' }
    }`
        });

        const outcome = planDrop({ content: source, ids: ['orphan'] });

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(outcome.plan.originPrs).toEqual([]);
        expect(outcome.plan.withoutOrigin.map((entry) => entry.id)).toEqual(['orphan']);
    });

    it('should drop several entries at once without corrupting the array', () => {
        const source = makeSource({
            entries: [
                pendingEntry({ id: 'a' }),
                pendingEntry({ id: 'b' }),
                pendingEntry({ id: 'c' })
            ].join(',\n')
        });

        const outcome = planDrop({ content: source, ids: ['a', 'c'] });

        expect(outcome.ok).toBe(true);
        if (!outcome.ok) return;
        expect(parseCatalog({ content: outcome.plan.content }).map((entry) => entry.id)).toEqual([
            'b'
        ]);
        expect(outcome.plan.content).not.toContain(',,');
    });

    // --- The two refusals, which are the point of the command being safe ---
    it('should refuse the whole drop when ANY id is unknown', () => {
        const source = makeSource({ entries: pendingEntry({ id: 'a' }) });

        const outcome = planDrop({ content: source, ids: ['a', 'typo'] });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('typo');
    });

    it('should refuse to drop an ALREADY PUBLISHED entry, and say it belongs in the retired ledger', () => {
        // A published id may sit in somebody's `seenIds`; removing it without
        // retiring the id is how a future entry silently arrives already-seen.
        const source = makeSource({ entries: publishedEntry({ id: 'live' }) });

        const outcome = planDrop({ content: source, ids: ['live'] });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
            expect(outcome.reason).toContain('live');
            expect(outcome.reason).toContain('RETIRED_WHATS_NEW_IDS');
        }
    });

    it('should refuse a mixed batch on the published one, dropping nothing', () => {
        const source = makeSource({
            entries: `${pendingEntry({ id: 'a' })},\n${publishedEntry({ id: 'live' })}`
        });

        const outcome = planDrop({ content: source, ids: ['a', 'live'] });

        expect(outcome.ok).toBe(false);
    });

    it('should refuse an empty id list', () => {
        expect(planDrop({ content: makeSource({ entries: '' }), ids: [] }).ok).toBe(false);
    });

    it('should refuse a catalog whose declaration it cannot find', () => {
        const outcome = planDrop({ content: 'export const other = [];', ids: ['a'] });

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) expect(outcome.reason).toContain('whatsNewEntries');
    });
});

describe('dropBranchName', () => {
    it('should be stable regardless of the order the ids were given in', () => {
        expect(dropBranchName({ ids: ['b', 'a'] })).toBe(dropBranchName({ ids: ['a', 'b'] }));
    });

    it('should produce a git-safe branch under chore/', () => {
        const branch = dropBranchName({ ids: ['2026-09-08-thing'] });

        expect(branch.startsWith('chore/whats-new-drop-')).toBe(true);
        expect(branch).toMatch(/^[a-z0-9/-]+$/);
    });
});

describe('dropPrBody', () => {
    it('should state WHY the PR carries whats-new-none, not merely that it does', () => {
        const body = dropPrBody({ dropped: ['a'], originPrs: [10] });

        expect(body).toContain('whats-new-none');
        expect(body).toContain('cannot itself be a novelty');
        expect(body).toContain('#10');
    });

    it('should say no id was retired, since nothing dropped was ever published', () => {
        const body = dropPrBody({ dropped: ['a'], originPrs: [] });

        expect(body).toContain('RETIRED_WHATS_NEW_IDS');
        expect(body).toContain('seenIds');
    });
});
