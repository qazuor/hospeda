/**
 * Section — the flat surface of the Mi Cuenta kit (HOS-2413 T-005).
 *
 * D5 «secciones planas con barra degradé»: a bordered `core-card` with a 3px
 * brand-gradient top bar, `radius-surface`, no shadow and no hover.
 *
 * - Root is `<section aria-labelledby>` with an `h2` title (`headingLevel={3}`
 *   when it sits under an h2) and `data-kit-section`.
 * - `helpId` is REQUIRED: every section points at its help article.
 * - `flush` removes the body padding (tables, lists). `footer` actions align
 *   right, and go full width under 30rem of container width.
 * - Never nest: a Section inside a Section throws `KitNestingError` in
 *   development and tests. In production it logs and renders the children
 *   without the box.
 *
 * @module components/account/ui/Section
 */

import { type ReactNode, useContext, useId } from 'react';
import { webLogger } from '@/lib/logger';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './Section.module.css';
import { KitNestingError, SectionDepthContext } from './section-depth-context';

/** Visual variants of a {@link Section}. */
export type SectionVariant = 'default' | 'danger';

/** Props of {@link Section}. */
export interface SectionProps {
    /** Section title, rendered as the heading. */
    readonly title: ReactNode;
    /** Accessible name when a surrounding page already supplies the heading. */
    readonly ariaLabel?: string;
    /** Optional supporting line under the title. */
    readonly description?: ReactNode;
    /** Optional header actions, aligned right. */
    readonly actions?: ReactNode;
    /** Optional footer actions, aligned right. */
    readonly footer?: ReactNode;
    /** `danger` swaps the border and the title color to the danger roles. @default 'default' */
    readonly variant?: SectionVariant;
    /** Remove the body padding (tables, lists). */
    readonly flush?: boolean;
    /** Heading level. @default 2 */
    readonly headingLevel?: 2 | 3;
    /** REQUIRED help anchor, rendered as `data-help`. */
    readonly helpId: HelpAnchor;
    /** Optional DOM id of the root. */
    readonly id?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Section body. */
    readonly children?: ReactNode;
}

/** True when nesting must throw instead of degrading (development and tests). */
function shouldThrowOnNesting(): boolean {
    return import.meta.env.DEV === true || import.meta.env.MODE === 'test';
}

/**
 * The kit surface.
 *
 * @param props - See {@link SectionProps}.
 * @returns A `<section>` element.
 * @throws {KitNestingError} When nested inside another Section in development or tests.
 */
export function Section({
    title,
    ariaLabel,
    description,
    actions,
    footer,
    variant = 'default',
    flush,
    headingLevel = 2,
    helpId,
    id,
    className,
    children
}: SectionProps) {
    const nested = useContext(SectionDepthContext);
    const titleId = useId();

    if (nested) {
        if (shouldThrowOnNesting()) throw new KitNestingError();
        webLogger.error('Section nested inside another Section: rendering without the box.');
        return <>{children}</>;
    }

    const Heading = headingLevel === 3 ? 'h3' : 'h2';

    return (
        <SectionDepthContext.Provider value={true}>
            <section
                id={id}
                aria-labelledby={title ? titleId : undefined}
                aria-label={title ? undefined : ariaLabel}
                data-kit-section=""
                {...helpAttr({ helpId })}
                className={cx(
                    styles.root,
                    variant === 'danger' && styles.danger,
                    flush && styles.flush,
                    className
                )}
            >
                {title || description || actions ? (
                    <header className={styles.header}>
                        <div className={styles.heading}>
                            {title ? (
                                <Heading
                                    id={titleId}
                                    className={styles.title}
                                >
                                    {title}
                                </Heading>
                            ) : null}
                            {description ? (
                                <p className={styles.description}>{description}</p>
                            ) : null}
                        </div>
                        {actions ? <div className={styles.actions}>{actions}</div> : null}
                    </header>
                ) : null}
                <div className={styles.body}>{children}</div>
                {footer ? <footer className={styles.footer}>{footer}</footer> : null}
            </section>
        </SectionDepthContext.Provider>
    );
}
