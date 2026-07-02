/**
 * @file ExclusiveDealsList.client.tsx
 * @description React island for the exclusive-deals listing page (HOS-21
 * T-011 shell). Placeholder pending the full implementation in T-012 (fetch
 * from `GET /api/v1/protected/owner-promotions/exclusive-deals`, loading/
 * empty/populated states, ENTITLEMENT_REQUIRED upgrade CTA, VIP-only badge).
 *
 * Hydration: caller MUST use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ExclusiveDealsList.module.css';

/** Props for the ExclusiveDealsList island. */
export interface ExclusiveDealsListProps {
    /** Active locale for i18n and URL building. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /** Authenticated user ID. Reserved for future display purposes. */
    readonly userId: string;
}

/**
 * Exclusive-deals list island.
 *
 * T-011 ships this as a loading-only shell so the SSR page can mount it;
 * T-012 replaces the body with the full fetch + state machine.
 */
export function ExclusiveDealsList({
    locale,
    apiUrl: _apiUrl,
    userId: _userId
}: ExclusiveDealsListProps) {
    const { t } = createTranslations(locale);

    return (
        <div
            className={styles.dealsShell}
            aria-busy="true"
        >
            <p
                className={styles.dealsLoading}
                aria-live="polite"
            >
                {t('account.exclusiveDeals.loading', 'Cargando ofertas exclusivas...')}
            </p>
        </div>
    );
}
