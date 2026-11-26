import type { DynamicBlockConfig } from '@repo/schemas';
import { DynamicBlockConfigSchema } from '@repo/schemas';
import { DynamicResolutionError } from './dynamic-resolution.error.js';
import type { DroppedItem } from './dynamic-source.port.js';
import type {
    BlockResolutionReport,
    ResolveBlocksInput,
    ResolveBlocksOutput,
    ResolvedBlock
} from './resolution.types.js';

function historySelection(input: {
    readonly block: DynamicBlockConfig;
    readonly history: ResolveBlocksInput['history'];
}) {
    const editions = input.history
        .filter((entry) => entry.blockKey === input.block.blockKey)
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
        .slice(0, input.block.excludeRecentEditions);
    const lastShown = new Map<string, number>();
    for (const entry of editions) {
        for (const id of entry.itemIds) {
            lastShown.set(id, Math.max(lastShown.get(id) ?? -Infinity, entry.sentAt.getTime()));
        }
    }
    return [...lastShown]
        .sort(([idA, timeA], [idB, timeB]) => timeA - timeB || (idA < idB ? -1 : idA > idB ? 1 : 0))
        .map(([id]) => id);
}

async function resolveOne(input: {
    readonly block: DynamicBlockConfig;
    readonly request: ResolveBlocksInput;
}): Promise<{ readonly block: ResolvedBlock; readonly report: BlockResolutionReport }> {
    const { block, request } = input;
    const current = request.phase === 'send' ? request.current?.get(block.blockKey) : undefined;
    const manual = current?.manuallyEdited ?? false;
    const historyIds = historySelection({ block, history: request.history });
    const excluded = new Set(historyIds);
    const attempted = new Set<string>();
    const selected: string[] = [];
    const candidates: string[] = [];
    const dropped: DroppedItem[] = [];
    const repeats: string[] = [];

    async function accept(input: { readonly ids: readonly string[]; readonly repeat: boolean }) {
        const ids = [...new Set(input.ids)].filter((id) => !attempted.has(id));
        if (!ids.length) return;
        for (const id of ids) attempted.add(id);
        candidates.push(...ids);
        const checked = await request.port.revalidate({ block, ids, now: request.now });
        const valid = new Set(checked.validIds);
        dropped.push(...checked.dropped);
        // Keep source/manual order, even when an adapter returns valid IDs in DB order.
        for (const id of ids) {
            if (valid.has(id) && (manual || selected.length < block.count)) {
                selected.push(id);
                if (input.repeat || historyIds.includes(id)) repeats.push(id);
            }
        }
    }

    if (current) await accept({ ids: current.itemIds, repeat: false });
    if (!manual) {
        while (selected.length < block.count) {
            const fetched = await request.port.fetchCandidates({
                block,
                now: request.now,
                excludeIds: [...new Set([...excluded, ...attempted])],
                limit: block.count - selected.length
            });
            const fresh = fetched.filter((id) => !excluded.has(id) && !attempted.has(id));
            if (!fresh.length) break;
            await accept({ ids: fresh, repeat: false });
        }
        if (block.fillWithRepeats && selected.length < block.count) {
            await accept({ ids: historyIds, repeat: true });
        }
    }

    const loadedCards = await request.port.loadCards({ ids: selected, locales: request.locales });
    // A concurrent hard deletion must not make an empty card satisfy minItems.
    const itemIds = selected.filter((id) => {
        if (loadedCards.has(id)) return true;
        dropped.push({ id, reason: 'deleted' });
        return false;
    });
    const finalRepeats = repeats.filter((id) => itemIds.includes(id));
    const belowMin = itemIds.length < block.minItems;
    const action = belowMin ? block.ifBelowMin : 'send';
    return {
        block: {
            blockKey: block.blockKey,
            entityType: block.entityType,
            itemIds,
            repeats: finalRepeats,
            hidden: itemIds.length === 0 || action === 'hide_block',
            cards: new Map(itemIds.map((id) => [id, loadedCards.get(id) ?? {}]))
        },
        report: {
            blockKey: block.blockKey,
            candidates,
            dropped,
            repeatsUsed: finalRepeats.length,
            belowMin,
            action
        }
    };
}

/** Resolve blocks deterministically without writes; manually edited sends only lose invalid items. */
export async function resolveBlocks(input: ResolveBlocksInput): Promise<ResolveBlocksOutput> {
    const configs = input.blocks.map((block) => DynamicBlockConfigSchema.parse(block));
    if (new Set(configs.map((block) => block.blockKey)).size !== configs.length) {
        throw new DynamicResolutionError({ code: 'DUPLICATE_DYNAMIC_BLOCK_KEY' });
    }
    const blocks: ResolvedBlock[] = [];
    const reports: BlockResolutionReport[] = [];
    for (const config of configs) {
        const resolved = await resolveOne({ block: config, request: input });
        blocks.push(resolved.block);
        reports.push(resolved.report);
    }
    return {
        decision: reports.some((report) => report.action === 'skip_run') ? 'skip_run' : 'send',
        blocks,
        report: { blocks: reports }
    };
}
