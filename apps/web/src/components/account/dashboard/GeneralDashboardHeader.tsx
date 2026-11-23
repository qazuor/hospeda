/**
 * Identity header of the general dashboard (HOS-2473): Avatar, name, email and
 * ONE action, «Editar perfil». Rendered from Astro without hydration.
 *
 * @module components/account/dashboard/GeneralDashboardHeader
 */

import { Avatar, LinkButton, PageHeader } from '@/components/account/ui';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './Dashboard.module.css';

/** Props of {@link GeneralDashboardHeader}. */
export interface GeneralDashboardHeaderProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** The signed-in user's display name. */
    readonly name: string;
    /** The signed-in user's email. */
    readonly email: string;
    /** Profile picture URL, when there is one. */
    readonly image?: string | null;
}

/**
 * The dashboard's PageHeader: the only `h1` is the user's name.
 *
 * @param props - See {@link GeneralDashboardHeaderProps}.
 * @returns The PageHeader.
 */
export function GeneralDashboardHeader({
    locale,
    name,
    email,
    image
}: GeneralDashboardHeaderProps) {
    const t = createT(locale);
    return (
        <PageHeader
            locale={locale}
            helpId="section:account.dashboard"
            title={
                <span className={styles.identity}>
                    <Avatar
                        name={name}
                        src={image}
                        size="lg"
                        decorative
                    />
                    {name}
                </span>
            }
            description={email}
            actions={
                <LinkButton
                    href={buildUrl({ locale, path: 'mi-cuenta/editar' })}
                    variant="secondary"
                >
                    {t('account.pages.dashboard.nav.editProfile')}
                </LinkButton>
            }
        />
    );
}
