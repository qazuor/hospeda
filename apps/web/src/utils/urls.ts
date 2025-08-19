import type { AccommodationType, DestinationType, EventType, PostType } from '@repo/types';
import { normalizeTrailingSlash } from '@reunmedia/astro-normalize-trailing-slash';

/**
 * Returns the public URL for a given post.
 * By default: `/blog/[slug]`
 */
export function getPostUrl(post: Pick<PostType, 'slug'>): string {
    return normalizeTrailingSlash(`/blog/${post.slug}`);
}

/**
 * Returns the public URL for a given destination.
 * Default: `/destinos/[slug]`
 */
export function getDestinationUrl(destination: Pick<DestinationType, 'slug'>): string {
    return normalizeTrailingSlash(`/destinos/${destination.slug}`);
}

/**
 * Returns the public URL for a given accommodation.
 * Default: `/alojamientos/[slug]`
 */
export function getAccommodationUrl(accommodation: Pick<AccommodationType, 'slug'>): string {
    return normalizeTrailingSlash(`/alojamientos/${accommodation.slug}`);
}

/**
 * Returns the public URL for a given event.
 * Default: `/eventos/[slug]`
 */
export function getEventUrl(event: Pick<EventType, 'slug'>): string {
    return normalizeTrailingSlash(`/eventos/${event.slug}`);
}

/**
 * Returns the public URL.
 * Default: url with trailing slash
 */
export function getUrl(url: string): string {
    return normalizeTrailingSlash(url);
}

export const getHomeUrl = (): string => getUrl('/');
export const getAccommodationsIndexUrl = (): string => getUrl('/alojamientos');
export const getDestinationsIndexUrl = (): string => getUrl('/destinos');
export const getEventsIndexUrl = (): string => getUrl('/eventos');
export const getBlogIndexUrl = (): string => getUrl('/blog');
