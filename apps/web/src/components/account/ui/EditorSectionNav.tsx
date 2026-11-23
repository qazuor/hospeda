/**
 * EditorSectionNav — the editor's section column (HOS-2486, spec HOS-2415
 * §6.1, D2 «nav del editor por container query»).
 *
 * A `nav` landmark with one titled list per group; every item is a real `<a>`
 * (so the unsaved-changes guard intercepts it), the current one carries
 * `aria-current="page"`, and a known status shows as a word, never as color
 * alone. It renders from Astro with NO `client:*`: the active item is the
 * current route, known at render time.
 *
 * It does not decide WHEN it shows. The editor shell shows it from 60rem of
 * content width (`@container`) and the `EditorSwitcher` below that.
 *
 * Feed it `buildEditorNavModel` from `lib/editor/editor-route-nav-model`.
 *
 * @module components/account/ui/EditorSectionNav
 */

import { LockIcon } from '@repo/icons';
import type { EditorNavGroup, EditorNavStatus } from '@/lib/editor/editor-route-nav-model';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import styles from './EditorSectionNav.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link EditorSectionNav}. */
export interface EditorSectionNavProps {
    /** The nav model: groups with their heading key and links. */
    readonly groups: readonly EditorNavGroup[];
    /** Locale for the labels. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The status word of a section, with its visual treatment.
 *
 * @param input - Options object.
 * @param input.status - The section status.
 * @param input.label - Its translated word.
 * @returns A small inline marker.
 */
export function EditorNavStatusMark({
    status,
    label
}: {
    readonly status: EditorNavStatus;
    readonly label: string;
}) {
    return (
        <span
            className={cx(styles.status, styles[status])}
            data-status={status}
        >
            {status === 'locked' ? (
                <LockIcon
                    size="xs"
                    aria-hidden="true"
                />
            ) : (
                <span
                    className={styles.dot}
                    aria-hidden="true"
                />
            )}
            {label}
        </span>
    );
}

/**
 * The kit editor section column.
 *
 * @param props - See {@link EditorSectionNavProps}.
 * @returns A labelled `<nav>` with one list per group.
 */
export function EditorSectionNav({ groups, locale, className, helpId }: EditorSectionNavProps) {
    const t = createT(locale);
    return (
        <nav
            {...helpAttr({ helpId })}
            aria-label={t('account.ui.editorNav.label')}
            className={cx(styles.root, className)}
        >
            {groups.map((group) => (
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
                                    className={styles.link}
                                    aria-current={link.isActive ? 'page' : undefined}
                                >
                                    <span className={styles.label}>{t(link.labelKey)}</span>
                                    {link.status ? (
                                        <EditorNavStatusMark
                                            status={link.status}
                                            label={t(`account.ui.editorNav.status.${link.status}`)}
                                        />
                                    ) : null}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
