/**
 * @file ProviderLoadError.client.tsx
 * @description The transient-failure state of the provider detail page: the kit
 * ErrorState with a retry that reloads the page (HOS-2472). A failed read is
 * never rendered as «not found» or as an empty provider.
 */

import { ErrorState } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';

/** Props for {@link ProviderLoadError}. */
export interface ProviderLoadErrorProps {
    /** Page locale. */
    readonly locale: SupportedLocale;
}

/**
 * Renders the retryable error block.
 *
 * @param props - {@link ProviderLoadErrorProps}
 * @returns The error state.
 */
export function ProviderLoadError({ locale }: ProviderLoadErrorProps) {
    return (
        <ErrorState
            locale={locale}
            onRetry={() => window.location.reload()}
            helpId="section:hosttrade.detalle"
        />
    );
}
