/**
 * @file CollectionUsageMeter.client.tsx
 * @description React island rendering the "X / max" bookmark-collection usage
 * counter and its progress bar in Mi cuenta -> Favoritos (HOS-999).
 *
 * Extracted from `favoritos/index.astro`, where this markup used to live
 * inline. Reactive by design: it listens for `COLLECTION_CREATED_EVENT`
 * (dispatched by `CreateCollectionCTA` and `MoveToCollectionModal` after a
 * successful create) and re-fetches its own usage, so the counter bumps from
 * "0 / 25" to "1 / 25" the instant a collection is created -- no
 * `window.location.reload()` needed (that reload used to lose scroll
 * position and the active tab, and killed the success toast before it could
 * render).
 *
 * SSR-first (apps/web/CLAUDE.md "SSR-first principle for islands"): state is
 * seeded from the `initial` prop -- the same `usage` the page's SSR fetch
 * already resolved -- never from a placeholder. When `initial` is `null` (the
 * SSR fetch failed, there was no session cookie, or the actor hit the
 * `ENTITLEMENT_REQUIRED` gate from HOS-899) the meter renders nothing and
 * stays that way rather than guessing "0 / 0": without SSR confirmation of
 * access it must never imply a cap the actor may not even have. A refetch
 * that itself comes back `ENTITLEMENT_REQUIRED` (a mid-session downgrade)
 * hides the meter the same way instead of throwing.
 *
 * Hydration: caller must use `client:load`.
 */

import { useCallback, useEffect, useState } from 'react';
import type { BookmarkCollectionUsage } from '@/lib/api';
import { userBookmarkCollectionsApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import styles from './CollectionUsageMeter.module.css';
import { COLLECTION_CREATED_EVENT } from './collection-created-event';

/** Only one collection row is needed -- `usage` rides along on every page of the list endpoint. */
const USAGE_PROBE_PAGE_SIZE = 1;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CollectionUsageMeterProps {
    /** Active locale for i18n strings */
    readonly locale: SupportedLocale;
    /**
     * SSR-resolved usage counters, or `null` when the SSR fetch failed, had no
     * session cookie, or hit the `ENTITLEMENT_REQUIRED` gate (HOS-899). Seeds
     * the component's state directly -- see the SSR-first note above.
     */
    readonly initial: BookmarkCollectionUsage | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "X / max" collection usage counter with a progress bar.
 * Renders nothing when usage is unknown (see `initial` prop doc).
 */
export function CollectionUsageMeter({ locale, initial }: CollectionUsageMeterProps) {
    const t = createT(locale);
    const [usage, setUsage] = useState<BookmarkCollectionUsage | null>(initial);

    const refetchUsage = useCallback(async (): Promise<void> => {
        const result = await userBookmarkCollectionsApi.list({
            page: 1,
            pageSize: USAGE_PROBE_PAGE_SIZE
        });

        if (result.ok) {
            setUsage(result.data.usage);
            return;
        }

        // Same ENTITLEMENT_REQUIRED gate the SSR fetch checks (HOS-899) -- a
        // mid-session downgrade must hide the meter, never throw. Any other
        // error leaves the last known value on screen: a transient failure on
        // a best-effort refresh shouldn't blank out a counter that was
        // correct a second ago.
        if (result.error.code === 'ENTITLEMENT_REQUIRED') {
            setUsage(null);
        }
    }, []);

    useEffect(() => {
        const onCollectionCreated = () => {
            void refetchUsage();
        };
        window.addEventListener(COLLECTION_CREATED_EVENT, onCollectionCreated);
        return () => window.removeEventListener(COLLECTION_CREATED_EVENT, onCollectionCreated);
    }, [refetchUsage]);

    if (usage === null) {
        return null;
    }

    const isAtLimit = usage.current >= usage.max;
    const usageRatio = usage.max > 0 ? Math.min(usage.current / usage.max, 1) : 0;

    const usageLabel = t('account.favorites.collections.usage', '{{current}} / {{max}}', {
        current: usage.current,
        max: usage.max
    });

    const limitReachedLabel = isAtLimit
        ? t('account.favorites.collections.limit_reached', 'Límite alcanzado ({{max}})', {
              max: usage.max
          })
        : null;

    return (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> is only for form-control groups; role="group" is the correct ARIA for a non-form label+progressbar group.
        <div
            className={isAtLimit ? `${styles.root} ${styles.warning}` : styles.root}
            role="group"
            aria-label={limitReachedLabel ?? usageLabel}
            title={limitReachedLabel ?? usageLabel}
        >
            <span className={styles.text}>{usageLabel}</span>

            <div
                className={styles.barTrack}
                role="progressbar"
                aria-valuenow={usage.current}
                aria-valuemin={0}
                aria-valuemax={usage.max}
            >
                <div
                    className={styles.barFill}
                    style={{ width: `${(usageRatio * 100).toFixed(1)}%` }}
                />
            </div>
        </div>
    );
}
