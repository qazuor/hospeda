/**
 * @file hero-avatar.ts
 * @description URL builder for the hero social-proof reviewer avatars.
 *
 * The avatars render as ~30 px circles (up to ~46 px on large screens), so
 * serving the stored original (a 2.75 MB 1902x1920 JPG on staging, HOS-2572)
 * wastes the whole mobile LCP budget. Cloudinary URLs get a server-side
 * 92x92 fill crop (2x of the largest displayed size); any other host
 * (e.g. Unsplash seed data) passes through `getMediaUrl` unchanged.
 */
import { getMediaUrl } from '@repo/media';

/** Cloudinary transform: 92x92 (2x of the max 46 px display size), face-aware fill crop. */
export const HERO_AVATAR_TRANSFORM = 'w_92,h_92,c_fill,g_face,q_auto,f_auto' as const;

/**
 * Builds the optimized `src` for a hero social-proof avatar.
 *
 * @param params - Receive-object.
 * @param params.url - The stored reviewer avatar URL.
 * @returns The transformed URL for Cloudinary sources, otherwise the original URL.
 */
export function buildHeroAvatarUrl({ url }: { readonly url: string }): string {
    return getMediaUrl(url, { raw: HERO_AVATAR_TRANSFORM });
}
