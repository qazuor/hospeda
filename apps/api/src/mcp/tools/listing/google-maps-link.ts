/**
 * @file google-maps-link.ts
 * @description The Google Maps link resolver of the create wizard (HOS-2335
 * §5.5, owner decision D-4, AC-C23a-e): turns a link the user pasted into a
 * point, plus the address text the link carries when it has one.
 *
 * **Accepted forms**, first match wins:
 * 1. `!3d<lat>!4d<lng>` in the `data=` blob: the place pin.
 * 2. `/@<lat>,<lng>,…`: the map viewport, only when there is no pin (it can be
 *    off the pin).
 * 3. `?q=`, `?query=`, `?ll=` with `<lat>,<lng>`, and `/maps/search/<lat>,<lng>`.
 * 4. `/maps/place/<text>/…`: the decoded segment becomes `addressHint`; the
 *    point still comes from forms 1-3 of the same URL. No point, no result.
 * 5. Short links (`maps.app.goo.gl/<id>`, `goo.gl/maps/<id>`): resolved by
 *    following redirects, then parsed with forms 1-4.
 *
 * **SSRF.** A full URL causes zero network calls. A short link is followed by
 * hand (`redirect` is never delegated), at most {@link MAPS_LINK_MAX_REDIRECTS}
 * hops; every hop target is re-checked by `checkMapsUrl` BEFORE it is
 * requested; each hop has {@link MAPS_LINK_HOP_TIMEOUT_MS} and the whole
 * resolution {@link MAPS_LINK_TOTAL_TIMEOUT_MS}; only headers are read; the
 * socket's DNS answer is checked by the guarded lookup (`google-maps-link-guard.ts`).
 *
 * **No guessing.** A point outside {@link MAPS_SERVICE_REGION_BOUNDS} is refused,
 * never clamped; nothing is geocoded or reverse-geocoded (D-4: no other fetch).
 * The address hint is display text, never split into street and number.
 *
 * Failures are logged with the reason and the host only, never the URL.
 * Imports nothing from `lib/mcp/` (HOS-2185 reuse).
 */

import { apiLogger } from '../../../utils/logger';
import {
    createNodeMapsHopFetcher,
    type MapsHopFetcher,
    MapsLinkTimeoutError
} from './google-maps-link-fetcher';
import { checkMapsUrl, MapsLinkAddressError, type MapsLinkRefusal } from './google-maps-link-guard';

/** Most redirect hops a short link may take. */
export const MAPS_LINK_MAX_REDIRECTS = 5;
/** Deadline of one hop, in milliseconds. */
export const MAPS_LINK_HOP_TIMEOUT_MS = 3000;
/** Deadline of the whole resolution, in milliseconds. */
export const MAPS_LINK_TOTAL_TIMEOUT_MS = 5000;
/** Longest address hint kept, in characters (the rest is cut). */
export const MAPS_LINK_ADDRESS_HINT_MAX_CHARS = 200;

/**
 * The service region (Argentina, with a small margin). A parsed point outside
 * it is refused: it catches a gross mis-parse and a link to another country.
 */
export const MAPS_SERVICE_REGION_BOUNDS = {
    minLat: -55.2,
    maxLat: -21.7,
    minLng: -73.6,
    maxLng: -53.5
} as const;

/** Why a link could not be resolved. Closed list; each has a Spanish message. */
export type MapsLinkFailureReason =
    | MapsLinkRefusal
    /** No accepted form carries a point. */
    | 'UNPARSEABLE'
    /** The point is outside the service region. */
    | 'OUT_OF_REGION'
    /** A hop or the whole resolution ran past its deadline. */
    | 'TIMEOUT'
    /** More than {@link MAPS_LINK_MAX_REDIRECTS} hops. */
    | 'TOO_MANY_REDIRECTS'
    /** A hop failed, or answered something that is not a redirect. */
    | 'RESOLUTION_FAILED';

/** Spanish text of each failure, shown on field `mapsUrl`. */
export const MAPS_LINK_FAILURE_MESSAGES: Readonly<Record<MapsLinkFailureReason, string>> = {
    INVALID_URL: 'no parece un link de Google Maps válido',
    HOST_NOT_ALLOWED:
        'solo se aceptan links de Google Maps (maps.app.goo.gl, goo.gl/maps o google.com/maps)',
    PRIVATE_ADDRESS: 'no se pudo abrir ese link de Google Maps',
    UNPARSEABLE:
        'el link no trae la ubicación del lugar; en Google Maps tocá el lugar, elegí Compartir y pegá ese link',
    OUT_OF_REGION: 'parece fuera de la zona: el punto queda fuera de Argentina',
    TIMEOUT: 'Google Maps tardó demasiado en responder; probá de nuevo o indicá la dirección',
    TOO_MANY_REDIRECTS: 'no se pudo seguir ese link de Google Maps',
    RESOLUTION_FAILED: 'no se pudo abrir ese link de Google Maps'
};

/** A resolved point, in decimal degrees (WGS84). */
export interface MapsPoint {
    readonly lat: number;
    readonly lng: number;
}

/** Result of {@link resolveGoogleMapsLink}. */
export type MapsLinkResolution =
    | {
          readonly ok: true;
          readonly point: MapsPoint;
          /** Decoded `/place/` segment: untrusted display text, never parsed. */
          readonly addressHint?: string;
      }
    | { readonly ok: false; readonly reason: MapsLinkFailureReason };

/** One signed decimal degree value. */
const DEGREES = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PIN_FORM = new RegExp(`!3d${DEGREES}!4d${DEGREES}`);
const VIEWPORT_FORM = new RegExp(`/@${DEGREES},${DEGREES}(?:,|/|$)`);
const PAIR_FORM = new RegExp(String.raw`^\s*${DEGREES}\s*,\s*${DEGREES}\s*$`);
const SEARCH_PATH = /^\/maps\/search\/([^/]+)/;
const PLACE_PATH = /^\/maps\/place\/([^/]+)/;
const QUERY_KEYS = ['q', 'query', 'll'] as const;

/** Decodes one URL path segment, `+` as a space. `undefined` when it does not decode. */
function decodeSegment(segment: string): string | undefined {
    try {
        return decodeURIComponent(segment.replace(/\+/g, ' '));
    } catch {
        return undefined;
    }
}

/** The point of a `lat,lng` pair, or `undefined` when it is not one. */
function readPair(text: string | null | undefined): MapsPoint | undefined {
    const match = text ? PAIR_FORM.exec(text) : null;
    return match ? { lat: Number(match[1]), lng: Number(match[2]) } : undefined;
}

/** The point of a regex match with two capture groups. */
function fromMatch(match: RegExpExecArray | null): MapsPoint | undefined {
    return match ? { lat: Number(match[1]), lng: Number(match[2]) } : undefined;
}

/** Forms 1-3, in precedence order. */
function readPoint(url: URL): MapsPoint | undefined {
    const pin = fromMatch(PIN_FORM.exec(url.pathname)) ?? fromMatch(PIN_FORM.exec(url.search));
    if (pin) {
        return pin;
    }
    const viewport = fromMatch(VIEWPORT_FORM.exec(url.pathname));
    if (viewport) {
        return viewport;
    }
    for (const key of QUERY_KEYS) {
        const pair = readPair(url.searchParams.get(key));
        if (pair) {
            return pair;
        }
    }
    const search = SEARCH_PATH.exec(url.pathname)?.[1];
    return search === undefined ? undefined : readPair(decodeSegment(search));
}

/** Form 4's text: decoded, control characters dropped, whitespace collapsed, capped. */
function readAddressHint(url: URL): string | undefined {
    const segment = PLACE_PATH.exec(url.pathname)?.[1];
    const decoded = segment === undefined ? undefined : decodeSegment(segment);
    if (decoded === undefined) {
        return undefined;
    }
    const cleaned = Array.from(decoded, (char) => {
        const code = char.codePointAt(0) ?? 0;
        return code < 0x20 || (code >= 0x7f && code < 0xa0) ? ' ' : char;
    })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned === '' ? undefined : cleaned.slice(0, MAPS_LINK_ADDRESS_HINT_MAX_CHARS);
}

/** Whether a point is a real coordinate inside the service region. */
function isInRegion({ lat, lng }: MapsPoint): boolean {
    const b = MAPS_SERVICE_REGION_BOUNDS;
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= b.minLat &&
        lat <= b.maxLat &&
        lng >= b.minLng &&
        lng <= b.maxLng
    );
}

/**
 * Parses a full (non-short) Maps URL with forms 1-4. Pure: no network.
 *
 * @param args - A URL that already passed the SSRF check
 * @returns The point and the address hint, or the failure
 */
export function parseGoogleMapsUrl({ url }: { readonly url: URL }): MapsLinkResolution {
    const point = readPoint(url);
    if (point === undefined || Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
        return { ok: false, reason: 'UNPARSEABLE' };
    }
    if (!isInRegion(point)) {
        return { ok: false, reason: 'OUT_OF_REGION' };
    }
    const addressHint = readAddressHint(url);
    return addressHint === undefined ? { ok: true, point } : { ok: true, point, addressHint };
}

/** Optional injection points; tests inject the fetcher (never the network). */
export interface ResolveGoogleMapsLinkDeps {
    /** Performs one hop. Defaults to the guarded `node:https` fetcher. */
    readonly fetchHop?: MapsHopFetcher;
}

/** Statuses a hop follows. */
const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);

/** An `AbortSignal` that fires after `ms` (timer-based, so fake timers drive it in tests). */
function deadline(ms: number): { readonly signal: AbortSignal; readonly clear: () => void } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    timer.unref?.();
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/** Races a hop against its signal, so a fetcher that ignores the signal still times out. */
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(new MapsLinkTimeoutError());
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            (error: unknown) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            }
        );
    });
}

/** Maps a thrown hop error to a failure reason. */
function reasonOf(error: unknown): MapsLinkFailureReason {
    if (error instanceof MapsLinkAddressError) return 'PRIVATE_ADDRESS';
    if (error instanceof MapsLinkTimeoutError) return 'TIMEOUT';
    return 'RESOLUTION_FAILED';
}

/** One hop: `HEAD`, then `GET` on a 405, both under the hop and total deadlines. */
async function requestHop(input: {
    readonly url: URL;
    readonly fetchHop: MapsHopFetcher;
    readonly total: AbortSignal;
}) {
    const hop = deadline(MAPS_LINK_HOP_TIMEOUT_MS);
    const signal = AbortSignal.any([hop.signal, input.total]);
    try {
        const head = await raceAbort(
            input.fetchHop({ url: input.url, method: 'HEAD', signal }),
            signal
        );
        if (head.status !== 405) {
            return head;
        }
        return await raceAbort(input.fetchHop({ url: input.url, method: 'GET', signal }), signal);
    } finally {
        hop.clear();
    }
}

/** Logs a failure with its reason and host. Never the URL. */
function logFailure(input: { readonly reason: MapsLinkFailureReason; readonly host?: string }) {
    apiLogger.info(
        { event: 'mcp.maps_link.unresolved', reason: input.reason, host: input.host ?? null },
        'Google Maps link could not be resolved'
    );
}

/** Follows a short link by hand and parses where it lands. */
async function followShortLink(input: {
    readonly start: URL;
    readonly fetchHop: MapsHopFetcher;
}): Promise<MapsLinkResolution> {
    const total = deadline(MAPS_LINK_TOTAL_TIMEOUT_MS);
    let current = input.start;
    try {
        for (let hops = 0; hops < MAPS_LINK_MAX_REDIRECTS; hops += 1) {
            let response: { readonly status: number; readonly location: string | null };
            try {
                response = await requestHop({
                    url: current,
                    fetchHop: input.fetchHop,
                    total: total.signal
                });
            } catch (error) {
                return fail({ reason: reasonOf(error), host: current.hostname });
            }
            if (!REDIRECT_STATUSES.has(response.status) || response.location === null) {
                return fail({ reason: 'RESOLUTION_FAILED', host: current.hostname });
            }
            const next = checkMapsUrl({ raw: response.location, base: current });
            if (!next.ok) {
                return fail({ reason: next.reason, host: current.hostname });
            }
            if (!next.isShortLink) {
                const parsed = parseGoogleMapsUrl({ url: next.url });
                return parsed.ok
                    ? parsed
                    : fail({ reason: parsed.reason, host: next.url.hostname });
            }
            current = next.url;
        }
        return fail({ reason: 'TOO_MANY_REDIRECTS', host: current.hostname });
    } finally {
        total.clear();
    }
}

/** Logs and builds a failure. */
function fail(input: {
    readonly reason: MapsLinkFailureReason;
    readonly host?: string;
}): MapsLinkResolution {
    logFailure(input);
    return { ok: false, reason: input.reason };
}

/**
 * Resolves a Google Maps link to a point (spec §5.5).
 *
 * @param args - The link as the user pasted it, and optional deps
 * @returns The point and the address hint, or the failure reason. Never throws.
 *
 * @example
 * ```typescript
 * const resolved = await resolveGoogleMapsLink({
 *     url: 'https://www.google.com/maps/place/Plaza/@-32.48,-58.23,17z'
 * });
 * // { ok: true, point: { lat: -32.48, lng: -58.23 }, addressHint: 'Plaza' }
 * ```
 */
export async function resolveGoogleMapsLink(
    args: { readonly url: string } & ResolveGoogleMapsLinkDeps
): Promise<MapsLinkResolution> {
    const checked = checkMapsUrl({ raw: args.url });
    if (!checked.ok) {
        return fail({ reason: checked.reason });
    }
    if (!checked.isShortLink) {
        const parsed = parseGoogleMapsUrl({ url: checked.url });
        return parsed.ok ? parsed : fail({ reason: parsed.reason, host: checked.url.hostname });
    }
    return followShortLink({
        start: checked.url,
        fetchHop: args.fetchHop ?? createNodeMapsHopFetcher()
    });
}
