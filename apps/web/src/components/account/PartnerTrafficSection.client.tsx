/**
 * @file PartnerTrafficSection.client.tsx
 * @description Owner-facing Umami traffic section of the partner panel
 * (HOS-2119 T-054): a titled section that owns the 7d/30d/90d selector and
 * hands the chosen window to {@link TrafficStatsCards}.
 *
 * It is a SIBLING of `PartnerStatsSection.astro` (HOS-1063 AC-8), never part
 * of it: that section keeps every key under `account.partnerStats.*`, this one
 * uses the `listing.owner.traffic.*` subtree. The page decides WHETHER to mount
 * it (only for a partner with its own page, via `resolvePartnerTrafficId`, the
 * same gate as the views card), so a partner without a page sees nothing.
 *
 * Hydration: mount with `client:visible`, below the statistics section.
 */

import { EntityTypeEnum, type ListingTrafficStatsWindow } from '@repo/schemas';
import type { JSX } from 'react';
import { useState } from 'react';
import { TrafficStatsCards } from '@/components/listing/TrafficStatsCards.client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PartnerTrafficSection.module.css';

/** Selectable windows, in display order. */
const WINDOWS: readonly ListingTrafficStatsWindow[] = ['7d', '30d', '90d'];

/** Spanish fallbacks for the window button labels. */
const WINDOW_FALLBACKS: Readonly<Record<ListingTrafficStatsWindow, string>> = {
    '7d': '7 días',
    '30d': '30 días',
    '90d': '90 días'
};

/** Props of {@link PartnerTrafficSection}. */
export interface PartnerTrafficSectionProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Id of the caller's partner (resolved server-side from the session). */
    readonly partnerId: string;
}

/**
 * PartnerTrafficSection — heading, window selector and traffic cards of one
 * partner.
 *
 * @example
 * ```astro
 * <PartnerTrafficSection client:visible locale={locale} partnerId={stats.partner.id} />
 * ```
 */
export function PartnerTrafficSection({
    locale,
    partnerId
}: PartnerTrafficSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [windowParam, setWindowParam] = useState<ListingTrafficStatsWindow>('30d');

    return (
        <section
            className={styles.section}
            data-testid="partner-traffic-section"
        >
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('listing.owner.traffic.partnerTitle', 'Tráfico de tu página')}
                </h2>
                <fieldset
                    className={styles.toggle}
                    aria-label={t('common.window.ariaLabel', 'Período de tiempo')}
                >
                    {WINDOWS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={
                                windowParam === option ? styles.toggleActive : styles.toggleButton
                            }
                            onClick={() => setWindowParam(option)}
                            aria-pressed={windowParam === option}
                        >
                            {t(`common.window.${option}`, WINDOW_FALLBACKS[option])}
                        </button>
                    ))}
                </fieldset>
            </div>
            <TrafficStatsCards
                locale={locale}
                entityType={EntityTypeEnum.PARTNER}
                entityId={partnerId}
                window={windowParam}
            />
        </section>
    );
}
