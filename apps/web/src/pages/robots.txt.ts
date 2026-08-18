/**
 * Dynamic robots.txt endpoint.
 *
 * Returns a restrictive `Disallow: /` policy when the requesting host
 * matches one of `HOSPEDA_NOINDEX_HOSTS` (CSV; default
 * `staging.hospeda.com.ar`). Everywhere else, returns the standard
 * permissive policy with the same disallow rules the previous static
 * `public/robots.txt` had.
 *
 * Lives as an endpoint instead of `public/robots.txt` because Astro
 * serves prerendered routes through `serve-static` before the global
 * middleware runs. A static file would always reflect the production
 * policy regardless of which host is being served.
 *
 * REQ-16: The Sitemap directive is derived from `getSiteUrl()` at request
 * time so it points to the correct host on staging and local environments.
 *
 * REQ-17: `Disallow` directives for non-indexable paths are derived from
 * `SITEMAP_EXCLUDED_PATHS` (shared constant with `astro.config.mjs`) so the
 * two lists stay in sync automatically.
 *
 * HOS-369 WA-1: facet query params are additionally disallowed, derived from
 * `FACET_QUERY_PARAM_KEYS` (shared with the `rel="nofollow"` rule on the chip
 * links). This closes the combinatorial crawl trap at the source. The rules are
 * key-scoped, never a blanket `Disallow: /*?*`, so the path-based facet
 * landings stay crawlable — see `facet-crawl-policy.ts` for the full rationale.
 *
 * HOS-369 WA-4: this file is now the SINGLE statement of the site's crawler
 * policy (owner decision D-3). It previously covered only the agents it wanted
 * to welcome, while a Cloudflare managed content block — injected at the edge,
 * invisible from this repo — denied a different, overlapping set. The two
 * contradicted each other on four agents, and because RFC 9309 merges groups
 * and resolves equal-specificity conflicts in favour of the least restrictive
 * rule, this file's `Allow: /` silently won: GPTBot crawled 136,990 times/day
 * against a policy the operator believed was blocking it (spec §5.10).
 *
 * So every agent this site has an opinion about is now declared here exactly
 * once, in exactly one direction, INCLUDING the denials that used to exist only
 * at the edge. That is what makes it safe to turn the managed block off.
 *
 * ⚠️ Operational prerequisite: the Cloudflare managed content block must be
 * DISABLED in the dashboard for this file to actually be the policy in force.
 * Until then `Google-Extended` stays contradictory (allowed here, denied there)
 * — the one residual conflict, asserted explicitly in
 * `test/lib/seo/robots-policy.test.ts`.
 */

import { CACHE_TAG_SITE_CONFIG } from '@repo/cache-tags';
import type { APIRoute } from 'astro';
import { buildStaticCacheHeaders } from '@/lib/cache/response-cache';
import { getNoindexHosts, getSiteUrl } from '@/lib/env';
import { buildFacetDisallowDirectives } from '@/lib/filters/facet-crawl-policy';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import { SITEMAP_EXCLUDED_PATHS } from '@/lib/seo-config';

export const prerender = false;

const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/**
 * AI user-agents we explicitly WELCOME — the ones that produce citations.
 *
 * Policy (HOS-369 WA-4, owner-approved): Hospeda wants to be *cited* by AI
 * assistants; it gains nothing measurable from being inside a training corpus,
 * and training crawlers were costing ~30 % of all bot traffic (§5.9). So the
 * line is drawn on **citation vs training**, not "AI vs not AI", and each side
 * is stated explicitly rather than left to the `*` fallthrough.
 *
 * Each entry is verified against the vendor's own documentation:
 *
 * - `OAI-SearchBot` — the ONLY agent that governs ChatGPT search inclusion.
 *   OpenAI: "Sites that are opted out of OAI-SearchBot will not be shown in
 *   ChatGPT search answers." Blocking `GPTBot` does NOT remove a site from
 *   ChatGPT search.
 * - `ChatGPT-User` — user-initiated live fetch (a user asks ChatGPT to open the
 *   page). Not an automatic crawler.
 * - `Claude-User` — Anthropic's user-directed live retrieval.
 * - `Claude-SearchBot` — Anthropic's search-quality indexer. Both of these were
 *   previously UNNAMED here while the training bot `ClaudeBot` was explicitly
 *   allowed — exactly backwards. Naming them is the fix.
 * - `PerplexityBot` — Perplexity's citation index.
 * - `Google-Extended` — NOT a crawler at all: it issues no HTTP requests of its
 *   own and is purely a robots token. Blocking it saves ZERO bytes while
 *   removing the site from Gemini Apps / Vertex AI **grounding**. Google also
 *   documents that it "does not impact a site's inclusion in Google Search nor
 *   is it used as a ranking signal", so allowing it carries no search-side risk
 *   either. Denying it would be a strictly losing trade.
 */
const AI_CITATION_USER_AGENTS = [
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-User',
    'Claude-SearchBot',
    'PerplexityBot',
    'Google-Extended'
] as const;

/**
 * Classic search-engine crawlers named EXPLICITLY (HOS-585 G-3).
 *
 * These emit the same block `*` already grants, so naming them changes nothing
 * about what any crawler may fetch today. That is the point, and it is worth
 * stating plainly so nobody deletes this list as dead weight:
 *
 * WA-4's rule (owner decision D-3) is that every agent this site has an opinion
 * about is declared here **exactly once, in exactly one direction**. Bing was the
 * one search engine the site actively cares about that had no opinion recorded —
 * it survived only by falling through to `*`. That is fine until someone narrows
 * `*` for an unrelated reason, at which point Bing loses access as collateral
 * damage and nothing in this file shows that a decision was ever made about it.
 * An explicit block turns a silent inheritance into a stated policy.
 *
 * `Googlebot` is deliberately NOT here. It is not an omission: `Google-Extended`
 * above governs Gemini grounding and is a robots token only, while Googlebot
 * itself has never been in question and adding it would imply this list is the
 * complete set of allowed crawlers — it is not. `*` is.
 *
 * Bing's other tokens (`adidxbot` for Bing Ads, the retired `msnbot` /
 * `BingPreview`) are out of scope: `bingbot` is the one that governs organic
 * search inclusion, which is what HOS-585 is about.
 */
const SEARCH_ENGINE_USER_AGENTS = ['bingbot'] as const;

/**
 * User-agents denied the whole site (`Disallow: /`).
 *
 * Two groups, one rule:
 *
 * 1. **Training-only crawlers** — `GPTBot` (OpenAI model training, 136,990
 *    requests/day in the §5.9 baseline), `ClaudeBot` (Anthropic training),
 *    `anthropic-ai` (Anthropic's legacy token, undocumented today but still
 *    observed), `CCBot` (Common Crawl). They cost real egress and buy no
 *    citation — every citation path is allowed above.
 * 2. **The list Cloudflare's managed block used to own.** These were denied ONLY
 *    by the edge block, never by this file. Reconciling the two sources into one
 *    policy (D-3) means the app file has to carry them, or turning the managed
 *    block off in the Cloudflare dashboard would silently re-open Bytespider &
 *    co. and — critically — drop `Applebot-Extended`, which is the Apple
 *    Intelligence training opt-out that owner decision D-4 requires be kept.
 *
 * `Applebot` itself is deliberately absent: it is a real search crawler (Siri,
 * Spotlight, Safari suggestions) and blocking it costs real visibility. It is
 * also the single largest source of load (326,810 requests/day). D-1 keeps it
 * allowed; WA-5 measures it after Wave A before any decision is reconsidered.
 */
const BLOCKED_USER_AGENTS = [
    // Training-only
    'GPTBot',
    'ClaudeBot',
    'anthropic-ai',
    'CCBot',
    // Previously denied only by Cloudflare's managed block
    'Applebot-Extended',
    'Amazonbot',
    'Bytespider',
    'meta-externalagent',
    'CloudflareBrowserRenderingCrawler'
] as const;

/**
 * Privileged paths that must stay disallowed for EVERY crawler.
 *
 * Combines the hardcoded private/auth paths with the shared
 * `SITEMAP_EXCLUDED_PATHS` (single source of truth with `astro.config.mjs`).
 * In robots.txt a named `User-agent` block does NOT inherit the `*` block's
 * rules, so this list is repeated verbatim in every agent block we emit.
 */
const DISALLOW_PATHS: ReadonlyArray<string> = [
    '/api/',
    '/*/mi-cuenta/',
    '/*/signin',
    '/*/signup',
    '/*/forgot-password',
    '/*/reset-password',
    '/*/verify-email',
    '/*/verify-email-sent',
    '/_server-islands/',
    ...SITEMAP_EXCLUDED_PATHS
];

/**
 * Build an ALLOW block: the agent line, an `Allow: /`, the full
 * {@link DISALLOW_PATHS} list, and the facet query-param `Disallow`s (HOS-369
 * WA-1). Used for `*` and each citation agent so the disallow rules can never
 * drift between blocks — in robots.txt a named block does NOT inherit the `*`
 * rules, so both lists are repeated verbatim in every block.
 *
 * @param userAgent - The robots.txt user-agent token (e.g. `*`, `OAI-SearchBot`)
 * @returns The multi-line block (no trailing blank line)
 */
function buildAgentBlock(userAgent: string): string {
    const disallowLines = DISALLOW_PATHS.map((path) => `Disallow: ${path}`).join('\n');
    const facetLines = buildFacetDisallowDirectives().join('\n');
    return `User-agent: ${userAgent}\nAllow: /\n${disallowLines}\n${facetLines}`;
}

/**
 * Build a DENY block. A bare `Disallow: /` already covers every path, so the
 * scoped rules are deliberately NOT repeated here — adding an `Allow: /` or the
 * facet list would only weaken or muddy an unconditional block.
 *
 * @param userAgent - The robots.txt user-agent token (e.g. `GPTBot`)
 * @returns The two-line block (no trailing blank line)
 */
function buildBlockedAgentBlock(userAgent: string): string {
    return `User-agent: ${userAgent}\nDisallow: /`;
}

/**
 * Build the robots.txt body for indexable hosts.
 *
 * Emits, in order: the `*` block, one allow block per search engine, one allow
 * block per citation agent, one deny block per blocked agent, then the Sitemap
 * directive. Every agent this site has an opinion about is named exactly once, in
 * exactly one direction — that single statement is the point of WA-4 (owner
 * decision D-3).
 *
 * @returns The robots.txt content string
 */
function buildPermissiveBody(): string {
    const siteUrl = getSiteUrl().replace(/\/$/, '');
    const sitemapUrl = `${siteUrl}/sitemap-index.xml`;

    const blocks = [
        buildAgentBlock('*'),
        ...SEARCH_ENGINE_USER_AGENTS.map((ua) => buildAgentBlock(ua)),
        ...AI_CITATION_USER_AGENTS.map((ua) => buildAgentBlock(ua)),
        ...BLOCKED_USER_AGENTS.map((ua) => buildBlockedAgentBlock(ua))
    ];

    return `${blocks.join('\n\n')}\n\nSitemap: ${sitemapUrl}\n`;
}

const NOINDEX_BODY = `User-agent: *
Disallow: /
`;

export const GET: APIRoute = ({ request }) => {
    const host = (request.headers.get('host') ?? '').toLowerCase();
    const isNoindexHost = NOINDEX_HOSTS.includes(host);
    const body = isNoindexHost ? NOINDEX_BODY : buildPermissiveBody();

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // This response bypasses middleware (the `.txt` extension short-circuits
            // `isStaticAssetRoute`), so it must carry its own `Cache-Control` +
            // `Cache-Tag` — the Step 11 collector never sees it (HOS-369 W1-1).
            // The helper namespaces the tag by deployment environment and demotes
            // the response to `private` if it cannot (HOS-369 W1-2).
            ...buildStaticCacheHeaders({
                cacheControl: 'public, max-age=3600',
                tags: [CACHE_TAG_SITE_CONFIG]
            }),
            ...(isNoindexHost && { 'X-Robots-Tag': 'noindex, nofollow' })
        }
    });
};
