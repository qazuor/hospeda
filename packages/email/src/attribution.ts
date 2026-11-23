/**
 * Email attribution: UTMs on links to our web domain and one Umami open pixel per
 * email (HOS-2359 §6.A).
 *
 * {@link applyEmailAttribution} is the single implementation. `renderEmailBodies`
 * calls it after rendering, the newsletter batch renderer calls it on its HTML, and
 * nothing else rewrites email links.
 *
 * @module attribution
 */
import {
    buildEmailTemplateCampaign,
    buildEmailTemplatePixelSlug,
    buildOwnWebOrigins,
    InvalidUtmParamsError,
    isOwnWebUrl,
    withUtm
} from '@repo/analytics';
import { createLogger } from '@repo/logger';
import { resolveEmailPixelBaseUrl, resolveEmailSiteOrigin } from './email-assets.js';

const logger = createLogger('email-attribution');

/**
 * Who an email is attributed to.
 *
 * - `transactional`: a catalog template, identified by its catalog key
 *   (`<sendPath>.<id>`). `includePixel: false` is for renders that must never count
 *   as an open (the admin preview).
 * - `campaign`: a newsletter campaign. `pixelSlug: null` renders no pixel (test
 *   sends, or a campaign whose pixel could not be provisioned).
 */
export type EmailAttribution =
    | {
          readonly medium: 'transactional';
          readonly templateKey: string;
          readonly includePixel: boolean;
      }
    | {
          readonly medium: 'campaign';
          readonly campaignSlug: string;
          readonly pixelSlug: string | null;
      };

/**
 * Path segment of Umami's public pixel endpoint. Measured on Umami 3.5.0 (HOS-2359
 * M-2): `GET /p/<slug>` answers a 1x1 GIF and counts one view.
 */
export const UMAMI_PIXEL_PATH = '/p';

/** `utm_content` of a link with no explicit slot. */
const DEFAULT_LINK_SLOT = 'body-link';

/** Input of {@link applyEmailAttribution}. */
export interface ApplyEmailAttributionInput {
    /** Rendered HTML document. */
    readonly html: string;
    /** Rendered text/plain alternative, when there is one. */
    readonly text?: string;
    /** Who the email is attributed to. */
    readonly attribution: EmailAttribution;
}

/** Output of {@link applyEmailAttribution}. */
export interface ApplyEmailAttributionResult {
    /** HTML with decorated links and, when due, the pixel. */
    readonly html: string;
    /** Text part with the same links decorated (never a pixel). Absent when no text was given. */
    readonly text?: string;
}

/**
 * Absolute URL of an Umami pixel. It carries no query string and is identical for
 * every recipient of the same template or campaign (OD-7: no recipient id).
 *
 * @param input - Pixel origin (no trailing slash) and slug
 * @returns The pixel URL
 */
export function buildEmailPixelUrl({
    pixelBaseUrl,
    slug
}: {
    readonly pixelBaseUrl: string;
    readonly slug: string;
}): string {
    return `${pixelBaseUrl}${UMAMI_PIXEL_PATH}/${slug}`;
}

const HTML_DECODE: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&quot;': '"',
    '&#x27;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>'
};

function decodeAttribute(value: string): string {
    return value.replace(
        /&(?:amp|quot|#x27|#39|lt|gt);/g,
        (entity) => HTML_DECODE[entity] ?? entity
    );
}

function encodeAttribute(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function readAttribute({ tag, name }: { readonly tag: string; readonly name: string }) {
    const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
    return match ? decodeAttribute(match[1] ?? '') : undefined;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let warnedInvalidUtm = false;

/**
 * Applies attribution to one rendered email:
 *
 * 1. Every `<a href>` whose URL is on our web domain gets `utm_source=email`,
 *    `utm_medium`, `utm_campaign` (template key token or campaign slug) and
 *    `utm_content` (the anchor's `data-utm-content`, else its `data-layout-link`,
 *    else `body-link`). `mailto:`, `tel:`, anchors, API/admin hosts and external
 *    links are left byte-identical, and so is a link that already has UTMs.
 * 2. The text part gets the same replacements (decoded URLs, longest first, only
 *    whole URLs).
 * 3. When a pixel origin is configured (`https:` only) and the attribution asks for
 *    one, exactly one 1x1 `<img>` is inserted before `</body>` (appended when there
 *    is none). The text part never contains it.
 *
 * Never throws: a link whose UTM combination the vocabulary rejects is left as is
 * and logged once, so attribution can never stop an email from being sent.
 *
 * @param input - See {@link ApplyEmailAttributionInput}
 * @returns See {@link ApplyEmailAttributionResult}
 */
export function applyEmailAttribution(
    input: ApplyEmailAttributionInput
): ApplyEmailAttributionResult {
    const { attribution } = input;
    const ownOrigins = buildOwnWebOrigins({ siteUrl: resolveEmailSiteOrigin() });
    const campaign =
        attribution.medium === 'transactional'
            ? buildEmailTemplateCampaign({ key: attribution.templateKey })
            : attribution.campaignSlug;
    const replacements = new Map<string, string>();

    let html = input.html.replace(/<a\s[^>]*>/gi, (tag) => {
        const hrefMatch = /\shref="([^"]*)"/.exec(tag);
        if (!hrefMatch) {
            return tag;
        }
        const original = decodeAttribute(hrefMatch[1] ?? '');
        if (!isOwnWebUrl({ url: original, ownOrigins })) {
            return tag;
        }
        const slot =
            readAttribute({ tag, name: 'data-utm-content' }) ??
            readAttribute({ tag, name: 'data-layout-link' }) ??
            DEFAULT_LINK_SLOT;
        let decorated: string;
        try {
            decorated = withUtm({
                url: original,
                source: 'email',
                medium: attribution.medium,
                campaign,
                content: slot
            });
        } catch (error) {
            if (error instanceof InvalidUtmParamsError) {
                if (!warnedInvalidUtm) {
                    warnedInvalidUtm = true;
                    logger.warn(
                        { campaign, slot, issues: error.issues },
                        'Email link left without UTMs: invalid combination'
                    );
                }
                return tag;
            }
            throw error;
        }
        if (decorated === original) {
            return tag;
        }
        if (!replacements.has(original)) {
            replacements.set(original, decorated);
        }
        return tag.replace(hrefMatch[0], ` href="${encodeAttribute(decorated)}"`);
    });

    const pixelBaseUrl = resolveEmailPixelBaseUrl();
    const pixelSlug =
        attribution.medium === 'transactional'
            ? attribution.includePixel
                ? buildEmailTemplatePixelSlug({ key: attribution.templateKey })
                : null
            : attribution.pixelSlug;
    if (pixelBaseUrl !== null && pixelSlug !== null) {
        const pixel = `<img src="${encodeAttribute(buildEmailPixelUrl({ pixelBaseUrl, slug: pixelSlug }))}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
        const bodyClose = html.toLowerCase().lastIndexOf('</body>');
        html =
            bodyClose === -1
                ? `${html}${pixel}`
                : `${html.slice(0, bodyClose)}${pixel}${html.slice(bodyClose)}`;
    }

    if (input.text === undefined) {
        return { html };
    }
    if (replacements.size === 0) {
        return { html, text: input.text };
    }
    const keys = [...replacements.keys()].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
        `(?:${keys.map(escapeRegExp).join('|')})(?=[.,;:!?]*(?:[\\s\\]\\)>"'<]|$))`,
        'g'
    );
    const text = input.text.replace(pattern, (match) => replacements.get(match) ?? match);
    return { html, text };
}
