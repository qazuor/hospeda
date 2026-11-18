/**
 * @file list-benefit-usages.ts
 * @description Tool `list_benefit_usages` (HOS-2332, spec HOS-2335 §6.7,
 * AC-C35): the benefit usages of the connected user, from both sides of the
 * "A declares, B confirms" flow (HOS-376).
 *
 * Same reads as the routes, scoped by the service to the actor, never to a
 * parameter:
 * - **host side**: `GET /usages` (`listForHost`) or, with `pendingMine`, the
 *   inbox `GET /usages/pending` (`listPendingForHost`: PENDING and declared by a
 *   provider, so waiting on this host);
 * - **provider side**: `GET /mine/usages` (`listForProvider` after `getOwn`).
 *   It only exists when the caller owns a directory listing; with
 *   `pendingMine` it is the provider inbox, `status=PENDING&declaredBy=HOST`.
 *
 * All auth-only, like the routes: no `HOST_TRADE_*` permission (a provider is
 * an ordinary account) and no role. `canAnswer` is the service's own
 * counterpart rule (`isUsageCounterpart`) over the row, so the account that is
 * both host and provider sees, per row, exactly the answers the transitions
 * accept.
 *
 * The counterpart's name: on the host side, the provider's name (the ref the
 * host lists carry); on the provider side, the host's display name ONLY when
 * that host is in the provider's linked-hosts selector (a confirmed pair), the
 * one place the portal names hosts to a provider. Otherwise `null`, as the
 * provider panel shows "el anfitrión".
 *
 * Notes and provider names are third-party text, wrapped as untrusted (C-5).
 */

import {
    type HostTradeBenefitUsage,
    HostTradeUsageDeclaredByEnum,
    HostTradeUsageStatusEnum,
    HostTradeUsageStatusEnumSchema
} from '@repo/schemas';
import { type Actor, isUsageCounterpart } from '@repo/service-core';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { buildPortalUrl } from '../../portal/build-portal-url';
import { excerptText, MCP_LIST_MAX_PAGE_SIZE } from '../response-budget';
import { defineTool, type ToolErrorPayload, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { fitPageToBudget } from './fit-page-to-budget';
import { getHostTradeToolService, getHostTradeUsageToolService } from './host-trade-tool-services';

/** Usages per page when the call does not say. */
export const LIST_BENEFIT_USAGES_DEFAULT_PAGE_SIZE = 10;

/**
 * Deepest row `side: 'both'` can reach: each side is read from its first row,
 * and the service caps a page at 100.
 */
export const LIST_BENEFIT_USAGES_BOTH_SIDES_MAX_WINDOW = 100;

/**
 * Excerpt lengths tried in order until the page fits the response budget, for
 * the notes and (capped at `NAME_EXCERPT_CHARS`) the names. The first is the
 * write-time cap of a note (300), so nothing is cut unless the page would
 * overflow; the last is the floor, measured too (`fitPageToBudget`).
 */
const NOTE_EXCERPT_STEPS: readonly number[] = [300, 150, 60, 30];

/** Longest name excerpt. Provider names have no cap at write time. */
const NAME_EXCERPT_CHARS = 120;

/** Input schema of `list_benefit_usages`. One flat object (C-2). */
export const ListBenefitUsagesInputSchema = z
    .object({
        side: z
            .enum(['host', 'provider', 'both'])
            .default('both')
            .describe(
                "host: usages of benefits the user used as a host. provider: usages of the benefit of the user's own directory listing (only for providers). both (default): the two together, newest first."
            ),
        status: HostTradeUsageStatusEnumSchema.optional().describe(
            'Only usages in this state: PENDING, CONFIRMED, REJECTED or EXPIRED.'
        ),
        pendingMine: z
            .boolean()
            .default(false)
            .describe(
                'true: only the PENDING usages waiting for THE USER to confirm or reject (declared by the other party).'
            ),
        page: z.number().int().min(1).default(1).describe('Page number, starting at 1.'),
        pageSize: z
            .number()
            .int()
            .min(1)
            .max(MCP_LIST_MAX_PAGE_SIZE)
            .default(LIST_BENEFIT_USAGES_DEFAULT_PAGE_SIZE)
            .describe(`Usages per page, up to ${MCP_LIST_MAX_PAGE_SIZE}.`)
    })
    .strict()
    .superRefine((input, ctx) => {
        if (
            input.pendingMine &&
            input.status !== undefined &&
            input.status !== HostTradeUsageStatusEnum.PENDING
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['status'],
                message: 'pendingMine only lists PENDING usages; drop status or use PENDING'
            });
        }
        if (
            input.side === 'both' &&
            input.page * input.pageSize > LIST_BENEFIT_USAGES_BOTH_SIDES_MAX_WINDOW
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['page'],
                message: `with side "both", page * pageSize cannot exceed ${LIST_BENEFIT_USAGES_BOTH_SIDES_MAX_WINDOW}; pick one side to go deeper`
            });
        }
    });

/** Which side of the usage the user is on. */
export type BenefitUsageSide = 'host' | 'provider';

/** One usage in the result. */
export interface BenefitUsageSummary {
    /** Usage id (for confirm_benefit_usage, reject_benefit_usage, undo_benefit_rejection). */
    readonly id: string;
    /** host: the user used a provider's benefit. provider: a host used the user's benefit. */
    readonly side: BenefitUsageSide;
    /** Which party declared it: HOST or PROVIDER. */
    readonly declaredBy: string;
    /** PENDING, CONFIRMED, REJECTED or EXPIRED. */
    readonly status: string;
    /** The provider, name inside the envelope (on the provider side: the user's own listing). */
    readonly provider: { readonly slug: string | null; readonly name: string | null };
    /** The other party's name, inside the envelope; `null` when it is not shown. */
    readonly counterpartName: string | null;
    /** The day the service was given (YYYY-MM-DD). */
    readonly servicedAt: string;
    /** When it was declared (ISO 8601). */
    readonly createdAt: string;
    /** The declarant's note, inside the envelope; `null` when none. */
    readonly note: string | null;
    /** The rejecting party's note, inside the envelope; `null` when none. */
    readonly rejectionNote: string | null;
    /** `true` when a note or a name was cut to fit the response budget. */
    readonly textTruncated: boolean;
    /** `true` when the user may confirm or reject it now (it waits on them). */
    readonly canAnswer: boolean;
}

/** Result of `list_benefit_usages`. */
export interface ListBenefitUsagesResult {
    /** The requested page, newest first. */
    readonly items: readonly BenefitUsageSummary[];
    /** Usages that match the filters, all pages and both requested sides. */
    readonly total: number;
    /** The page returned. */
    readonly page: number;
    /** The page size used. */
    readonly pageSize: number;
    /** `true` when more usages follow this page. */
    readonly hasMore: boolean;
    /**
     * Usages of this page left out to fit the response budget. The next page
     * starts after them, so ask again with a smaller pageSize to see them.
     */
    readonly omittedItems?: number;
    /**
     * Whether the user owns a directory listing (the provider side exists).
     * Absent when only the host side was asked for.
     */
    readonly isProvider?: boolean;
    /** Where the user sees the usages in the portal (host side). */
    readonly benefitUsagesUrl: string;
    /** The provider panel, when the user is a provider. */
    readonly providerPanelUrl?: string;
}

/** One side's page. The rows are projected per note length (budget fitting). */
interface SidePage {
    readonly rows: (input: { readonly noteChars: number }) => readonly BenefitUsageSummary[];
    readonly total: number;
}

/** The usage row fields the projection reads (both sides' list rows carry them). */
type UsageRow = Pick<
    HostTradeBenefitUsage,
    | 'id'
    | 'declaredBy'
    | 'status'
    | 'servicedAt'
    | 'createdAt'
    | 'note'
    | 'rejectionNote'
    | 'hostUserId'
>;

/** A wrapped excerpt, and whether it was cut. */
interface WrappedText {
    readonly text: string | null;
    readonly truncated: boolean;
}

/** Wraps third-party text excerpted to `maxChars`, or `null` when there is none. */
function wrapExcerpt(
    text: string | null | undefined,
    source: 'provider_listing' | 'host_name' | 'usage_note',
    maxChars: number
): WrappedText {
    if (!text) {
        return { text: null, truncated: false };
    }
    const excerpt = excerptText({ text, maxChars });
    return {
        text: wrapUntrustedText({ text: excerpt.text, source }),
        truncated: excerpt.truncated
    };
}

/** Wraps a party's name, excerpted; names shrink with the step, never past their cap. */
const wrapName = (
    text: string | null | undefined,
    source: 'provider_listing' | 'host_name',
    stepChars: number
) => wrapExcerpt(text, source, Math.min(NAME_EXCERPT_CHARS, stepChars));

/** The fields every projection shares; `names` are the row's wrapped names. */
function baseSummary({
    row,
    noteChars,
    names
}: {
    readonly row: UsageRow;
    readonly noteChars: number;
    readonly names: readonly WrappedText[];
}) {
    const note = wrapExcerpt(row.note, 'usage_note', noteChars);
    const rejectionNote = wrapExcerpt(row.rejectionNote, 'usage_note', noteChars);
    return {
        id: row.id,
        declaredBy: row.declaredBy,
        status: row.status,
        servicedAt: row.servicedAt,
        createdAt: new Date(row.createdAt).toISOString(),
        note: note.text,
        rejectionNote: rejectionNote.text,
        textTruncated: [note, rejectionNote, ...names].some((wrapped) => wrapped.truncated)
    };
}

/** Whether `actor` may answer the row now: PENDING, and the counterpart. */
function canAnswer({
    row,
    providerOwnerUserId,
    actor
}: {
    readonly row: UsageRow;
    readonly providerOwnerUserId: string | null;
    readonly actor: Actor;
}): boolean {
    return (
        row.status === HostTradeUsageStatusEnum.PENDING &&
        isUsageCounterpart({
            declaredBy: row.declaredBy,
            hostUserId: row.hostUserId,
            providerOwnerUserId,
            actorId: actor.id
        })
    );
}

/** The service window a side is read with. */
interface Window {
    readonly page: number;
    readonly pageSize: number;
}

/** The host side: `/usages` or the `/usages/pending` inbox. */
async function readHostSide({
    actor,
    status,
    pendingMine,
    window
}: {
    readonly actor: Actor;
    readonly status?: HostTradeUsageStatusEnum;
    readonly pendingMine: boolean;
    readonly window: Window;
}): Promise<{ readonly page: SidePage } | { readonly error: ToolErrorPayload }> {
    const service = getHostTradeUsageToolService();
    const listed = pendingMine
        ? await service.listPendingForHost(window, actor)
        : await service.listForHost({ status, ...window }, actor);
    if (listed.error) {
        return { error: listed.error };
    }
    return {
        page: {
            total: listed.data.total,
            rows: ({ noteChars }) =>
                listed.data.items.map((row) => {
                    const providerName = wrapName(
                        row.hostTrade?.name,
                        'provider_listing',
                        noteChars
                    );
                    return {
                        ...baseSummary({ row, noteChars, names: [providerName] }),
                        side: 'host',
                        provider: { slug: row.hostTrade?.slug ?? null, name: providerName.text },
                        // The other party of a host-side row is the provider.
                        counterpartName: providerName.text,
                        // A host-side row never names this actor as the listing
                        // owner (a self usage is refused at declaration).
                        canAnswer: canAnswer({ row, providerOwnerUserId: null, actor })
                    };
                })
        }
    };
}

/** The provider side: `/mine/usages`, only when the caller owns a listing. */
async function readProviderSide({
    actor,
    status,
    pendingMine,
    window
}: {
    readonly actor: Actor;
    readonly status?: HostTradeUsageStatusEnum;
    readonly pendingMine: boolean;
    readonly window: Window;
}): Promise<{ readonly page: SidePage | null } | { readonly error: ToolErrorPayload }> {
    const own = await getHostTradeToolService().getOwn(actor);
    if (own.error) {
        return { error: own.error };
    }
    const trade = own.data.trade;
    if (!trade) {
        return { page: null };
    }
    const service = getHostTradeUsageToolService();
    const [listed, linked] = await Promise.all([
        service.listForProvider(
            {
                hostTradeId: trade.id,
                status: pendingMine ? HostTradeUsageStatusEnum.PENDING : status,
                declaredBy: pendingMine ? HostTradeUsageDeclaredByEnum.HOST : undefined,
                ...window
            },
            actor
        ),
        service.listLinkedHosts({ hostTradeId: trade.id }, actor)
    ]);
    if (listed.error) {
        return { error: listed.error };
    }
    const hostNames = new Map(
        (linked.data?.hosts ?? []).map((host) => [host.id, host.displayName])
    );
    return {
        page: {
            total: listed.data.total,
            rows: ({ noteChars }) =>
                listed.data.items.map((row) => {
                    const providerName = wrapName(trade.name, 'provider_listing', noteChars);
                    const hostName = wrapName(
                        hostNames.get(row.hostUserId),
                        'host_name',
                        noteChars
                    );
                    return {
                        ...baseSummary({ row, noteChars, names: [providerName, hostName] }),
                        side: 'provider',
                        provider: { slug: trade.slug, name: providerName.text },
                        counterpartName: hostName.text,
                        canAnswer: canAnswer({
                            row,
                            providerOwnerUserId: trade.ownerUserId ?? null,
                            actor
                        })
                    };
                })
        }
    };
}

/**
 * `list_benefit_usages`: read-only. Not declared for unverified emails, exactly
 * like the routes.
 */
export const listBenefitUsagesTool = defineTool({
    name: 'list_benefit_usages',
    title: 'Mis usos de beneficio',
    description: `Lists the benefit usages of the connected Hospeda user, newest first, paginated (pageSize up to ${MCP_LIST_MAX_PAGE_SIZE}). A usage records that a host used a directory provider's benefit: one party declares it and the OTHER party confirms or rejects it. side "host" = the user used a provider's benefit; side "provider" = a host used the benefit of the user's own directory listing (only if the user is a provider, see "isProvider"); "both" (default) lists the two. Filters: status, and pendingMine: true for only the usages waiting for the user's answer. Per usage: id, side, declaredBy, status, provider, counterpartName, servicedAt, createdAt, note, rejectionNote, textTruncated (a note or name was cut) and canAnswer (true when the user may confirm or reject it now with confirm_benefit_usage or reject_benefit_usage). A REJECTED usage can be put back to PENDING with undo_benefit_rejection, only by whoever rejected it. If "omittedItems" is present, that many usages of this page did not fit: ask again with a smaller pageSize. Usages cannot be declared from here: send the user to the provider's declareUsageUrl (search_providers) or to providerPanelUrl. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: ListBenefitUsagesInputSchema,
    isWrite: false,
    handler: async ({
        actor,
        input,
        context
    }): Promise<ToolHandlerResult<ListBenefitUsagesResult>> => {
        const { side, status, pendingMine, page, pageSize } = input;
        // One side pages through the service; "both" reads each side from its
        // first row up to this page's end, then merges and cuts.
        const window: Window =
            side === 'both' ? { page: 1, pageSize: page * pageSize } : { page, pageSize };

        const host =
            side === 'provider'
                ? undefined
                : await readHostSide({ actor, status, pendingMine, window });
        if (host && 'error' in host) {
            return { error: host.error };
        }
        const provider =
            side === 'host'
                ? undefined
                : await readProviderSide({ actor, status, pendingMine, window });
        if (provider && 'error' in provider) {
            return { error: provider.error };
        }

        const pages = [host?.page, provider?.page ?? undefined].filter(
            (sidePage): sidePage is SidePage => sidePage !== undefined
        );
        const total = pages.reduce((sum, sidePage) => sum + sidePage.total, 0);
        const itemsFor = (noteChars: number) => {
            const merged = pages
                .flatMap((sidePage) => sidePage.rows({ noteChars }))
                // The services' order (newest first, then id), so a merged
                // page boundary is as stable as each side's.
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
            return side === 'both' ? merged.slice((page - 1) * pageSize, page * pageSize) : merged;
        };
        const isProvider = provider === undefined ? undefined : provider.page !== null;
        const siteUrl = env.HOSPEDA_SITE_URL;
        const build = (noteChars: number): ListBenefitUsagesResult => ({
            items: itemsFor(noteChars),
            total,
            page,
            pageSize,
            hasMore: page * pageSize < total,
            ...(isProvider === undefined ? {} : { isProvider }),
            benefitUsagesUrl: buildPortalUrl({
                destination: { kind: 'benefitUsages' },
                locale: context.locale,
                siteUrl
            }),
            ...(isProvider
                ? {
                      providerPanelUrl: buildPortalUrl({
                          destination: { kind: 'providerPanel' },
                          locale: context.locale,
                          siteUrl
                      })
                  }
                : {})
        });

        return { data: fitPageToBudget({ steps: NOTE_EXCERPT_STEPS, build }) };
    }
});
