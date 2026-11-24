/**
 * The user footer's account link (HOS-2565 D16).
 *
 * The label and target come from data only: the recipient's verticals go through
 * `resolveEmailAccountLink` (`@repo/schemas`), which reads the one declaration map
 * `VERTICAL_OWNS_PUBLICATIONS`. Nothing here, or anywhere in the layout path, may
 * compare a `VerticalEnum` member (a static guard enforces it).
 *
 * @module templates/user-layout/account-link
 */

import { type EmailAccountLink, resolveEmailAccountLink } from '@repo/schemas';
import { EMAIL_PUBLIC_SITE_URL } from '../../email-assets.js';

/** Label and absolute URL of one account link kind. */
interface AccountLinkTarget {
    readonly label: string;
    readonly href: string;
}

/** Label and target of each account link kind. */
export const EMAIL_ACCOUNT_LINK_TARGETS: Readonly<Record<EmailAccountLink, AccountLinkTarget>> = {
    publications: {
        label: 'Gestioná tus publicaciones',
        href: `${EMAIL_PUBLIC_SITE_URL}/es/mi-cuenta/publicaciones/`
    },
    account: {
        label: 'Gestioná tu cuenta',
        href: `${EMAIL_PUBLIC_SITE_URL}/es/mi-cuenta/`
    }
};

/**
 * Picks the footer account link of a recipient.
 *
 * @param input - The recipient's verticals; absent when unknown.
 * @returns The link kind, its label and its absolute URL.
 */
export function resolveEmailAccountLinkTarget(input: {
    readonly verticals?: readonly string[];
}): AccountLinkTarget & { readonly kind: EmailAccountLink } {
    const { accountLink } = resolveEmailAccountLink({ verticals: input.verticals ?? [] });
    return { kind: accountLink, ...EMAIL_ACCOUNT_LINK_TARGETS[accountLink] };
}
