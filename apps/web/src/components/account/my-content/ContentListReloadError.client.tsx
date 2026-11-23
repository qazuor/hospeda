/**
 * @file ContentListReloadError.client.tsx
 * @description The failed-read state of a server-rendered authored-content
 * list (HOS-2505): the kit `ErrorState` whose retry reloads the page, which
 * re-runs the server read. A failed read is never shown as an empty list.
 */

import { ErrorState } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';

/** Props of {@link ContentListReloadError}. */
export interface ContentListReloadErrorProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
}

/**
 * Renders the retryable error block.
 *
 * @param props - See {@link ContentListReloadErrorProps}.
 * @returns The error state.
 */
export function ContentListReloadError({ locale }: ContentListReloadErrorProps) {
    return (
        <ErrorState
            locale={locale}
            onRetry={() => window.location.reload()}
        />
    );
}
