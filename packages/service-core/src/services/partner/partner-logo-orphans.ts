/**
 * Partner logos left without a reference by a content edit or review (owner
 * decision 16, Mi cuenta UI epic).
 *
 * A partner logo lives in two columns: `logoUrl` (the approved, live one) and
 * `pendingLogoUrl` (the submission waiting for review). Three moves can leave
 * an uploaded asset referenced by neither:
 *
 * - a new submission replaces an earlier pending logo;
 * - an approval promotes the pending logo over the previous live one;
 * - a rejection discards the pending logo.
 *
 * This module only names those URLs. Deleting the remote asset is the API's
 * job (it owns the media provider), and it runs after the row is written.
 */

import type { Partner } from '@repo/schemas';

/** The two logo columns of a partner row. */
export type PartnerLogoColumns = Pick<Partner, 'logoUrl' | 'pendingLogoUrl'>;

/** Input of {@link resolveDiscardedPartnerLogoUrls}. RO-RO. */
export interface ResolveDiscardedPartnerLogoUrlsInput {
    /** The row before the write. */
    readonly before: PartnerLogoColumns;
    /** The row after the write. */
    readonly after: PartnerLogoColumns;
}

/**
 * The logo URLs the row referenced before a write and no longer references
 * after it. A URL still held by EITHER column after the write is never
 * returned, so the approved/current logo is never named for deletion.
 *
 * @param input - See {@link ResolveDiscardedPartnerLogoUrlsInput}.
 * @returns The unique discarded URLs, possibly empty.
 */
export function resolveDiscardedPartnerLogoUrls({
    before,
    after
}: ResolveDiscardedPartnerLogoUrlsInput): readonly string[] {
    const kept = new Set(
        [after.logoUrl, after.pendingLogoUrl]
            .map((url) => url?.trim())
            .filter((url): url is string => Boolean(url))
    );
    const discarded = new Set<string>();
    for (const raw of [before.logoUrl, before.pendingLogoUrl]) {
        const url = raw?.trim();
        if (url && !kept.has(url)) discarded.add(url);
    }
    return [...discarded];
}
