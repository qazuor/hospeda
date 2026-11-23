/**
 * @file help-audience-shared.ts
 * @description The light half of the help audience vocabulary (HOS-2410
 * `docs/web-ui.md` §2, §3): the DOM events the tabs and the islands talk
 * through, the label keys, and `?para=` parsing.
 *
 * Kept apart from `help-audience.ts` (which needs `PermissionEnum`) and from
 * `help-catalog.ts` (which reads the whole help index), so the search island
 * and the tabs script bundle neither.
 */

import { HELP_AUDIENCES, type HelpAudience } from '@repo/help';

/** Name of the DOM event that asks the audience tabs to select an audience. */
export const HELP_SELECT_AUDIENCE_EVENT = 'hospeda:help-select-audience';

/** Name of the DOM event the audience tabs fire after the selection changed. */
export const HELP_AUDIENCE_CHANGED_EVENT = 'hospeda:help-audience-changed';

/**
 * Name of the DOM event the preselection fires when the signed-in reader has
 * NO business audience (a pure tourist). The search uses it so «Solo para mi
 * tipo de cuenta» never treats such a reader as the default `host` tab.
 */
export const HELP_READER_WITHOUT_AUDIENCE_EVENT = 'hospeda:help-reader-without-audience';

/** `<html>` data attribute that records the same fact for late hydrators. */
const READER_WITHOUT_AUDIENCE_ATTRIBUTE = 'data-help-reader-without-audience';

/**
 * Records that the reader has no business audience and tells the islands,
 * so it works whichever hydrates first.
 */
export function announceReaderWithoutAudience(): void {
    document.documentElement.setAttribute(READER_WITHOUT_AUDIENCE_ATTRIBUTE, '');
    window.dispatchEvent(new CustomEvent(HELP_READER_WITHOUT_AUDIENCE_EVENT));
}

/**
 * Whether the preselection already found the reader has no business audience.
 *
 * @returns `true` once {@link announceReaderWithoutAudience} ran on this page
 */
export function isReaderWithoutAudience(): boolean {
    return (
        typeof document !== 'undefined' &&
        document.documentElement.hasAttribute(READER_WITHOUT_AUDIENCE_ATTRIBUTE)
    );
}

/** Payload of both help audience events. */
export interface HelpAudienceEventDetail {
    readonly audience: HelpAudience;
}

/** The query parameter that names the selected audience. */
export const HELP_AUDIENCE_PARAM = 'para';

/** The tab selected when the URL names no audience (web-ui §2). */
export const DEFAULT_HELP_AUDIENCE: HelpAudience = 'host';

/** The i18n key of each audience label (tabs, chips, breadcrumb). */
export const HELP_AUDIENCE_LABEL_KEYS: Readonly<Record<HelpAudience, string>> = {
    host: 'account.help.audiences.host',
    venue: 'account.help.audiences.venue',
    experience: 'account.help.audiences.experience',
    provider: 'account.help.audiences.provider',
    partner: 'account.help.audiences.partner'
};

/**
 * The audience a `?para=` value names, or `undefined` when it names none.
 *
 * @param args.value - The raw query parameter, maybe absent
 * @returns A help audience, or `undefined`
 */
export function parseHelpAudience({
    value
}: {
    readonly value: string | null | undefined;
}): HelpAudience | undefined {
    return HELP_AUDIENCES.find((audience) => audience === value);
}

/**
 * The audience the page currently shows, read from the DOM: the tabs root's
 * `data-selected` (kept current by `initHelpTabs`), else a valid `?para=`.
 * Lets an island that hydrates after the tabs changed start in agreement
 * with them, whatever the hydration order.
 *
 * @param args.root - Where to look for `[data-help-tabs]`; defaults to `document`
 * @param args.search - The URL query; defaults to `window.location.search`
 * @returns The selected audience, or `undefined` when the page names none
 */
export function readSelectedHelpAudience({
    root,
    search
}: {
    readonly root?: ParentNode;
    readonly search?: string;
} = {}): HelpAudience | undefined {
    const scope = root ?? (typeof document === 'undefined' ? undefined : document);
    const tabs = scope?.querySelector<HTMLElement>('[data-help-tabs]');
    const fromTabs = parseHelpAudience({ value: tabs?.dataset.selected });
    if (fromTabs !== undefined) {
        return fromTabs;
    }
    const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
    return parseHelpAudience({ value: new URLSearchParams(query).get(HELP_AUDIENCE_PARAM) });
}

/**
 * The audience level of the article breadcrumb: the tab the reader came from
 * (`?para=`), when the article is written for it. Unknown means no level —
 * never the article's first audience, which names somebody else's tab for
 * most readers. URL-driven, so the page stays session-blind (D-H4).
 *
 * @param args.para - The parsed `?para=` value
 * @param args.audiences - The article's audiences
 * @returns The audience, or `undefined` for a breadcrumb without that level
 */
export function helpCrumbAudience({
    para,
    audiences
}: {
    readonly para: HelpAudience | undefined;
    readonly audiences: readonly HelpAudience[];
}): HelpAudience | undefined {
    return para !== undefined && audiences.includes(para) ? para : undefined;
}

/**
 * An article link that keeps the reader's tab: `?para=<audience>` is added
 * when the target article is written for that audience, so the next
 * breadcrumb shows it too.
 *
 * @param args.href - The article path (may carry a `#anchor`)
 * @param args.audience - The reader's tab, when known
 * @param args.audiences - The target article's audiences
 * @returns The href, with `?para=` before any hash when it applies
 */
export function withHelpAudienceParam({
    href,
    audience,
    audiences
}: {
    readonly href: string;
    readonly audience: HelpAudience | undefined;
    readonly audiences: readonly HelpAudience[];
}): string {
    if (audience === undefined || !audiences.includes(audience)) {
        return href;
    }
    const hashAt = href.indexOf('#');
    const path = hashAt === -1 ? href : href.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : href.slice(hashAt);
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${HELP_AUDIENCE_PARAM}=${encodeURIComponent(audience)}${hash}`;
}
