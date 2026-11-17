/**
 * @file brand-icon.ts
 * @description The Hospeda icon the API serves (HOS-2324).
 *
 * MCP clients (Claude, ChatGPT) and browsers need an image to show next to the
 * API. The bytes are the existing web assets (see the `*.data.ts` files), served
 * at two stable paths:
 *
 * - `/favicon.ico`: the favicon, `image/x-icon`.
 * - `/icon.png`: the 192x192 logo, `image/png`. This is the URL the MCP server
 *   advertises as `icons[].src` in its `serverInfo` (MCP spec 2025-11-25).
 */

import { FAVICON_ICO_BASE64 } from './favicon-ico.data';
import { ICON_PNG_BASE64 } from './icon-png.data';

/** Path of the favicon. */
export const FAVICON_PATH = '/favicon.ico';

/** Path of the PNG logo advertised to MCP clients. */
export const BRAND_ICON_PATH = '/icon.png';

/** Shape of an MCP `Icon` (spec 2025-11-25). */
export interface BrandIcon {
    readonly src: string;
    readonly mimeType: string;
    readonly sizes: string[];
}

/** One servable icon file. */
export interface BrandIconAsset {
    readonly body: Uint8Array<ArrayBuffer>;
    readonly contentType: string;
}

const ASSETS: Readonly<Record<string, BrandIconAsset>> = {
    [FAVICON_PATH]: {
        body: Uint8Array.from(Buffer.from(FAVICON_ICO_BASE64, 'base64')),
        contentType: 'image/x-icon'
    },
    [BRAND_ICON_PATH]: {
        body: Uint8Array.from(Buffer.from(ICON_PNG_BASE64, 'base64')),
        contentType: 'image/png'
    }
};

/** Arguments for {@link getBrandIconAsset}. RO-RO. */
export interface GetBrandIconAssetArgs {
    /** Request path. */
    readonly path: string;
}

/**
 * Looks up the icon file served at a path.
 *
 * @param args - The request path
 * @returns The asset, or `undefined` when the path is not an icon path
 */
export function getBrandIconAsset({ path }: GetBrandIconAssetArgs): BrandIconAsset | undefined {
    return ASSETS[path];
}

/** Arguments for {@link buildBrandIcons}. RO-RO. */
export interface BuildBrandIconsArgs {
    /** Public base URL of the API (`HOSPEDA_API_URL`). */
    readonly apiUrl: string;
}

/**
 * Builds the `icons` array of the MCP `serverInfo`, with an absolute URL
 * (clients fetch it from their own network, so a relative path would not work).
 *
 * @param args - The API public URL
 * @returns The icons to declare
 *
 * @example
 * ```typescript
 * buildBrandIcons({ apiUrl: 'https://api.hospeda.com.ar' });
 * // [{ src: 'https://api.hospeda.com.ar/icon.png', mimeType: 'image/png', sizes: ['192x192'] }]
 * ```
 */
export function buildBrandIcons({ apiUrl }: BuildBrandIconsArgs): BrandIcon[] {
    return [
        {
            src: new URL(BRAND_ICON_PATH, apiUrl).toString(),
            mimeType: 'image/png',
            sizes: ['192x192']
        }
    ];
}
