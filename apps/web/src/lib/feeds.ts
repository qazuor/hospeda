/**
 * @fileoverview
 * RSS feed generation helpers for blog posts and events.
 *
 * Provides fetch + build functions used by the per-locale RSS endpoints:
 *   - GET /[lang]/publicaciones/rss.xml
 *   - GET /[lang]/eventos/rss.xml
 *
 * All fetch functions degrade gracefully: any network error, HTTP error, or
 * JSON parse failure returns an empty array so the RSS endpoint always returns
 * a valid (possibly empty) channel instead of a 500.
 */

import rss from '@astrojs/rss';
import type { SupportedLocale } from './i18n';
import { SUPPORTED_LOCALES } from './i18n';
import { buildUrl } from './urls';

/** Maximum number of items included in a single RSS feed. */
export const RSS_FEED_SIZE = 50;

/** Post item shape expected from the public posts API list response. */
export interface PostFeedItem {
    readonly slug: string;
    readonly title?: string;
    readonly summary?: string;
    readonly publishedAt?: string;
    readonly createdAt?: string;
}

/** Event item shape expected from the public events API list response. */
export interface EventFeedItem {
    readonly slug: string;
    readonly name?: string;
    readonly title?: string;
    readonly summary?: string;
    readonly description?: string;
    readonly date?: { readonly start?: string };
    readonly startDate?: string;
    readonly createdAt?: string;
}

interface ListApiData<T> {
    readonly data: readonly T[];
}

interface ListApiResponse<T> {
    readonly ok?: boolean;
    readonly success?: boolean;
    readonly data?: ListApiData<T>;
}

/**
 * Validate that a locale string is one of the supported locales.
 *
 * @param lang - Raw value from the URL `[lang]` param.
 * @returns The validated locale, or `null` when the value is unsupported.
 */
export function validateLocale(lang: string | undefined): SupportedLocale | null {
    if (!lang || !(SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
        return null;
    }
    return lang as SupportedLocale;
}

/**
 * Fetch the most recent published posts from the public API.
 * Returns an empty array on any fetch / parse failure.
 *
 * @param apiUrl - API base URL without trailing slash.
 * @returns Array of post feed items (at most RSS_FEED_SIZE entries).
 */
export async function fetchLatestPosts({
    apiUrl
}: {
    readonly apiUrl: string;
}): Promise<readonly PostFeedItem[]> {
    const searchParams = new URLSearchParams({
        page: '1',
        pageSize: String(RSS_FEED_SIZE),
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        status: 'published'
    });

    try {
        const response = await fetch(`${apiUrl}/api/v1/public/posts?${searchParams.toString()}`, {
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) return [];

        const json = (await response.json()) as ListApiResponse<PostFeedItem>;
        if (!json.ok && !json.success) return [];

        const data = json.data;
        if (!data || !Array.isArray(data.data)) return [];

        return data.data;
    } catch {
        return [];
    }
}

/**
 * Fetch the most recent published events from the public API.
 * Returns an empty array on any fetch / parse failure.
 *
 * @param apiUrl - API base URL without trailing slash.
 * @returns Array of event feed items (at most RSS_FEED_SIZE entries).
 */
export async function fetchLatestEvents({
    apiUrl
}: {
    readonly apiUrl: string;
}): Promise<readonly EventFeedItem[]> {
    const searchParams = new URLSearchParams({
        page: '1',
        pageSize: String(RSS_FEED_SIZE),
        sortBy: 'startDate',
        sortOrder: 'asc',
        status: 'published'
    });

    try {
        const response = await fetch(`${apiUrl}/api/v1/public/events?${searchParams.toString()}`, {
            signal: AbortSignal.timeout(15_000)
        });

        if (!response.ok) return [];

        const json = (await response.json()) as ListApiResponse<EventFeedItem>;
        if (!json.ok && !json.success) return [];

        const data = json.data;
        if (!data || !Array.isArray(data.data)) return [];

        return data.data;
    } catch {
        return [];
    }
}

/**
 * Build the RSS feed Response for blog posts.
 *
 * Uses `rss()` from `@astrojs/rss` internally and sets the Cache-Control
 * header to match the sitemap strategy (public, 24h SWR).
 *
 * @param locale - Validated locale for link construction.
 * @param siteUrl - Site base URL without trailing slash.
 * @param posts - Post items fetched from the API.
 * @returns RSS Response with correct Content-Type and Cache-Control headers.
 */
export async function buildPostsFeed({
    locale,
    siteUrl,
    posts
}: {
    readonly locale: SupportedLocale;
    readonly siteUrl: string;
    readonly posts: readonly PostFeedItem[];
}): Promise<Response> {
    const feedTitle =
        locale === 'en'
            ? 'Hospeda - Blog'
            : locale === 'pt'
              ? 'Hospeda - Blog'
              : 'Hospeda - Publicaciones';

    const feedDescription =
        locale === 'en'
            ? 'Latest blog posts about tourism in the Argentine Litoral'
            : locale === 'pt'
              ? 'Últimas publicações sobre turismo no Litoral Argentino'
              : 'Últimas publicaciones sobre turismo en el Litoral Entrerriano';

    const feedResponse = await rss({
        title: feedTitle,
        description: feedDescription,
        site: siteUrl,
        items: posts.map((post) => {
            const slug = String(post.slug);
            const title = String(post.title ?? slug);
            const description = String(post.summary ?? '');
            const rawDate = post.publishedAt ?? post.createdAt;
            const pubDate = rawDate ? new Date(rawDate) : new Date();
            const link = `${siteUrl}${buildUrl({ locale, path: `publicaciones/${slug}` })}`;

            return { title, link, pubDate, description };
        })
    });

    feedResponse.headers.set(
        'Cache-Control',
        'public, max-age=86400, stale-while-revalidate=86400'
    );

    return feedResponse;
}

/**
 * Build the RSS feed Response for events.
 *
 * Uses `rss()` from `@astrojs/rss` internally and sets the Cache-Control
 * header to match the sitemap strategy (public, 24h SWR).
 *
 * @param locale - Validated locale for link construction.
 * @param siteUrl - Site base URL without trailing slash.
 * @param events - Event items fetched from the API.
 * @returns RSS Response with correct Content-Type and Cache-Control headers.
 */
export async function buildEventsFeed({
    locale,
    siteUrl,
    events
}: {
    readonly locale: SupportedLocale;
    readonly siteUrl: string;
    readonly events: readonly EventFeedItem[];
}): Promise<Response> {
    const feedTitle =
        locale === 'en'
            ? 'Hospeda - Events'
            : locale === 'pt'
              ? 'Hospeda - Eventos'
              : 'Hospeda - Eventos';

    const feedDescription =
        locale === 'en'
            ? 'Upcoming events and activities in the Argentine Litoral region'
            : locale === 'pt'
              ? 'Próximos eventos e atividades na região do Litoral Argentino'
              : 'Próximos eventos y actividades en el Litoral Entrerriano';

    const feedResponse = await rss({
        title: feedTitle,
        description: feedDescription,
        site: siteUrl,
        items: events.map((event) => {
            const slug = String(event.slug);
            const title = String(event.name ?? event.title ?? slug);
            const description = String(event.summary ?? event.description ?? '');
            const rawDate = event.date?.start ?? event.startDate ?? event.createdAt;
            const pubDate = rawDate ? new Date(rawDate) : new Date();
            const link = `${siteUrl}${buildUrl({ locale, path: `eventos/${slug}` })}`;

            return { title, link, pubDate, description };
        })
    });

    feedResponse.headers.set(
        'Cache-Control',
        'public, max-age=86400, stale-while-revalidate=86400'
    );

    return feedResponse;
}
