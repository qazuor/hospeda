/**
 * @file build-portal-url.ts
 * @description Turns a {@link PortalDestination} into the absolute owner-portal
 * URL it points at (HOS-2326, spec HOS-2335 §5.1).
 *
 * Pure: the site URL comes in as an argument (callers pass `HOSPEDA_SITE_URL`),
 * so nothing here reads the environment and nothing is hardcoded. Like the rest
 * of this package it imports nothing from the API runtime, so the HOS-2185 agent can
 * reuse it.
 */

import {
    CREATE_LISTING_ROUTE_BY_VERTICAL,
    EDITOR_NON_SECTION_PAGE_SLUGS,
    EDITOR_SECTION_SLUGS,
    EDITOR_SECTION_TEMPLATE_BY_VERTICAL,
    OWNER_LISTINGS_ROUTE_BY_VERTICAL,
    PLANS_ROUTE_BY_VERTICAL,
    PORTAL_DEFAULT_LOCALE,
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_SECTION_PLACEHOLDER,
    type PortalDestination,
    type PortalEditorTarget,
    type PortalListingVertical,
    type PortalRouteKey
} from './portal-routes';

/** Locales the web serves. */
export type PortalLocale = 'es' | 'en' | 'pt';

/** Arguments for {@link buildPortalUrl}. RO-RO. */
export interface BuildPortalUrlArgs {
    /** Where the link points. */
    readonly destination: PortalDestination;
    /** Locale prefix of the page. Defaults to `es`. */
    readonly locale?: PortalLocale;
    /** Public base URL of the web app (`HOSPEDA_SITE_URL`). A trailing slash is tolerated. */
    readonly siteUrl: string;
}

/** Matches one `[name]` dynamic segment of a template. */
const DYNAMIC_SEGMENT = /\[([A-Za-z]+)\]/g;

/**
 * Removes every trailing `/` of a string by index. A loop, not `/\/+$/`: the
 * regex is quadratic on a long run of slashes (CodeQL `js/polynomial-redos`).
 */
function stripTrailingSlashes(value: string): string {
    let end = value.length;
    while (end > 0 && value.charCodeAt(end - 1) === 47) {
        end -= 1;
    }
    return value.slice(0, end);
}

/**
 * Fills the dynamic segments of a template. Every value is URL-encoded; a
 * segment with no value is a programming error and throws, because a link with a
 * hole in it is worse than none.
 */
function fillTemplate(input: {
    readonly template: string;
    readonly params: Readonly<Record<string, string>>;
}): string {
    return input.template.replace(DYNAMIC_SEGMENT, (segment, name: string) => {
        const value = input.params[name];
        if (value === undefined || value.trim() === '') {
            throw new Error(`Portal link template ${input.template} needs a value for ${segment}`);
        }
        return encodeURIComponent(value);
    });
}

/**
 * The editor slug of a catalog section or of another editor page of a vertical
 * ({@link EDITOR_NON_SECTION_PAGE_SLUGS}), or `undefined` when the vertical has
 * neither with that id.
 *
 * @param input.vertical - The listing vertical
 * @param input.section - A catalog section id or a non-section editor page id
 * @returns The URL slug, for example `servicios` or `politicas`
 *
 * @example
 * ```ts
 * editorSlugOf({ vertical: 'accommodation', section: 'policies' }); // 'politicas'
 * editorSlugOf({ vertical: 'venue', section: 'policies' }); // undefined
 * ```
 */
export function editorSlugOf(input: {
    readonly vertical: PortalListingVertical;
    readonly section: PortalEditorTarget;
}): string | undefined {
    const sections: Readonly<Record<string, string>> = EDITOR_SECTION_SLUGS[input.vertical];
    const pages: Readonly<Record<string, string>> = EDITOR_NON_SECTION_PAGE_SLUGS[input.vertical];
    if (Object.hasOwn(sections, input.section)) {
        return sections[input.section];
    }
    return Object.hasOwn(pages, input.section) ? pages[input.section] : undefined;
}

/** A destination's path template (dynamic segments left in place) and the values that fill them. */
interface ResolvedPath {
    readonly template: string;
    readonly params: Readonly<Record<string, string>>;
}

/** Template and values of an editor hub or section, with no locale. */
function editorPath(input: {
    readonly vertical: PortalListingVertical;
    readonly id: string;
    readonly section?: PortalEditorTarget;
}): ResolvedPath {
    const { vertical, id, section } = input;
    const slug = section === undefined ? undefined : editorSlugOf({ vertical, section });
    const isAccommodation = vertical === 'accommodation';
    const params: Readonly<Record<string, string>> = isAccommodation ? { id } : { id, vertical };
    if (slug === undefined) {
        const hub = isAccommodation ? 'accommodationEditorHub' : 'listingEditorHub';
        return { template: PORTAL_ROUTE_TEMPLATES[hub], params };
    }
    const template = PORTAL_ROUTE_TEMPLATES[EDITOR_SECTION_TEMPLATE_BY_VERTICAL[vertical]];
    return { template: template.replace(PORTAL_SECTION_PLACEHOLDER, slug), params };
}

/** Template and values of a destination, with no locale. */
function resolveDestination(destination: PortalDestination): ResolvedPath {
    const path = (key: PortalRouteKey, params: Readonly<Record<string, string>> = {}) => ({
        template: PORTAL_ROUTE_TEMPLATES[key],
        params
    });

    switch (destination.kind) {
        case 'listingEditor':
            return editorPath(destination);
        case 'ownerListings':
            return path(OWNER_LISTINGS_ROUTE_BY_VERTICAL[destination.vertical]);
        case 'createListing':
            return path(CREATE_LISTING_ROUTE_BY_VERTICAL[destination.vertical]);
        case 'plans':
            return path(PLANS_ROUTE_BY_VERTICAL[destination.vertical]);
        case 'subscription':
            return path('subscription');
        case 'addons':
            return path('addons');
        case 'inquiry':
            return destination.conversationId === undefined
                ? path('inquiryInbox')
                : path('inquiry', { conversationId: destination.conversationId });
        case 'providerDirectory':
            return destination.slug === undefined
                ? path('providerDirectory')
                : path('providerDetail', { slug: destination.slug });
        case 'declareBenefitUsage':
            return path('providerDeclareUsage', { slug: destination.slug });
        case 'benefitUsages':
            return path('benefitUsages');
        case 'providerPanel':
            return path('providerPanel');
        case 'aiAssistants':
            return path('aiAssistants');
        case 'aiAssistantsHistory':
            return path('aiAssistantsHistory');
        case 'faq':
            return path('faq');
        case 'contact':
            return path('contact');
        case 'partnerPanel':
            return path('partnerPanel');
        case 'helpLanding':
            return path('helpLanding');
        case 'helpArticle':
            return path('helpArticle', { id: destination.id });
        case 'page':
            return path(destination.page, destination.params ?? {});
        default: {
            const unreachable: never = destination;
            throw new Error(`Unknown portal destination: ${JSON.stringify(unreachable)}`);
        }
    }
}

/**
 * The route template a destination resolves to, with its dynamic segments
 * (`[id]`, `[vertical]`, `[slug]`, `[conversationId]`) left in place and an
 * editor section already replaced by its slug, for example
 * `mi-cuenta/propiedades/[id]/editar/fotos`. It is what must exist as a page in
 * `apps/web`: the help-catalog guard checks it the way `check-portal-routes`
 * checks the route map.
 *
 * @param args - The destination
 * @returns The template, with no locale and no edge slashes
 */
export function portalDestinationTemplate({
    destination
}: {
    readonly destination: PortalDestination;
}): string {
    return resolveDestination(destination).template;
}

/**
 * Builds the absolute, locale-prefixed, trailing-slashed URL of a portal page.
 *
 * @param args - The destination, locale and site URL
 * @returns e.g. `https://hospeda.com.ar/es/mi-cuenta/propiedades/<id>/editar/datos/`
 * @throws When the site URL is empty or the destination lacks a value its
 *   template needs. Callers that must not throw (the tool executor) catch it.
 *
 * @example
 * ```typescript
 * buildPortalUrl({
 *     destination: { kind: 'listingEditor', vertical: 'accommodation', id, section: 'basicInfo' },
 *     siteUrl: env.HOSPEDA_SITE_URL
 * });
 * ```
 */
export function buildPortalUrl({
    destination,
    locale = PORTAL_DEFAULT_LOCALE,
    siteUrl
}: BuildPortalUrlArgs): string {
    const base = stripTrailingSlashes(siteUrl.trim());
    if (base === '') {
        throw new Error('Portal links need the configured site URL');
    }
    const { template, params } = resolveDestination(destination);
    return `${base}/${locale}/${fillTemplate({ template, params })}/`;
}
