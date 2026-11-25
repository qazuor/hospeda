/**
 * @file AnalyticsTrafficBlock.client.tsx
 * @description Umami traffic block of the host analytics section (HOS-2119).
 *
 * The host dashboard is aggregate-only, but traffic stats are per listing. The
 * block therefore shows ONE `TrafficStatsCards` for the selected property:
 * - 0 properties: nothing is rendered.
 * - 1 property: the cards show directly, no selector.
 * - 2+ properties: a labelled `<select>` picks the property; the default is the
 *   first one in the order received (the API lists newest first).
 *
 * The window is controlled by the parent (`AnalyticsSection.viewsWindow`) and
 * handed down as a prop, so a toggle never remounts the island.
 */

import { EntityTypeEnum } from '@repo/schemas';
import { type JSX, useState } from 'react';
import { Field, Section, Select } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { TrafficStatsCards } from '../listing/TrafficStatsCards.client';
import styles from './AnalyticsSection.module.css';

/** One owned accommodation the traffic block can show. */
export interface AnalyticsTrafficProperty {
    readonly id: string;
    readonly name: string;
}

/** Props of {@link AnalyticsTrafficBlock}. */
export interface AnalyticsTrafficBlockProps {
    /** Locale used for copy. */
    readonly locale: SupportedLocale;
    /** The host's accommodations, in display order. */
    readonly properties: readonly AnalyticsTrafficProperty[];
    /** Window owned by the parent section's toggle. */
    readonly window: '7d' | '30d';
}

/**
 * Traffic block beneath the host views cards.
 *
 * @param props - See {@link AnalyticsTrafficBlockProps}.
 * @returns The block, or `null` when the host has no accommodations.
 */
export function AnalyticsTrafficBlock({
    locale,
    properties,
    window
}: AnalyticsTrafficBlockProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const first = properties[0];
    if (!first) return null;

    // A stale selection (property no longer listed) falls back to the first.
    const selected = properties.find((property) => property.id === selectedId) ?? first;

    return (
        <div
            className={styles.trafficBlock}
            data-testid="analytics-traffic-block"
        >
            <Section
                title={t('listing.owner.traffic.title', 'Tráfico de tus fichas')}
                helpId="section:host.dashboard"
            >
                {properties.length > 1 ? (
                    <Field
                        locale={locale}
                        label={t('listing.owner.traffic.propertySelectLabel', 'Propiedad')}
                    >
                        <Select
                            value={selected.id}
                            onChange={(event) => setSelectedId(event.target.value)}
                        >
                            {properties.map((property) => (
                                <option
                                    key={property.id}
                                    value={property.id}
                                >
                                    {property.name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                ) : null}
                <TrafficStatsCards
                    locale={locale}
                    entityType={EntityTypeEnum.ACCOMMODATION}
                    entityId={selected.id}
                    window={window}
                />
            </Section>
        </div>
    );
}
