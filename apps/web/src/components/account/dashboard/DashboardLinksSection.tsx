/**
 * A Section of entry-point rows for the account dashboards (HOS-2473,
 * HOS-2474). Rendered from Astro without hydration: it is a list of links.
 *
 * @module components/account/dashboard/DashboardLinksSection
 */

import {
    BriefcaseIcon,
    BuildingIcon,
    ChatIcon,
    CreditCardIcon,
    DashboardIcon,
    MegaphoneIcon,
    NewsletterIcon,
    SettingsIcon
} from '@repo/icons';
import type { ReactNode } from 'react';
import { type HelpAnchor, ListRow, Section } from '@/components/account/ui';
import type { DashboardRow, DashboardRowIcon } from '@/lib/account/dashboard-rows';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './Dashboard.module.css';

/** Props of {@link DashboardLinksSection}. */
export interface DashboardLinksSectionProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Translated section title. */
    readonly title: string;
    /** Help anchor of the section. */
    readonly helpId: HelpAnchor;
    /** The rows, in display order. */
    readonly rows: readonly DashboardRow[];
}

/** Icon element per row icon. */
const ICONS: Readonly<Record<DashboardRowIcon, ReactNode>> = {
    dashboard: <DashboardIcon size={20} />,
    building: <BuildingIcon size={20} />,
    briefcase: <BriefcaseIcon size={20} />,
    chat: <ChatIcon size={20} />,
    settings: <SettingsIcon size={20} />,
    newsletter: <NewsletterIcon size={20} />,
    megaphone: <MegaphoneIcon size={20} />,
    card: <CreditCardIcon size={20} />
};

/**
 * Entry-point rows in one flush Section.
 *
 * @param props - See {@link DashboardLinksSectionProps}.
 * @returns The Section.
 */
export function DashboardLinksSection({ locale, title, helpId, rows }: DashboardLinksSectionProps) {
    const t = createT(locale);
    return (
        <Section
            title={title}
            helpId={helpId}
            flush
        >
            <ul className={styles.rows}>
                {rows.map((row) => (
                    <ListRow
                        key={row.id}
                        rowId={row.id}
                        title={t(row.labelKey)}
                        description={row.descriptionKey ? t(row.descriptionKey) : undefined}
                        href={buildUrl({ locale, path: row.path })}
                        media={ICONS[row.icon]}
                    />
                ))}
            </ul>
        </Section>
    );
}
