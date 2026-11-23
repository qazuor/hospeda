/**
 * Disclosure — a secondary, collapsed block (HOS-2506, A-4).
 *
 * A native `<details>` with a `<summary>` trigger: keyboard and screen-reader
 * support come from the platform, nothing is rebuilt. Closed by default, so the
 * secondary path (for example «Pegar URL» next to an image uploader) stays out
 * of the way until someone asks for it. Not a surface: it never draws a box,
 * so it can sit inside a `Section`.
 *
 * @module components/account/ui/Disclosure
 */

import { ChevronDownIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import { cx } from './cx';
import styles from './Disclosure.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link Disclosure}. */
export interface DisclosureProps {
    /** Trigger text. */
    readonly summary: ReactNode;
    /** Starts open. @default false */
    readonly defaultOpen?: boolean;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /** Collapsible content. */
    readonly children: ReactNode;
}

/**
 * The kit disclosure.
 *
 * @param props - See {@link DisclosureProps}.
 * @returns A `<details>` element.
 */
export function Disclosure({
    summary,
    defaultOpen = false,
    className,
    helpId,
    children
}: DisclosureProps) {
    return (
        <details
            {...helpAttr({ helpId })}
            className={cx(styles.root, className)}
            open={defaultOpen}
        >
            <summary className={styles.summary}>
                <ChevronDownIcon
                    size="sm"
                    className={styles.chevron}
                    aria-hidden="true"
                />
                {summary}
            </summary>
            <div className={styles.body}>{children}</div>
        </details>
    );
}
