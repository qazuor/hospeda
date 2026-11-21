/**
 * @file help-audience.ts
 * @description Which help tab a signed-in reader most likely wants (HOS-2410
 * `docs/web-ui.md` §2, AC-1, AC-2). Pure: the island gathers the inputs from
 * the client session and two row-ownership reads, and this decides.
 *
 * Precedence is host > venue > experience > provider > partner. The first
 * three come from exact permissions; provider and partner from owning a row,
 * because no permission says it (spec §2).
 */

import type { HelpAudience } from '@repo/help';
import { PermissionEnum } from '@repo/schemas';

/** The permission that marks each permission-based audience, in precedence order. */
export const HELP_AUDIENCE_PERMISSIONS: ReadonlyArray<{
    readonly audience: HelpAudience;
    readonly permission: PermissionEnum;
}> = [
    { audience: 'host', permission: PermissionEnum.ACCOMMODATION_CREATE },
    { audience: 'venue', permission: PermissionEnum.VENUE_EDIT_OWN },
    { audience: 'experience', permission: PermissionEnum.EXPERIENCE_EDIT_OWN }
];

/** Arguments for {@link pickHelpAudience}. RO-RO. */
export interface PickHelpAudienceArgs {
    /** The reader's effective permission strings. */
    readonly permissions: readonly string[];
    /** Whether the reader owns a directory-provider row (`GET /host-trades/mine`). */
    readonly ownsHostTrade: boolean;
    /** Whether the reader owns a partner row (`GET /partners/mine`). */
    readonly ownsPartner: boolean;
}

/**
 * The audience to preselect, or `undefined` when nothing matches (the server
 * default then stays).
 *
 * @param args - Permissions and row ownership
 * @returns The first matching audience in precedence order
 *
 * @example
 * ```ts
 * pickHelpAudience({ permissions: ['accommodation.create'], ownsHostTrade: true, ownsPartner: false });
 * // 'host' (AC-2: host wins over provider)
 * ```
 */
export function pickHelpAudience({
    permissions,
    ownsHostTrade,
    ownsPartner
}: PickHelpAudienceArgs): HelpAudience | undefined {
    const byPermission = HELP_AUDIENCE_PERMISSIONS.find(({ permission }) =>
        permissions.includes(permission)
    );
    if (byPermission !== undefined) {
        return byPermission.audience;
    }
    if (ownsHostTrade) {
        return 'provider';
    }
    return ownsPartner ? 'partner' : undefined;
}

/** Name of the DOM event that asks the audience tabs to select an audience. */
export const HELP_SELECT_AUDIENCE_EVENT = 'hospeda:help-select-audience';

/** Name of the DOM event the audience tabs fire after the selection changed. */
export const HELP_AUDIENCE_CHANGED_EVENT = 'hospeda:help-audience-changed';

/** Payload of both help audience events. */
export interface HelpAudienceEventDetail {
    readonly audience: HelpAudience;
}

/** The i18n key of each audience label (tabs, chips, breadcrumb). */
export const HELP_AUDIENCE_LABEL_KEYS: Readonly<Record<HelpAudience, string>> = {
    host: 'account.help.audiences.host',
    venue: 'account.help.audiences.venue',
    experience: 'account.help.audiences.experience',
    provider: 'account.help.audiences.provider',
    partner: 'account.help.audiences.partner'
};
