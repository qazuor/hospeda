/**
 * Visual — the wrapper that makes one kit state screenshot-able (HOS-2413 T-029).
 *
 * Every state of every kit component on the gallery page sits inside one of
 * these. The visual-regression suite finds them by `data-visual` and shoots
 * each in light and dark, at 1280 and 375.
 *
 * @module components/account/kit-gallery/Visual
 */

import type { ReactNode } from 'react';
import styles from './KitGallery.module.css';

/** Props of {@link Visual}. */
export interface VisualProps {
    /** `<Component>/<state>`, unique on the page. */
    readonly name: string;
    /** The state to show. */
    readonly children: ReactNode;
}

/**
 * Wraps a state for the visual-regression suite.
 *
 * @param props - See {@link VisualProps}.
 * @returns A labelled `<figure>` carrying `data-visual`.
 */
export function Visual({ name, children }: VisualProps) {
    return (
        <figure
            className={styles.visual}
            data-visual={name}
        >
            <figcaption className={styles.caption}>{name}</figcaption>
            <div className={styles.stage}>{children}</div>
        </figure>
    );
}
