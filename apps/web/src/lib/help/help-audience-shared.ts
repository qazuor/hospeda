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
