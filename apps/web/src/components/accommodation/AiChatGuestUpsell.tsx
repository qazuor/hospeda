/**
 * @file AiChatGuestUpsell.tsx
 * @description Body of the AI chat panel for a visitor without a session
 * (HOS-2561). Explains what the chat can answer about the listing, shows a few
 * example questions and invites the visitor to create a free account. It never
 * talks to the chat API: there is no composer here, only two links.
 *
 * @module AiChatGuestUpsell
 */

import type { AiChatEntityType } from '@repo/schemas';
import type { Ref } from 'react';
import { resolveAiChatCopy } from '@/lib/ai-chat-copy';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AiChatGuestUpsell.module.css';
import { AiChatSuggestions } from './AiChatSuggestions';

/** Inputs for the signed-out AI chat gate. */
export interface AiChatGuestUpsellProps {
    /** Which kind of listing the chat is about (varies the copy). */
    readonly entityType: AiChatEntityType;
    readonly locale: SupportedLocale;
    /** Path (+ query + hash) of the current page, handed to auth as `returnUrl`. */
    readonly returnUrl: string;
    /** Ref to the primary CTA, so the panel can move focus there on open. */
    readonly primaryRef: Ref<HTMLAnchorElement>;
    readonly monthlyQuota?: number;
}

/**
 * Builds the sign-up and sign-in hrefs that bring the visitor back to
 * `returnUrl` after authenticating (same `?returnUrl=` contract as
 * `AuthRequiredPopover`).
 *
 * @param input.locale - Active locale.
 * @param input.returnUrl - Page to return to.
 * @returns `{ signUpHref, signInHref }`.
 */
export function buildAiChatAuthHrefs({
    locale,
    returnUrl
}: {
    readonly locale: SupportedLocale;
    readonly returnUrl: string;
}): { readonly signUpHref: string; readonly signInHref: string } {
    const query = `?returnUrl=${encodeURIComponent(returnUrl)}`;
    return {
        signUpHref: `/${locale}/auth/signup/${query}`,
        signInHref: `/${locale}/auth/signin/${query}`
    };
}

/**
 * Upsell body rendered inside the chat dialog for guests.
 *
 * @param props - Entity type, locale, return URL and the CTA focus ref.
 */
export function AiChatGuestUpsell({
    entityType,
    locale,
    returnUrl,
    primaryRef,
    monthlyQuota
}: AiChatGuestUpsellProps) {
    const { t, tPlural } = createTranslations(locale);
    const copy = (suffix: string): string => resolveAiChatCopy({ t, entityType, suffix });
    const { signUpHref, signInHref } = buildAiChatAuthHrefs({ locale, returnUrl });

    return (
        <div
            className={styles.upsell}
            data-testid="ai-chat-guest-upsell"
        >
            <p className={styles.intro}>{copy('guestIntro')}</p>
            <p className={styles.lead}>{copy('guestExamplesLead')}</p>
            <AiChatSuggestions
                copy={copy}
                action={{ href: signUpHref }}
            />
            <p className={styles.free}>
                {monthlyQuota === undefined
                    ? copy('guestFree')
                    : tPlural('accommodations.aiChat.guestMonthlyQuota', monthlyQuota)}
            </p>
            <a
                ref={primaryRef}
                href={signUpHref}
                className={styles.primary}
            >
                {copy('guestSignUp')}
            </a>
            <a
                href={signInHref}
                className={styles.secondary}
            >
                {copy('guestSignIn')}
            </a>
        </div>
    );
}
