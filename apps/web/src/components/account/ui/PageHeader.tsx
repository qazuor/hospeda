/**
 * PageHeader — one page anatomy for every account page (HOS-2413 T-022).
 *
 * The title is the page's ONLY `h1`. Optional parts: breadcrumbs
 * (linked ancestors only), a `back` link
 * (a real link with a translated label, NEVER `history.back()`), a `status`
 * (StatusPill), a `help` slot (the page's «?», see `PageHelpLink.astro`),
 * `actions` and `tabs`. Put at most ONE primary action in
 * `actions`; below 30rem of container width the actions stack and go full
 * width.
 *
 * @module components/account/ui/PageHeader
 */

import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/shared/navigation/Breadcrumbs';
import { createT, type SupportedLocale } from '@/lib/i18n';
import type { BreadcrumbInputItem } from '@/lib/navigation/breadcrumb-trail';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './PageHeader.module.css';
import { TextLink } from './TextLink';

/** Props of {@link PageHeader}. */
export interface PageHeaderProps {
    /** The page title: the only `h1`. */
    readonly title: ReactNode;
    /** Locale for the fixed copy. */
    readonly locale: SupportedLocale;
    /** One supporting line under the title. */
    readonly description?: ReactNode;
    /** Breadcrumb trail, last item = current page. */
    readonly breadcrumbs?: readonly BreadcrumbInputItem[];
    /** A real link back, with a translated label. */
    readonly back?: { readonly label: string; readonly href: string };
    /** A StatusPill next to the title. */
    readonly status?: ReactNode;
    /**
     * The page's own «?» (HOS-2546), rendered right after the title. Since
     * HOS-2546 the account layout renders no «?» row, so a page with its own
     * article must put its «?» here. From Astro, pass
     * `<PageHelpLink slot="help" locale={locale} />`.
     */
    readonly help?: ReactNode;
    /** Actions on the right. At most one primary. */
    readonly actions?: ReactNode;
    /** A Tabs or NavTabs under the header. */
    readonly tabs?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit page header.
 *
 * @param props - See {@link PageHeaderProps}.
 * @returns A `<header>` with the title and its optional parts.
 */
export function PageHeader({
    title,
    locale,
    description,
    breadcrumbs,
    back,
    status,
    help,
    actions,
    tabs,
    className,
    helpId
}: PageHeaderProps) {
    const t = createT(locale);
    return (
        <header
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
        >
            {back ? (
                <TextLink
                    href={back.href}
                    tone="muted"
                >
                    ← {back.label}
                </TextLink>
            ) : null}
            {breadcrumbs && breadcrumbs.length > 0 ? (
                <Breadcrumbs
                    items={breadcrumbs}
                    locale={locale}
                    homeLabel=""
                    ariaLabel={t('account.ui.breadcrumbs')}
                    includeHome={false}
                />
            ) : null}
            <div className={styles.top}>
                <div className={styles.heading}>
                    <div className={styles.titleRow}>
                        <h1 className={styles.title}>{title}</h1>
                        {help ? <span className={styles.help}>{help}</span> : null}
                        {status}
                    </div>
                    {description ? <p className={styles.description}>{description}</p> : null}
                </div>
                {actions ? <div className={styles.actions}>{actions}</div> : null}
            </div>
            {tabs}
        </header>
    );
}
