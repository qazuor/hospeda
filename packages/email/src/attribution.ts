/**
 * Email attribution: UTMs on links to our web domain (HOS-2359 §6.A). Opens are NOT
 * measured by an image pixel (HOS-2583): Brevo's image proxy hides them from Umami, so
 * they come from Brevo's `opened` webhook instead.
 *
 * {@link applyEmailAttribution} is the single implementation. `renderEmailBodies`
 * calls it after rendering, the newsletter batch renderer calls it on its HTML, and
 * nothing else rewrites email links.
 *
 * @module attribution
 */
import {
    buildEmailTemplateCampaign,
    buildOwnWebOrigins,
    InvalidUtmParamsError,
    isOwnWebUrl,
    withUtm
} from '@repo/analytics';
import { createLogger } from '@repo/logger';
import { resolveEmailSiteOrigin } from './email-assets.js';

const logger = createLogger('email-attribution');

/**
 * Who an email is attributed to.
 *
 * - `transactional`: a catalog template, identified by its catalog key
 *   (`<sendPath>.<id>`).
 * - `campaign`: a newsletter campaign.
 */
export type EmailAttribution =
    | {
          readonly medium: 'transactional';
          readonly templateKey: string;
      }
    | {
          readonly medium: 'campaign';
          readonly campaignSlug: string;
      };

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
    /** HTML with decorated links. */
    readonly html: string;
    /** Text part with the same links decorated. Absent when no text was given. */
    readonly text?: string;
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

    const html = input.html.replace(/<a\s[^>]*>/gi, (tag) => {
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
