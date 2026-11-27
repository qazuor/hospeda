import type { NewsletterPreviewSelection } from '@repo/schemas';
import type { CurrentBlockState } from './resolution.types.js';

/**
 * Turn the admin's previewed selection into the `current` input of the resolver.
 *
 * The selection is untrusted client input: it is never marked as manually
 * edited, so the resolver revalidates every id through the source port, drops
 * the ineligible ones (recording the reason) and refills up to the block count.
 * Block keys that are not part of the document are ignored.
 */
export function buildCurrentFromPreviewSelection({
    previewSelection,
    blockKeys
}: {
    readonly previewSelection?: NewsletterPreviewSelection;
    readonly blockKeys: readonly string[];
}): ReadonlyMap<string, CurrentBlockState> | undefined {
    if (!previewSelection?.length) return undefined;
    const known = new Set(blockKeys);
    const current = new Map<string, CurrentBlockState>();
    for (const { blockKey, itemIds } of previewSelection) {
        if (!known.has(blockKey)) continue;
        current.set(blockKey, { itemIds: [...itemIds], manuallyEdited: false });
    }
    return current;
}
