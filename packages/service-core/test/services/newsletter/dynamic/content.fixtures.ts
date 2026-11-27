import type { TiptapDocument } from '@repo/utils';
import type { DynamicSourcePort } from '../../../../src/services/newsletter/dynamic/dynamic-source.port.js';

/** Stable inline block configuration for campaign and worker contract tests. */
export const dynamicConfig = {
    blockKey: 'newest-block',
    entityType: 'ACCOMMODATION',
    source: 'newest',
    count: 3,
    params: {},
    minItems: 1,
    ifBelowMin: 'skip_run',
    excludeRecentEditions: 0,
    fillWithRepeats: false
};

/** Build a root dynamic document with an optional below-minimum policy override. */
export function dynamicDocument({ minItems = 1 }: { minItems?: number } = {}): TiptapDocument {
    return {
        type: 'doc',
        content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
            {
                type: 'dynamicBlock',
                attrs: {
                    blockKey: dynamicConfig.blockKey,
                    config: JSON.stringify({ ...dynamicConfig, minItems })
                }
            }
        ]
    };
}

/** Plain records must survive JSON serialization without losing cards or order. */
export const frozenCards = {
    es: { name: 'Casa', summary: 'Resumen', imageUrl: null, url: 'https://hospeda.test/es/casa/' },
    en: { name: 'House', summary: 'Summary', imageUrl: null, url: 'https://hospeda.test/en/casa/' },
    pt: { name: 'Casa PT', summary: 'Resumo', imageUrl: null, url: 'https://hospeda.test/pt/casa/' }
};

/** Expected persisted value, asserted in full rather than through partial matching. */
export function frozenContent() {
    return {
        version: 1 as const,
        doc: { type: 'doc' as const, content: [...dynamicDocument().content] },
        blocks: [
            {
                blockKey: dynamicConfig.blockKey,
                hidden: false,
                itemIds: ['item-b', 'item-a'],
                cards: { 'item-b': frozenCards, 'item-a': frozenCards }
            }
        ]
    };
}

/** Read-only fake with realistic Map-backed card loading. */
export function dynamicPort(): DynamicSourcePort {
    return {
        fetchCandidates: async () => ['item-b', 'item-a'],
        revalidate: async ({ ids }) => ({ validIds: ids, dropped: [] }),
        loadCards: async ({ ids }) => new Map(ids.map((id) => [id, frozenCards]))
    };
}
