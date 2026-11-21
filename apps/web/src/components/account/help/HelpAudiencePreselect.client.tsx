/**
 * @file HelpAudiencePreselect.client.tsx
 * @description Opens the help landing on the reader's kind of account
 * (HOS-2410 `docs/web-ui.md` §2, AC-1, AC-2, AC-3).
 *
 * The server cannot know it: partner and provider status come from owning a
 * row, and the page carries no per-user content (D-H4). So, in the browser,
 * this island reads the exact permissions of the client session (the cached
 * `/auth/me` snapshot the avatar menu uses), asks `GET /host-trades/mine` and
 * `GET /partners/mine` only when no permission decided it, and asks the tabs
 * to select the first match (host > venue > experience > provider > partner),
 * writing `?para=` with `history.replaceState`.
 *
 * It does nothing when the URL already names an audience (AC-3), and nothing
 * on any failure: the server-selected tab stays and no error is shown.
 *
 * Renders nothing. Hydration: `client:idle`.
 */

import type { HelpAudience } from '@repo/help';
import { useEffect } from 'react';
import { hostTradesApi, partnersApi } from '@/lib/api/endpoints-protected';
import { fetchAuthMe, readCachedAuthMe } from '@/lib/auth-cache';
import { pickHelpAudience } from '@/lib/help/help-audience';
import {
    HELP_AUDIENCE_PARAM,
    HELP_SELECT_AUDIENCE_EVENT,
    type HelpAudienceEventDetail,
    parseHelpAudience
} from '@/lib/help/help-audience-shared';

/**
 * Whether the URL already names a valid audience. An invalid `?para=garbage`
 * counts as absent, the same way the server falls back to the default tab.
 */
function urlNamesAudience(): boolean {
    const value = new URL(window.location.href).searchParams.get(HELP_AUDIENCE_PARAM);
    return parseHelpAudience({ value }) !== undefined;
}

/**
 * Works out the audience to preselect. Row reads run only when no permission
 * decided it; a failed read counts as "no row".
 *
 * @returns The audience, or `undefined` when nothing matched or a read failed
 */
export async function resolvePreselectedHelpAudience(): Promise<HelpAudience | undefined> {
    const session = readCachedAuthMe() ?? (await fetchAuthMe());
    if (!session.isAuthenticated) {
        return undefined;
    }
    const byPermission = pickHelpAudience({
        permissions: session.permissions,
        ownsHostTrade: false,
        ownsPartner: false
    });
    if (byPermission !== undefined) {
        return byPermission;
    }
    const [trade, partner] = await Promise.all([hostTradesApi.mine(), partnersApi.mine()]);
    return pickHelpAudience({
        permissions: session.permissions,
        ownsHostTrade: trade.ok && trade.data.trade !== null,
        ownsPartner: partner.ok && partner.data.partner !== null
    });
}

/** Writes `?para=<audience>` into the current URL without a navigation. */
function writeAudienceParam({ audience }: { readonly audience: HelpAudience }): void {
    const url = new URL(window.location.href);
    url.searchParams.set(HELP_AUDIENCE_PARAM, audience);
    window.history.replaceState(window.history.state, '', url);
}

/**
 * Help audience preselection island. Renders nothing.
 *
 * @returns `null`
 */
export function HelpAudiencePreselect() {
    useEffect(() => {
        if (urlNamesAudience()) {
            return;
        }
        let cancelled = false;
        const run = async (): Promise<void> => {
            try {
                const audience = await resolvePreselectedHelpAudience();
                // The reader may have picked a tab meanwhile: their choice wins.
                const pickedMeanwhile = urlNamesAudience();
                if (cancelled || audience === undefined || pickedMeanwhile) {
                    return;
                }
                writeAudienceParam({ audience });
                window.dispatchEvent(
                    new CustomEvent<HelpAudienceEventDetail>(HELP_SELECT_AUDIENCE_EVENT, {
                        detail: { audience }
                    })
                );
            } catch {
                // Detection is a convenience: the server default stays.
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, []);
    return null;
}
