import { describe, expect, it, vi } from 'vitest';
import { resolveCampaignContentWithReport } from '../../../../src/services/newsletter/dynamic/campaign-content.js';
import type { DynamicSourcePort } from '../../../../src/services/newsletter/dynamic/dynamic-source.port.js';
import { buildCurrentFromPreviewSelection } from '../../../../src/services/newsletter/dynamic/preview-selection.js';
import { dynamicConfig, dynamicDocument, frozenCards } from './content.fixtures.js';

const now = new Date('2026-11-27T12:00:00Z');

function port({ unpublished }: { unpublished: readonly string[] }) {
    const revalidate = vi.fn(async ({ ids }: { ids: readonly string[] }) => ({
        validIds: ids.filter((id) => !unpublished.includes(id)),
        dropped: ids
            .filter((id) => unpublished.includes(id))
            .map((id) => ({ id, reason: 'not_published' as const }))
    }));
    const fetchCandidates = vi.fn(
        async ({ excludeIds, limit }: { excludeIds: readonly string[]; limit: number }) =>
            // Like the real source, ranking only ever returns eligible items.
            ['a', 'b', 'c', 'd', 'e']
                .filter((id) => !unpublished.includes(id) && !excludeIds.includes(id))
                .slice(0, limit)
    );
    const source: DynamicSourcePort = {
        fetchCandidates,
        revalidate,
        loadCards: async ({ ids }) => new Map(ids.map((id) => [id, frozenCards]))
    };
    return { source, revalidate, fetchCandidates };
}

describe('buildCurrentFromPreviewSelection', () => {
    it('returns undefined without a selection', () => {
        expect(buildCurrentFromPreviewSelection({ blockKeys: ['x'] })).toBeUndefined();
        expect(
            buildCurrentFromPreviewSelection({ previewSelection: [], blockKeys: ['x'] })
        ).toBeUndefined();
    });

    it('ignores unknown block keys and never marks the selection as manually edited', () => {
        const current = buildCurrentFromPreviewSelection({
            previewSelection: [
                { blockKey: 'known', itemIds: ['a'] },
                { blockKey: 'ghost', itemIds: ['b'] }
            ],
            blockKeys: ['known']
        });
        expect([...(current ?? [])]).toEqual([
            ['known', { itemIds: ['a'], manuallyEdited: false }]
        ]);
    });
});

describe('resolveCampaignContentWithReport with previewSelection (AC-F1-7)', () => {
    it('drops the previewed item that is no longer published and refills', async () => {
        const { source } = port({ unpublished: ['a'] });
        const result = await resolveCampaignContentWithReport({
            doc: dynamicDocument(),
            port: source,
            now,
            previewSelection: [{ blockKey: dynamicConfig.blockKey, itemIds: ['a', 'b', 'c'] }]
        });
        expect(result.content?.blocks[0]?.itemIds).toEqual(['b', 'c', 'd']);
        expect(result.report.blocks[0]?.dropped).toEqual([{ id: 'a', reason: 'not_published' }]);
    });

    it('never trusts a forged id: it goes through revalidate and is dropped', async () => {
        const { source, revalidate } = port({ unpublished: ['forged'] });
        const result = await resolveCampaignContentWithReport({
            doc: dynamicDocument(),
            port: source,
            now,
            previewSelection: [{ blockKey: dynamicConfig.blockKey, itemIds: ['forged', 'b'] }]
        });
        expect(result.content?.blocks[0]?.itemIds).toEqual(['b', 'a', 'c']);
        expect(result.report.blocks[0]?.dropped).toEqual([
            { id: 'forged', reason: 'not_published' }
        ]);
        expect(revalidate.mock.calls[0]?.[0].ids).toEqual(['forged', 'b']);
    });

    it('resolves from scratch when no selection is sent', async () => {
        const { source } = port({ unpublished: [] });
        const result = await resolveCampaignContentWithReport({
            doc: dynamicDocument(),
            port: source,
            now
        });
        expect(result.content?.blocks[0]?.itemIds).toEqual(['a', 'b', 'c']);
    });
});
