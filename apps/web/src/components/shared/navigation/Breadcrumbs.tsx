import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { type BreadcrumbInputItem, buildBreadcrumbTrail } from '@/lib/navigation/breadcrumb-trail';
import styles from './Breadcrumbs.module.css';

/** Translated, presentational breadcrumb inputs shared by public and account pages. */
export interface BreadcrumbsProps {
    readonly items: readonly BreadcrumbInputItem[];
    readonly locale: SupportedLocale;
    readonly homeLabel: string;
    readonly ariaLabel: string;
    readonly includeHome?: boolean;
    readonly className?: string;
}

/** Render linked ancestors without client-side state or i18n. */
export function Breadcrumbs({
    items,
    locale,
    homeLabel,
    ariaLabel,
    includeHome = true,
    className
}: BreadcrumbsProps) {
    const input = { items, locale, homeLabel, includeHome };
    const { entries } = buildBreadcrumbTrail(input);
    return (
        <>
            {entries.length > 0 && (
                <nav
                    className={cn(styles.root, className)}
                    aria-label={ariaLabel}
                >
                    <ol className={styles.list}>
                        {entries.map((entry, index) => (
                            <li
                                key={`${entry.href}-${entry.label}`}
                                className={cn(
                                    styles.item,
                                    index === entries.length - 1 && styles.parent
                                )}
                            >
                                <a
                                    href={entry.href}
                                    className={styles.link}
                                    title={entry.label}
                                >
                                    <span
                                        className={styles.back}
                                        aria-hidden="true"
                                    >
                                        ‹
                                    </span>
                                    <span className={styles.label}>{entry.label}</span>
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>
            )}
        </>
    );
}
