/**
 * @file video-embed.ts
 * @description Derives a safe, provider-verified embed URL from a host-authored
 * video link (HOS-1022).
 *
 * This is a security boundary, not a convenience: the input is a string a host
 * typed into the editor, and the output ends up as an `<iframe src>`. The rule
 * that keeps that safe is "extract an id, validate it, rebuild the URL from a
 * fixed template" — never "pass the user's URL through with light edits". A
 * text-substitution approach (e.g. swapping `watch?v=` for `embed/`) would let
 * through anything that merely *looks* like a provider URL, including a
 * `youtube.com` used only as a userinfo/subdomain decoy
 * (`https://youtube.com@evil.com/...` or `https://youtube.com.evil.com/...`).
 *
 * Only three providers are recognized — the ones the host editor's copy
 * promises (`VideoGalleryField.tsx`): YouTube, Vimeo, Dailymotion. Anything
 * else, or anything that fails id validation, resolves to `null` and MUST NOT
 * be rendered (not linked raw, not shown "just in case").
 */

/** The three video providers the editor promises support for. */
export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion';

/** Result of successfully resolving a host-authored video URL. */
export interface ResolvedVideoEmbed {
    /** Which provider matched. */
    readonly provider: VideoProvider;
    /**
     * The embed `src` to use in an `<iframe>`, built from a fixed
     * per-provider template plus the validated id — never the input URL.
     */
    readonly embedUrl: string;
    /** The extracted, validated provider-native video id. */
    readonly videoId: string;
}

/** Exact hostnames (never a suffix/substring match) recognized per provider. */
const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com'
]);
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com']);
const VIMEO_PLAYER_HOSTS = new Set(['player.vimeo.com']);
const DAILYMOTION_HOSTS = new Set(['dailymotion.com', 'www.dailymotion.com']);
const DAILYMOTION_SHORT_HOSTS = new Set(['dai.ly', 'www.dai.ly']);

/** YouTube video ids are always exactly 11 base64url-alphabet characters. */
const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
/** Vimeo video ids are numeric, historically up to ~10 digits. */
const VIMEO_ID_REGEX = /^\d{1,12}$/;
/** Dailymotion ids are alphanumeric (typically 7-8 chars, e.g. `x7tgad0`). */
const DAILYMOTION_ID_REGEX = /^[A-Za-z0-9]{4,20}$/;

/**
 * Safely parses `input` as a URL, returning `null` instead of throwing.
 *
 * Only `http:`/`https:` are accepted — this alone rejects `javascript:`,
 * `data:`, `vbscript:`, and any scheme-relative or bare-path trick, because
 * `new URL()` on a non-absolute string throws and is caught here.
 */
function parseHttpUrl(input: string): URL | null {
    if (!input) return null;
    let parsed: URL;
    try {
        parsed = new URL(input);
    } catch {
        return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
}

function extractYoutubeId(url: URL): string | null {
    const host = url.hostname.toLowerCase();
    if (YOUTUBE_SHORT_HOSTS.has(host)) {
        const id = url.pathname.replace(/^\//, '').split('/')[0];
        return id || null;
    }
    if (YOUTUBE_HOSTS.has(host)) {
        if (url.pathname === '/watch') {
            return url.searchParams.get('v');
        }
        const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
        if (embedMatch?.[1]) return embedMatch[1];
        const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
        if (shortsMatch?.[1]) return shortsMatch[1];
        return null;
    }
    return null;
}

function extractVimeoId(url: URL): string | null {
    const host = url.hostname.toLowerCase();
    if (VIMEO_PLAYER_HOSTS.has(host)) {
        const match = url.pathname.match(/^\/video\/(\d+)/);
        return match?.[1] ?? null;
    }
    if (VIMEO_HOSTS.has(host)) {
        const match = url.pathname.match(/^\/(\d+)/);
        return match?.[1] ?? null;
    }
    return null;
}

function extractDailymotionId(url: URL): string | null {
    const host = url.hostname.toLowerCase();
    if (DAILYMOTION_SHORT_HOSTS.has(host)) {
        const id = url.pathname.replace(/^\//, '').split('/')[0];
        return id || null;
    }
    if (DAILYMOTION_HOSTS.has(host)) {
        const match = url.pathname.match(/^\/(?:embed\/)?video\/([A-Za-z0-9]+)/);
        return match?.[1] ?? null;
    }
    return null;
}

/**
 * Derives a safe embed URL from a host-authored video link.
 *
 * The URL is NEVER echoed back — only the id extracted from it, after
 * matching a strict per-provider shape, is used to build the embed URL from a
 * fixed template. Anything that does not match a known provider + a
 * well-shaped id resolves to `null`, and the caller MUST NOT render the video
 * in that case.
 *
 * @param params - Object with the raw `url` a host pasted into the editor.
 * @returns The resolved embed, or `null` when the URL does not match a known
 * provider or its id fails validation.
 *
 * @example
 * ```ts
 * resolveVideoEmbed({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
 * // => { provider: 'youtube', videoId: 'dQw4w9WgXcQ', embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' }
 *
 * resolveVideoEmbed({ url: 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ' })
 * // => null (host is not an exact match)
 * ```
 */
export function resolveVideoEmbed({ url }: { readonly url: string }): ResolvedVideoEmbed | null {
    const parsed = parseHttpUrl(url);
    if (!parsed) return null;

    const host = parsed.hostname.toLowerCase();

    if (YOUTUBE_HOSTS.has(host) || YOUTUBE_SHORT_HOSTS.has(host)) {
        const id = extractYoutubeId(parsed);
        if (id && YOUTUBE_ID_REGEX.test(id)) {
            return {
                provider: 'youtube',
                videoId: id,
                embedUrl: `https://www.youtube-nocookie.com/embed/${id}`
            };
        }
        return null;
    }

    if (VIMEO_HOSTS.has(host) || VIMEO_PLAYER_HOSTS.has(host)) {
        const id = extractVimeoId(parsed);
        if (id && VIMEO_ID_REGEX.test(id)) {
            return {
                provider: 'vimeo',
                videoId: id,
                embedUrl: `https://player.vimeo.com/video/${id}`
            };
        }
        return null;
    }

    if (DAILYMOTION_HOSTS.has(host) || DAILYMOTION_SHORT_HOSTS.has(host)) {
        const id = extractDailymotionId(parsed);
        if (id && DAILYMOTION_ID_REGEX.test(id)) {
            return {
                provider: 'dailymotion',
                videoId: id,
                embedUrl: `https://www.dailymotion.com/embed/video/${id}`
            };
        }
        return null;
    }

    return null;
}
