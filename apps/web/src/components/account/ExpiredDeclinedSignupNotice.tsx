/**
 * @file ExpiredDeclinedSignupNotice.tsx
 * @description The notice that follows a declined signup once its seven-day retry window has
 * passed (HOS-2193): it says the charge was declined and links to the plans page of that vertical
 * so the owner can start again. Static markup (no hydration): the page resolves every string and
 * the link.
 */
import { Alert, LinkButton } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';

/** Props of {@link ExpiredDeclinedSignupNotice}. */
export interface ExpiredDeclinedSignupNoticeProps {
    /** Locale for the kit's hidden tone prefix. */
    readonly locale: SupportedLocale;
    /** The vertical of the declined signup, for the test id. */
    readonly vertical: string;
    /** Localized heading. */
    readonly title: string;
    /** Localized body, naming the plan and the vertical. */
    readonly body: string;
    /** Localized call to action. */
    readonly ctaLabel: string;
    /** Locale-prefixed plans page of the vertical. */
    readonly href: string;
}

/**
 * Renders the restart notice for one expired declined signup.
 *
 * @param props - See {@link ExpiredDeclinedSignupNoticeProps}.
 * @returns A warning alert with a single "start again" link.
 */
export function ExpiredDeclinedSignupNotice({
    locale,
    vertical,
    title,
    body,
    ctaLabel,
    href
}: ExpiredDeclinedSignupNoticeProps) {
    return (
        <div data-testid={`expired-declined-signup-${vertical}`}>
            <Alert
                tone="warning"
                locale={locale}
                title={title}
                action={
                    <LinkButton
                        href={href}
                        data-testid={`expired-declined-signup-${vertical}-cta`}
                    >
                        {ctaLabel}
                    </LinkButton>
                }
            >
                {body}
            </Alert>
        </div>
    );
}
