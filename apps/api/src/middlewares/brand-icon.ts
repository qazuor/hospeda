/**
 * @file brand-icon.ts
 * @description Serves the Hospeda icon at `/favicon.ico` and `/icon.png` (HOS-2324).
 *
 * Replaces the old emoji `text/plain` favicon. It answers before auth, rate
 * limiting and the rest of the chain, as the favicon always did, so a client
 * fetching the icon never needs a token.
 */

import type { MiddlewareHandler } from 'hono';
import { getBrandIconAsset } from '../lib/brand-icon/brand-icon';
import type { AppBindings } from '../types';

/** One day: the icon is a static asset and changes only with a deploy. */
const ICON_CACHE_CONTROL = 'public, max-age=86400';

/**
 * Creates the icon-serving middleware.
 *
 * @returns A middleware answering GET and HEAD on the icon paths with the image
 *
 * @example
 * ```typescript
 * app.use(serveBrandIcon());
 * ```
 */
export const serveBrandIcon = (): MiddlewareHandler<AppBindings> => async (c, next) => {
    const method = c.req.method;
    if (method !== 'GET' && method !== 'HEAD') {
        await next();
        return;
    }
    const asset = getBrandIconAsset({ path: c.req.path });
    if (!asset) {
        await next();
        return;
    }
    return new Response(method === 'HEAD' ? null : asset.body, {
        headers: {
            'Content-Type': asset.contentType,
            'Content-Length': String(asset.body.byteLength),
            'Cache-Control': ICON_CACHE_CONTROL
        }
    });
};
