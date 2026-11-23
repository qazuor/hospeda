/**
 * SectionLoadError — the error body of a server-rendered account Section
 * (HOS-2502).
 *
 * A Section that is read on the server cannot offer an in-place retry (there is
 * no island), so the honest control is a link back to the same page, which
 * re-runs the read. It is the static twin of the kit `ErrorState`: an inline
 * danger `Alert` with the translated title, body and «Reintentar».
 *
 * @module components/account/SectionLoadError
 */

import { Alert, LinkButton } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Props of {@link SectionLoadError}. */
export interface SectionLoadErrorProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** URL of the current page: the retry link reloads it. */
    readonly retryHref: string;
    /** Overrides the generic body with a more specific sentence. */
    readonly description?: string;
}

/**
 * Inline error for a Section whose server-side read failed.
 *
 * @param props - See {@link SectionLoadErrorProps}.
 * @returns A danger alert with a retry link.
 */
export function SectionLoadError({ locale, retryHref, description }: SectionLoadErrorProps) {
    const t = createT(locale);
    return (
        <Alert
            tone="danger"
            locale={locale}
            title={t('account.ui.error.title')}
            action={
                <LinkButton
                    href={retryHref}
                    variant="secondary"
                    size="sm"
                >
                    {t('account.ui.error.retry')}
                </LinkButton>
            }
        >
            {description ?? t('account.ui.error.description')}
        </Alert>
    );
}
