import type { DynamicBlockConfig } from '@repo/schemas';
import {
    applyDynamicBlockDefaults,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    NewsletterIfBelowMinEnum
} from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { DynamicSourcePort } from '../../../../src/services/newsletter/dynamic/dynamic-source.port.js';
import type { ResolveBlocksInput } from '../../../../src/services/newsletter/dynamic/resolution.types.js';
import { resolveBlocks } from '../../../../src/services/newsletter/dynamic/resolve-blocks.js';

const now = new Date('2026-11-26T12:00:00Z');

function block(overrides: Partial<DynamicBlockConfig> = {}): DynamicBlockConfig {
    return {
        ...applyDynamicBlockDefaults({
            config: {
                blockKey: 'test-block',
                entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
                source: NewsletterDynamicSourceEnum.NEWEST,
                count: 3
            },
            dynamicBlockCount: 1
        }),
        ...overrides
    };
}

function fake(
    input: { readonly ids?: readonly string[]; readonly invalid?: readonly string[] } = {}
) {
    const ids = input.ids ?? ['a', 'b', 'c', 'd'];
    const invalid = new Set(input.invalid ?? []);
    return {
        fetchCandidates: vi.fn<DynamicSourcePort['fetchCandidates']>(
            async ({ excludeIds, limit }) =>
                ids.filter((id) => !excludeIds.includes(id)).slice(0, limit)
        ),
        revalidate: vi.fn<DynamicSourcePort['revalidate']>(async ({ ids }) => ({
            validIds: ids.filter((id) => !invalid.has(id)),
            dropped: ids
                .filter((id) => invalid.has(id))
                .map((id) => ({ id, reason: 'not_published' as const }))
        })),
        loadCards: vi.fn<DynamicSourcePort['loadCards']>(
            async ({ ids }) =>
                new Map(
                    ids.map((id) => [
                        id,
                        {
                            en: {
                                name: id,
                                summary: '',
                                imageUrl: null,
                                url: `https://example.com/en/alojamientos/${id}/`
                            }
                        }
                    ])
                )
        )
    };
}

function request(overrides: Partial<ResolveBlocksInput> = {}): ResolveBlocksInput {
    return {
        blocks: [block()],
        phase: 'send',
        now,
        history: [],
        locales: ['en'],
        port: fake(),
        ...overrides
    };
}

describe('resolveBlocks', () => {
    it('is deterministic and preserves ranked order', async () => {
        const input = request({ port: fake({ ids: ['c', 'a', 'b'] }) });
        expect(await resolveBlocks(input)).toEqual(await resolveBlocks(input));
        expect((await resolveBlocks(input)).blocks[0]?.itemIds).toEqual(['c', 'a', 'b']);
    });

    it('deduplicates candidates and refills after rejection', async () => {
        const result = await resolveBlocks(
            request({ port: fake({ ids: ['a', 'a', 'b', 'c', 'd'], invalid: ['b'] }) })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['a', 'c', 'd']);
        expect(result.report.blocks[0]?.dropped).toEqual([{ id: 'b', reason: 'not_published' }]);
    });

    it('revalidates preview selections and refills at send (AC-F1-7)', async () => {
        const result = await resolveBlocks(
            request({
                port: fake({ invalid: ['a'] }),
                current: new Map([
                    ['test-block', { itemIds: ['a', 'b', 'c'], manuallyEdited: false }]
                ])
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['b', 'c', 'd']);
        expect(result.report.blocks[0]?.dropped).toContainEqual({
            id: 'a',
            reason: 'not_published'
        });
    });

    it('never fills a manually edited send', async () => {
        const port = fake({ invalid: ['a'] });
        const result = await resolveBlocks(
            request({
                port,
                current: new Map([['test-block', { itemIds: ['c', 'a'], manuallyEdited: true }]])
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['c']);
        expect(port.fetchCandidates).not.toHaveBeenCalled();
    });

    it('generates afresh rather than consuming draft edits', async () => {
        const result = await resolveBlocks(
            request({
                phase: 'generate',
                current: new Map([['test-block', { itemIds: ['d'], manuallyEdited: true }]])
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['a', 'b', 'c']);
    });

    it('does not truncate valid manual selections when count was reduced', async () => {
        const result = await resolveBlocks(
            request({
                blocks: [block({ count: 1 })],
                current: new Map([['test-block', { itemIds: ['d', 'b'], manuallyEdited: true }]])
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['d', 'b']);
    });

    it.each([
        [NewsletterIfBelowMinEnum.SKIP_RUN, 'skip_run', false],
        [NewsletterIfBelowMinEnum.HIDE_BLOCK, 'send', true],
        [NewsletterIfBelowMinEnum.SEND_ANYWAY, 'send', false]
    ] as const)('applies %s after revalidation', async (ifBelowMin, decision, hidden) => {
        const result = await resolveBlocks(
            request({
                blocks: [block({ minItems: 3, ifBelowMin })],
                port: fake({ ids: ['a', 'b'] })
            })
        );
        expect(result.decision).toBe(decision);
        expect(result.blocks[0]?.hidden).toBe(hidden);
        expect(result.report.blocks[0]).toMatchObject({ belowMin: true, action: ifBelowMin });
    });

    it('hides empty send_anyway blocks', async () => {
        const result = await resolveBlocks(
            request({
                blocks: [block({ ifBelowMin: NewsletterIfBelowMinEnum.SEND_ANYWAY })],
                port: fake({ ids: [] })
            })
        );
        expect(result.blocks[0]?.hidden).toBe(true);
        expect(result.decision).toBe('send');
    });

    it('fills with least recently shown repeats using each item latest appearance', async () => {
        const result = await resolveBlocks(
            request({
                blocks: [block({ excludeRecentEditions: 3, fillWithRepeats: true })],
                history: [
                    { blockKey: 'test-block', sentAt: new Date('2026-11-25'), itemIds: ['a'] },
                    { blockKey: 'test-block', sentAt: new Date('2026-11-24'), itemIds: ['c', 'b'] },
                    { blockKey: 'test-block', sentAt: new Date('2026-11-23'), itemIds: ['a'] }
                ]
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['d', 'b', 'c']);
        expect(result.blocks[0]?.repeats).toEqual(['b', 'c']);
        expect(result.report.blocks[0]?.repeatsUsed).toBe(2);
    });

    it('limits history to recent editions of this block and honors fillWithRepeats=false', async () => {
        const result = await resolveBlocks(
            request({
                blocks: [block({ excludeRecentEditions: 1, fillWithRepeats: false })],
                history: [
                    { blockKey: 'test-block', sentAt: now, itemIds: ['a', 'b'] },
                    { blockKey: 'test-block', sentAt: new Date('2026-11-01'), itemIds: ['c'] },
                    { blockKey: 'other-key', sentAt: now, itemIds: ['d'] }
                ]
            })
        );
        expect(result.blocks[0]?.itemIds).toEqual(['c', 'd']);
        expect(result.blocks[0]?.repeats).toEqual([]);
    });

    it('revalidates repeats before applying the minimum', async () => {
        const result = await resolveBlocks(
            request({
                port: fake({ ids: ['a'], invalid: ['a'] }),
                blocks: [block({ excludeRecentEditions: 1, fillWithRepeats: true })],
                history: [{ blockKey: 'test-block', sentAt: now, itemIds: ['a'] }]
            })
        );
        expect(result.decision).toBe('skip_run');
        expect(result.report.blocks[0]?.dropped).toContainEqual({
            id: 'a',
            reason: 'not_published'
        });
    });

    it('does not count missing cards toward the minimum', async () => {
        const port = fake();
        port.loadCards.mockResolvedValue(new Map());
        const result = await resolveBlocks(request({ port }));
        expect(result.decision).toBe('skip_run');
        expect(result.blocks[0]?.itemIds).toEqual([]);
    });

    it('keeps dedup scoped to each block (D-5)', async () => {
        const result = await resolveBlocks(
            request({ blocks: [block({ count: 2 }), block({ blockKey: 'next-block', count: 2 })] })
        );
        expect(result.blocks.map((entry) => entry.itemIds)).toEqual([
            ['a', 'b'],
            ['a', 'b']
        ]);
    });

    it('stops if a port ignores exclusions', async () => {
        const port = fake();
        port.fetchCandidates.mockResolvedValue(['a', 'a']);
        const result = await resolveBlocks(request({ port }));
        expect(result.blocks[0]?.itemIds).toEqual(['a']);
        expect(port.fetchCandidates).toHaveBeenCalledTimes(2);
    });

    it('validates all configs before reading and rejects duplicate keys', async () => {
        const port = fake();
        await expect(resolveBlocks(request({ port, blocks: [block(), block()] }))).rejects.toThrow(
            'DUPLICATE_DYNAMIC_BLOCK_KEY'
        );
        await expect(
            resolveBlocks(request({ port, blocks: [block({ count: 0 })] }))
        ).rejects.toThrow();
        expect(port.fetchCandidates).not.toHaveBeenCalled();
    });

    it('returns send for a document without blocks', async () => {
        expect(await resolveBlocks(request({ blocks: [] }))).toEqual({
            decision: 'send',
            blocks: [],
            report: { blocks: [] }
        });
    });
});
