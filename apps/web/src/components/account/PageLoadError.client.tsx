/**
 * @file PageLoadError.client.tsx
 * @description The kit `ErrorState` for an SSR read that failed (HOS-2483 /
 * HOS-2484): the page could not read its main list, so it says so and offers a
 * retry that reloads the page. Never an empty state: a failed read is not «you
 * have nothing» (HOS-2421).
 */

import { ErrorState, type HelpAnchor } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';

/** Props of {@link PageLoadError}. */
export interface PageLoadErrorProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
    /** Translated title: what could not be read. Defaults to the kit copy. */
    readonly title?: string;
    /** Translated body: reassurance and what to do. Defaults to the kit copy. */
    readonly description?: string;
    /** Help anchor of the region that failed. */
    readonly helpId?: HelpAnchor;
}

/**
 * Renders the retryable error block.
 *
 * @param props - See {@link PageLoadErrorProps}.
 * @returns The kit error state; retry reloads the page.
 */
export function PageLoadError({ locale, title, description, helpId }: PageLoadErrorProps) {
    return (
        <ErrorState
            locale={locale}
            onRetry={() => window.location.reload()}
            title={title}
            description={description}
            helpId={helpId}
        />
    );
}
