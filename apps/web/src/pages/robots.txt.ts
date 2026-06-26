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
 */

import { getNoindexHosts, getSiteUrl } from '@/lib/env';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import { SITEMAP_EXCLUDED_PATHS } from '@/lib/seo-config';
import type { APIRoute } from 'astro';

export const prerender = false;

const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/**
 * AI / LLM crawler user-agents we explicitly welcome.
 *
 * Decision (AEO): Hospeda is a discovery platform for tourism in the Litoral
 * region. Visibility inside AI assistant answers and presence in model
 * knowledge benefits the brand far more than it risks, so we ALLOW these
 * crawlers explicitly rather than relying on the default `*` permissiveness.
 * An explicit per-bot block is clearer to operators and to the bots'
 * compliance tooling. Revisit this if proprietary editorial content (paid
 * guides, gated reviews) is added that we would not want reproduced verbatim.
 *
 * Covers OpenAI (GPTBot, OAI-SearchBot, ChatGPT-User), Anthropic (ClaudeBot,
 * anthropic-ai), Perplexity (PerplexityBot), Google's AI training opt-in token
 * (Google-Extended), and Common Crawl (CCBot, used to train many models).
 */
const AI_CRAWLER_USER_AGENTS = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'CCBot'
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
 * Build a single `User-agent` block: the agent line, an `Allow: /`, and the
 * full {@link DISALLOW_PATHS} list. Used for `*` and each AI crawler so the
 * disallow rules can never drift between blocks.
 *
 * @param userAgent - The robots.txt user-agent token (e.g. `*`, `GPTBot`)
 * @returns The multi-line block (no trailing blank line)
 */
function buildAgentBlock(userAgent: string): string {
    const disallowLines = DISALLOW_PATHS.map((path) => `Disallow: ${path}`).join('\n');
    return `User-agent: ${userAgent}\nAllow: /\n${disallowLines}`;
}

/**
 * Build the permissive robots.txt body for indexable hosts.
 *
 * Emits one block for `*` plus an explicit block per AI crawler (each repeating
 * the same Allow + Disallow rules, because named blocks do not inherit `*`),
 * then the Sitemap directive. The Sitemap URL and the Disallow lines for
 * excluded paths are derived from shared constants so they can never drift.
 *
 * @returns The robots.txt content string
 */
function buildPermissiveBody(): string {
    const siteUrl = getSiteUrl().replace(/\/$/, '');
    const sitemapUrl = `${siteUrl}/sitemap-index.xml`;

    const blocks = [
        buildAgentBlock('*'),
        ...AI_CRAWLER_USER_AGENTS.map((ua) => buildAgentBlock(ua))
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
            'Cache-Control': 'public, max-age=3600',
            ...(isNoindexHost && { 'X-Robots-Tag': 'noindex, nofollow' })
        }
    });
};
