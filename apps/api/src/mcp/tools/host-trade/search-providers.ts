/**
 * @file search-providers.ts
 * @description Tool `search_providers` (HOS-2332, spec HOS-2335 §6.7, AC-C34):
 * the host's provider directory, searched and paged.
 *
 * Same read as `GET /api/v1/protected/host-trades`: `HostTradeService.listForHost`
 * gated on `HOST_TRADE_VIEW` (checked by the service itself) and scoped
 * server-side to the destinations of the caller's own accommodations. The
 * `category` filter is handed to the service exactly as the route hands its
 * `categories` query (HOS-919 catalog slugs, any-of). `query` and
 * `destinationId` filter the already-scoped list here, and the page is cut
 * here, because the list is small and has no paging of its own (§6.7). A
 * provider outside the host's destinations is never in that list, so no filter
 * can surface it.
 *
 * Projection: only fields of `HostTradePublicSchema`, the route's own response
 * schema. The structured `benefitType`/`benefitValue` and the declaration
 * suspension are not in it, so they are not here either.
 *
 * Everything the provider wrote (name, benefit, contact, schedule) is returned
 * inside the untrusted-data envelope (C-5). Declaring a usage is not something
 * the assistant does (NG-8): each provider carries the portal link where the
 * host declares one.
 *
 * A caller without `HOST_TRADE_VIEW` (not a host) gets the service's FORBIDDEN,
 * mapped to a message and a link to the directory page, which explains who may
 * use it.
 */

import { buildPortalUrl, type PortalLocale } from '@repo/portal-routes';
import { HostTradeCatalogSlugSchema, ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { env } from '../../../utils/env';
import { contentWordsOf, tokenizeHelpText } from '../help/help-search';
import { listCreationDestinations } from '../listing/listing-creation-catalog';
import { excerptText, MCP_LIST_MAX_PAGE_SIZE, MCP_TEXT_EXCERPT_CHARS } from '../response-budget';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { UNTRUSTED_DATA_NOTICE, wrapUntrustedText } from '../untrusted-data';
import { fitPageToBudget } from './fit-page-to-budget';
import { getHostTradeToolService } from './host-trade-tool-services';

/** Providers per page when the call does not say. */
export const SEARCH_PROVIDERS_DEFAULT_PAGE_SIZE = 10;

/** Reason of the refusal a caller who is not a host gets. */
export const PROVIDER_DIRECTORY_HOSTS_ONLY_REASON = 'PROVIDER_DIRECTORY_HOSTS_ONLY';

/** Spanish messages for the reasons this tool can answer with. */
export const SEARCH_PROVIDERS_REASON_MESSAGES: Readonly<Record<string, string>> = {
    [PROVIDER_DIRECTORY_HOSTS_ONLY_REASON]:
        'El directorio de proveedores es un beneficio para anfitriones de Hospeda: tu cuenta todavía no tiene acceso. En la página del directorio se explica cómo obtenerlo.'
};

/**
 * Excerpt lengths tried in order until the page fits the response budget. The
 * provider's texts have no length cap at write time, so every one is cut.
 */
const TEXT_EXCERPT_STEPS: readonly number[] = [
    MCP_TEXT_EXCERPT_CHARS,
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 2),
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 4),
    Math.floor(MCP_TEXT_EXCERPT_CHARS / 10)
];

/** Longest excerpt of the short texts (name, contact, schedule), whatever the step. */
const SHORT_TEXT_MAX_CHARS = 200;

/** Input schema of `search_providers`. One flat object (C-2). */
export const SearchProvidersInputSchema = z
    .object({
        query: z
            .string()
            .trim()
            .min(1)
            .max(100)
            // Only filler words ("de la", "para que") would match the whole
            // directory, which answers a question nobody asked.
            .refine((query) => contentWordsOf({ text: query }).length > 0, {
                message:
                    'query has no searchable word (only short or filler words); use a more specific term, for example "plomero", or omit query'
            })
            .optional()
            .describe(
                'Words to look for in the provider name and benefit, for example "plomero" or "descuento". Accents and case are ignored; every meaningful word must match (filler words are ignored).'
            ),
        category: HostTradeCatalogSlugSchema.optional().describe(
            'Only providers of this directory category (its slug, from the "categories" of a previous result, for example "plomeria").'
        ),
        destinationId: z
            .uuid()
            .optional()
            .describe(
                'Only providers of this destination (its id, from the "destination" of a previous result).'
            ),
        page: z.number().int().min(1).default(1).describe('Page number, starting at 1.'),
        pageSize: z
            .number()
            .int()
            .min(1)
            .max(MCP_LIST_MAX_PAGE_SIZE)
            .default(SEARCH_PROVIDERS_DEFAULT_PAGE_SIZE)
            .describe(`Providers per page, up to ${MCP_LIST_MAX_PAGE_SIZE}.`)
    })
    .strict();

/** One provider in the result. */
export interface ProviderSummary {
    /** The provider's slug (its address in the portal). */
    readonly slug: string;
    /** Name inside the untrusted-data envelope. */
    readonly name: string;
    /** Directory categories, in catalog order, with their Spanish label. */
    readonly categories: readonly { readonly slug: string; readonly label: string }[];
    /** The benefit's fine print (an excerpt, see `textTruncated`), inside the envelope. */
    readonly benefit: string;
    /** `true` when a text of this provider was cut to fit the response budget. */
    readonly textTruncated: boolean;
    /** How to reach the provider, inside the envelope. */
    readonly contact: string;
    /** Opening hours as the provider wrote them, inside the envelope; `null` when none. */
    readonly schedule: string | null;
    /** Whether the provider answers around the clock. */
    readonly is24h: boolean;
    /** The destination the provider works in; `name` is `null` when it could not be read. */
    readonly destination: { readonly id: string; readonly name: string | null };
    /** The directory's counters. */
    readonly confirmedUsesCount: number;
    readonly distinctHostsCount: number;
    readonly reviewsCount: number;
    readonly averageRating: number;
    /** The provider's page in the portal directory. */
    readonly directoryUrl: string;
    /** The portal page where the host declares a usage of this benefit. */
    readonly declareUsageUrl: string;
}

/** Result of `search_providers`. */
export interface SearchProvidersResult {
    /** The requested page, in directory order. */
    readonly items: readonly ProviderSummary[];
    /** Providers that match the filters, all pages. */
    readonly total: number;
    /** The page returned. */
    readonly page: number;
    /** The page size used. */
    readonly pageSize: number;
    /** `true` when more providers follow this page. */
    readonly hasMore: boolean;
    /**
     * Providers of this page left out to fit the response budget. The next page
     * starts after them, so ask again with a smaller pageSize to see them.
     */
    readonly omittedItems?: number;
}

/** The directory row fields the tool reads (a subset of `HostTradePublicSchema`). */
interface DirectoryRow {
    readonly slug: string;
    readonly name: string;
    readonly categories?: readonly {
        readonly slug: string;
        readonly nameI18n: { readonly es: string };
    }[];
    readonly benefit: string;
    readonly contact: string;
    readonly scheduleText?: string | null;
    readonly is24h?: boolean | null;
    readonly destinationId: string;
    readonly confirmedUsesCount?: number | null;
    readonly distinctHostsCount?: number | null;
    readonly reviewsCount?: number | null;
    readonly averageRating?: number | null;
}

/**
 * Whether a row matches every word of the query, in its name or benefit.
 *
 * @param args - The row and the query's normalized words
 * @returns `true` when every word appears
 */
export function matchesProviderQuery({
    row,
    queryWords
}: {
    readonly row: Pick<DirectoryRow, 'name' | 'benefit'>;
    readonly queryWords: readonly string[];
}): boolean {
    const haystack = tokenizeHelpText({ text: `${row.name} ${row.benefit}` }).join(' ');
    return queryWords.every((word) => haystack.includes(word));
}

/** Projects one row, excerpting its texts to `textChars`. */
function toSummary({
    row,
    destinationNames,
    textChars,
    locale
}: {
    readonly row: DirectoryRow;
    readonly destinationNames: ReadonlyMap<string, string>;
    readonly textChars: number;
    readonly locale: PortalLocale | undefined;
}): ProviderSummary {
    const shortChars = Math.min(textChars, SHORT_TEXT_MAX_CHARS);
    const name = excerptText({ text: row.name, maxChars: shortChars });
    const benefit = excerptText({ text: row.benefit, maxChars: textChars });
    const contact = excerptText({ text: row.contact, maxChars: shortChars });
    const schedule = row.scheduleText
        ? excerptText({ text: row.scheduleText, maxChars: shortChars })
        : null;
    const siteUrl = env.HOSPEDA_SITE_URL;
    return {
        slug: row.slug,
        name: wrapUntrustedText({ text: name.text, source: 'provider_listing' }),
        categories: (row.categories ?? []).map((category) => ({
            slug: category.slug,
            label: category.nameI18n.es
        })),
        benefit: wrapUntrustedText({ text: benefit.text, source: 'provider_listing' }),
        textTruncated:
            name.truncated ||
            benefit.truncated ||
            contact.truncated ||
            (schedule?.truncated ?? false),
        contact: wrapUntrustedText({ text: contact.text, source: 'provider_listing' }),
        schedule: schedule
            ? wrapUntrustedText({ text: schedule.text, source: 'provider_listing' })
            : null,
        is24h: row.is24h ?? false,
        destination: {
            id: row.destinationId,
            name: destinationNames.get(row.destinationId) ?? null
        },
        confirmedUsesCount: row.confirmedUsesCount ?? 0,
        distinctHostsCount: row.distinctHostsCount ?? 0,
        reviewsCount: row.reviewsCount ?? 0,
        averageRating: row.averageRating ?? 0,
        directoryUrl: buildPortalUrl({
            destination: { kind: 'providerDirectory', slug: row.slug },
            locale,
            siteUrl
        }),
        declareUsageUrl: buildPortalUrl({
            destination: { kind: 'declareBenefitUsage', slug: row.slug },
            locale,
            siteUrl
        })
    };
}

/** The destination names, by id. An unreadable catalog yields an empty map. */
async function readDestinationNames(): Promise<ReadonlyMap<string, string>> {
    const destinations = await listCreationDestinations();
    return new Map((destinations ?? []).map((destination) => [destination.id, destination.name]));
}

/**
 * `search_providers`: read-only. Not declared for unverified emails, exactly
 * like the route (which declares no `emailUnverifiedOperation`).
 */
export const searchProvidersTool = defineTool({
    name: 'search_providers',
    title: 'Buscar proveedores',
    description: `Searches the provider directory of the connected Hospeda host: the service providers (plumbers, electricians, cleaning...) that offer Hospeda hosts a benefit, in the destinations where the host has accommodations. Only hosts have access. Filters: query (words in the name or benefit), category (a category slug) and destinationId; paginated (pageSize up to ${MCP_LIST_MAX_PAGE_SIZE}), with "total" and "hasMore". Per provider: slug, name, categories, benefit (its fine print), contact, schedule, is24h, destination, confirmedUsesCount, distinctHostsCount, reviewsCount, averageRating, the directory link (directoryUrl) and the link where the host declares a usage of the benefit (declareUsageUrl). Texts may be excerpts: "textTruncated" says when one was cut; the full text is on directoryUrl. If "omittedItems" is present, that many providers of this page did not fit: ask again with a smaller pageSize. You cannot declare a usage from here: when the user wants to, give them declareUsageUrl. ${UNTRUSTED_DATA_NOTICE}`,
    inputSchema: SearchProvidersInputSchema,
    isWrite: false,
    reasonMessages: SEARCH_PROVIDERS_REASON_MESSAGES,
    refusalAction: ({ error }) =>
        error.code === ServiceErrorCode.FORBIDDEN
            ? { destination: { kind: 'providerDirectory' } }
            : undefined,
    handler: async ({
        actor,
        input,
        context
    }): Promise<ToolHandlerResult<SearchProvidersResult>> => {
        const { query, category, destinationId, page, pageSize } = input;

        const listed = await getHostTradeToolService().listForHost(
            actor,
            undefined,
            category === undefined ? undefined : { categories: [category] }
        );
        if (listed.error) {
            return listed.error.code === ServiceErrorCode.FORBIDDEN
                ? { error: { ...listed.error, reason: PROVIDER_DIRECTORY_HOSTS_ONLY_REASON } }
                : { error: listed.error };
        }

        const queryWords = query === undefined ? [] : contentWordsOf({ text: query });
        const matching = listed.data.trades.filter(
            (row) =>
                (destinationId === undefined || row.destinationId === destinationId) &&
                matchesProviderQuery({ row, queryWords })
        );
        const pageRows = matching.slice((page - 1) * pageSize, page * pageSize);
        const destinationNames =
            pageRows.length === 0 ? new Map<string, string>() : await readDestinationNames();

        const build = (textChars: number): SearchProvidersResult => ({
            items: pageRows.map((row) =>
                toSummary({ row, destinationNames, textChars, locale: context.locale })
            ),
            total: matching.length,
            page,
            pageSize,
            hasMore: page * pageSize < matching.length
        });
        return { data: fitPageToBudget({ steps: TEXT_EXCERPT_STEPS, build }) };
    }
});
