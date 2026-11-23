/**
 * EditorSwitcher — the editor's sticky section switcher (HOS-2486, spec
 * HOS-2415 §6.1, D2 «nav del editor por container query»).
 *
 * «‹ · Listing · Section (n/N) ▾ · ›»: previous and next are real `<a>` links,
 * and the menu is a native `<details>` listing every section with its status.
 * Every way out is therefore a link, so the ONE unsaved-changes guard
 * (`leave-warning-registry`) intercepts all of them; nothing here listens for a
 * click. It renders from Astro with NO `client:*`.
 *
 * It does not decide WHEN it shows: the editor shell shows it below 60rem of
 * content width and the `EditorSectionNav` column from there. The sticky offset
 * is `--editor-switcher-top`, which the shell sets under the account bars.
 *
 * Feed it `buildEditorSwitcherModel` from `lib/editor/editor-switcher-model`.
 *
 * @module components/account/ui/EditorSwitcher
 */

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import type { EditorNavLink } from '@/lib/editor/editor-route-nav-model';
import type { EditorSwitcherModel } from '@/lib/editor/editor-switcher-model';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import { EditorNavStatusMark } from './EditorSectionNav';
import styles from './EditorSwitcher.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link EditorSwitcher}. */
export interface EditorSwitcherProps {
    /** The switcher model. */
    readonly model: EditorSwitcherModel;
    /** The listing's name, shown before the section. */
    readonly entityName: string;
    /** Locale for the labels. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * One previous / next step: a link, or an inert placeholder at either end so
 * the bar keeps its shape.
 *
 * @param input - Options object.
 * @param input.link - The target section, if any.
 * @param input.direction - Which step this is.
 * @param input.label - The step's accessible name.
 * @returns The step.
 */
function Step({
    link,
    direction,
    label
}: {
    readonly link: EditorNavLink | null;
    readonly direction: 'previous' | 'next';
    readonly label: string;
}) {
    const icon =
        direction === 'previous' ? (
            <ChevronLeftIcon
                size="sm"
                aria-hidden="true"
            />
        ) : (
            <ChevronRightIcon
                size="sm"
                aria-hidden="true"
            />
        );
    if (link === null) {
        return (
            <span
                className={cx(styles.step, styles.stepInert)}
                aria-hidden="true"
            >
                {icon}
            </span>
        );
    }
    return (
        <a
            href={link.href}
            className={styles.step}
            aria-label={label}
            rel={direction === 'previous' ? 'prev' : 'next'}
        >
            {icon}
        </a>
    );
}

/**
 * The kit editor switcher.
 *
 * @param props - See {@link EditorSwitcherProps}.
 * @returns A labelled `<nav>` with previous, the section menu and next.
 */
export function EditorSwitcher({
    model,
    entityName,
    locale,
    className,
    helpId
}: EditorSwitcherProps) {
    const t = createT(locale);
    const currentLabel = model.current ? t(model.current.labelKey) : null;

    return (
        <nav
            {...helpAttr({ helpId })}
            aria-label={t('account.ui.editorNav.switcherLabel')}
            className={cx(styles.root, className)}
        >
            <Step
                link={model.previous}
                direction="previous"
                label={
                    model.previous
                        ? t('account.ui.editorNav.previous', undefined, {
                              section: t(model.previous.labelKey)
                          })
                        : ''
                }
            />
            <details className={styles.menu}>
                <summary className={styles.summary}>
                    <span className={styles.titles}>
                        <span className={styles.entity}>{entityName}</span>
                        <span className={styles.section}>
                            {currentLabel ?? t('account.ui.editorNav.allSections')}
                        </span>
                    </span>
                    {model.position === null ? null : (
                        <span className={styles.position}>
                            <span aria-hidden="true">
                                {model.position}/{model.total}
                            </span>
                            <span className={styles.srOnly}>
                                {t('account.ui.editorNav.position', undefined, {
                                    position: model.position,
                                    total: model.total
                                })}
                            </span>
                        </span>
                    )}
                    <ChevronDownIcon
                        size="sm"
                        aria-hidden="true"
                        className={styles.chevron}
                    />
                </summary>
                <div className={styles.panel}>
                    {model.groups.map((group) => (
                        <div
                            key={group.group}
                            className={styles.group}
                        >
                            <p className={styles.heading}>{t(group.headingKey)}</p>
                            <ul className={styles.list}>
                                {group.links.map((link) => (
                                    <li key={link.sectionId}>
                                        <a
                                            href={link.href}
                                            className={styles.item}
                                            aria-current={link.isActive ? 'page' : undefined}
                                        >
                                            <span>{t(link.labelKey)}</span>
                                            {link.status ? (
                                                <EditorNavStatusMark
                                                    status={link.status}
                                                    label={t(
                                                        `account.ui.editorNav.status.${link.status}`
                                                    )}
                                                />
                                            ) : null}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </details>
            <Step
                link={model.next}
                direction="next"
                label={
                    model.next
                        ? t('account.ui.editorNav.next', undefined, {
                              section: t(model.next.labelKey)
                          })
                        : ''
                }
            />
        </nav>
    );
}
