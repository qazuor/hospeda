/**
 * Per-send data the USER layout needs but no template should have to pass
 * (HOS-2565 PR-4): which illustration the mail declares, which help articles relate
 * to it, and the recipient's verticals for the footer account link (D16).
 *
 * The host fills it once per render through `renderEmailBodies({ layout })`, which
 * wraps the template in {@link EmailLayoutContext}. The ~112 templates stay
 * untouched: their declarations live in the email catalog, and the notifications
 * transport and the previewer read them by template key. Everything is optional;
 * an empty context renders no illustration, the default help articles and the
 * "Gestioná tu cuenta" link.
 *
 * @module templates/email-layout-context
 */

import { createContext } from 'react';
import type { EmailIllustration } from './user-layout/user-assets.js';

/** Layout data for one render. */
export interface EmailLayoutContextValue {
    /** Illustration shown next to the first title. Absent: none. */
    readonly illustration?: EmailIllustration;
    /**
     * Ids of the help articles related to this mail, in display order (3 to 4).
     * Absent or empty: the generic default set.
     */
    readonly helpArticleIds?: readonly string[];
    /**
     * The recipient's verticals (`VerticalEnum` values), used only to pick the footer
     * account link through `resolveEmailAccountLink`. Absent or unknown: "Gestioná tu
     * cuenta". A failed lookup must pass nothing, never block the send.
     */
    readonly recipientVerticals?: readonly string[];
}

/** React context the user layout reads. Defaults to an empty value. */
export const EmailLayoutContext = createContext<EmailLayoutContextValue>({});
