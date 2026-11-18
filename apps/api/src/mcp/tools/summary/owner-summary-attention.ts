/**
 * @file owner-summary-attention.ts
 * @description The "needs your attention" block of `get_owner_summary`
 * (HOS-2331, spec HOS-2335 §6.6, AC-C31). Never plan gated (D-9).
 *
 * Sources:
 * - unanswered inquiries: conversations in `PENDING_OWNER`, the count
 *   `list_inquiries` gives for that status (read once by the tool,
 *   `readUnansweredInquiries`), linked to the inbox;
 * - pending benefit usages (D-11): host side `countPendingForHost` (the
 *   `/usages/pending/count` badge, linked to `usos-de-beneficio`); provider side,
 *   only when `getOwn` finds the caller's directory listing, the provider inbox
 *   `listForProvider({ status: PENDING, declaredBy: HOST })` (what
 *   `mi-cuenta/proveedor` lists as pending, linked to that panel). Each is
 *   omitted when zero. All auth-only and scoped to the actor by the service: no
 *   role and no permission decides (HOS-376).
 * - open fix requests: `readOpenFixRequestListings`, linked to the editor hub
 *   (where the fix-request banner lives);
 * - incomplete drafts and missing photos: `readDraftAttention`.
 *
 * The services are the shared instances of the provider and benefit-usage tools
 * (`host-trade/host-trade-tool-services.ts`, HOS-2332). This block reads the
 * counts that `list_benefit_usages` pages through, not the rows.
 */

import { HostTradeUsageDeclaredByEnum, HostTradeUsageStatusEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import type { PortalDestination } from '../../portal/portal-routes';
import {
    getHostTradeToolService,
    getHostTradeUsageToolService
} from '../host-trade/host-trade-tool-services';
import { LISTING_TOOL_VERTICALS, type ListingToolVertical } from '../listing/listing-services';
import type { ToolErrorPayload } from '../tool-definition';
import { readOpenFixRequestListings } from './owner-summary-readers';
import type { AttentionItem, AttentionKind } from './owner-summary-types';

/** Most attention items returned; the rest are counted in `more`. */
export const OWNER_SUMMARY_ATTENTION_CAP = 10;

/** Order of the kinds, most urgent first: people waiting on the owner come first. */
const KIND_ORDER: readonly AttentionKind[] = [
    'unanswered_inquiries',
    'pending_benefit_usages',
    'open_fix_request',
    'incomplete',
    'missing_photos'
];

/** A read that yields items, or the error to report. */
export type AttentionRead =
    | { readonly items: readonly AttentionItem[]; readonly error?: never }
    | { readonly items?: never; readonly error: ToolErrorPayload };

/** Builds a portal URL from the configured site URL. */
function portalUrl(destination: PortalDestination): string {
    return buildPortalUrl({ destination, siteUrl: env.HOSPEDA_SITE_URL });
}

/**
 * The unanswered-inquiries item, when there are any.
 *
 * @param args - The count already read (`undefined` when not available)
 * @returns Zero or one item
 */
export function unansweredInquiriesItems({
    count
}: {
    readonly count: number | undefined;
}): readonly AttentionItem[] {
    if (count === undefined || count <= 0) {
        return [];
    }
    return [{ kind: 'unanswered_inquiries', count, actionUrl: portalUrl({ kind: 'inquiry' }) }];
}

/**
 * The pending benefit-usage items: usages that wait on THIS user's answer, on
 * each side the user is on. A zero count yields no item.
 *
 * @param args - The actor
 * @returns Zero, one or two items, or the service error
 */
export async function readPendingUsageItems({
    actor
}: {
    readonly actor: Actor;
}): Promise<AttentionRead> {
    const usages = getHostTradeUsageToolService();
    const [hostPending, own] = await Promise.all([
        usages.countPendingForHost(actor),
        getHostTradeToolService().getOwn(actor)
    ]);
    if (hostPending.error) {
        return { error: hostPending.error };
    }
    if (own.error) {
        return { error: own.error };
    }
    const trade = own.data?.trade ?? null;
    const providerPending =
        trade === null
            ? null
            : await usages.listForProvider(
                  {
                      hostTradeId: trade.id,
                      status: HostTradeUsageStatusEnum.PENDING,
                      declaredBy: HostTradeUsageDeclaredByEnum.HOST,
                      page: 1,
                      pageSize: 1
                  },
                  actor
              );
    if (providerPending?.error) {
        return { error: providerPending.error };
    }
    const items: AttentionItem[] = [];
    const hostCount = hostPending.data?.count ?? 0;
    if (hostCount > 0) {
        items.push({
            kind: 'pending_benefit_usages',
            side: 'host',
            count: hostCount,
            actionUrl: portalUrl({ kind: 'benefitUsages' })
        });
    }
    const providerCount = providerPending?.data?.total ?? 0;
    if (providerCount > 0) {
        items.push({
            kind: 'pending_benefit_usages',
            side: 'provider',
            count: providerCount,
            actionUrl: portalUrl({ kind: 'providerPanel' })
        });
    }
    return { items };
}

/**
 * The open fix requests of the owner's listings, one item per listing.
 *
 * @param args - The owner and the verticals they have listings in
 * @returns The items, in vertical order
 */
export async function readFixRequestItems({
    ownerId,
    verticals
}: {
    readonly ownerId: string;
    readonly verticals: readonly ListingToolVertical[];
}): Promise<readonly AttentionItem[]> {
    const ordered = LISTING_TOOL_VERTICALS.filter((vertical) => verticals.includes(vertical));
    const reads = await Promise.all(
        ordered.map((vertical) => readOpenFixRequestListings({ vertical, ownerId }))
    );
    return ordered.flatMap((vertical, index) =>
        (reads[index] ?? []).map(
            (listing): AttentionItem => ({
                kind: 'open_fix_request',
                listing: { id: listing.id, vertical, name: listing.name },
                reportedFixed: listing.reportedFixed,
                actionUrl: portalUrl({ kind: 'listingEditor', vertical, id: listing.id })
            })
        )
    );
}

/**
 * Orders the items most urgent first and caps them.
 *
 * @param args - Every item, and the cap (defaults to {@link OWNER_SUMMARY_ATTENTION_CAP})
 * @returns The first `cap` items and how many were left out
 */
export function capAttention({
    items,
    cap = OWNER_SUMMARY_ATTENTION_CAP
}: {
    readonly items: readonly AttentionItem[];
    readonly cap?: number;
}): { readonly attention: readonly AttentionItem[]; readonly more: number } {
    const rank = (item: AttentionItem): number => KIND_ORDER.indexOf(item.kind);
    // Array.prototype.sort is stable, so items of one kind keep their order.
    const sorted = [...items].sort((a, b) => rank(a) - rank(b));
    return {
        attention: sorted.slice(0, cap),
        more: Math.max(0, sorted.length - cap)
    };
}
