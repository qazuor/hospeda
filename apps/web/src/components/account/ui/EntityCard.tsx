/**
 * EntityCard and EntityCardGrid — one card for a saved or suggested entity
 * (HOS-2480, spec HOS-2414 §6.2).
 *
 * First consumer: favorites and their collections. Later: recommendations.
 *
 * Anatomy: a media block (the entity image, or a decorative `media` node when
 * there is no image, or the translated «Sin imagen» placeholder), the title
 * (a real link when `href` is given), an optional `meta` line, a free body
 * slot (`children`, e.g. a personal note) and a footer of `actions`. A `badge`
 * sits over the media corner (e.g. a count).
 *
 * The card does not transform image URLs: the caller passes the final `src`
 * (for Cloudinary, through `getMediaUrl`). `EntityCardGrid` lays the cards out
 * by its own container width: one column, two from 30rem, three from 48rem.
 *
 * @module components/account/ui/EntityCard
 */

import type { ReactNode } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { cx } from './cx';
import styles from './EntityCard.module.css';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** The entity image. */
export interface EntityCardImage {
    /** Final URL, already transformed by the caller. */
    readonly src: string;
    /** Translated alternative text. */
    readonly alt: string;
}

/** Props of {@link EntityCard}. */
export interface EntityCardProps {
    /** Visible title. */
    readonly title: ReactNode;
    /** Locale for the fixed copy (the no-image placeholder). */
    readonly locale: SupportedLocale;
    /** Destination of the title link. Without it the title is plain text. */
    readonly href?: string;
    /** The entity image. Wins over `media`. */
    readonly image?: EntityCardImage;
    /** Decorative visual shown when there is no image (an icon, a color). */
    readonly media?: ReactNode;
    /** One short line under the title (the type, a count). */
    readonly meta?: ReactNode;
    /** Small element over the media corner. */
    readonly badge?: ReactNode;
    /** Free body content (a note, a description). */
    readonly children?: ReactNode;
    /** Footer actions. Keep them to one or two. */
    readonly actions?: ReactNode;
    /** Heading level of the title. @default 3 */
    readonly headingLevel?: 3 | 4;
    /** Root element: `li` inside an {@link EntityCardGrid}, `div` alone. @default 'li' */
    readonly as?: 'li' | 'div';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit entity card.
 *
 * @param props - See {@link EntityCardProps}.
 * @returns An `<li>` (default) or `<div>` card.
 */
export function EntityCard({
    title,
    locale,
    href,
    image,
    media,
    meta,
    badge,
    children,
    actions,
    headingLevel = 3,
    as = 'li',
    className,
    helpId
}: EntityCardProps) {
    const t = createT(locale);
    const Root = as;
    const Heading = headingLevel === 3 ? 'h3' : 'h4';

    return (
        <Root
            {...helpAttr({ helpId })}
            className={cx(styles.card, className)}
        >
            <div className={styles.media}>
                {image ? (
                    <img
                        src={image.src}
                        alt={image.alt}
                        className={styles.image}
                        loading="lazy"
                    />
                ) : media === undefined ? (
                    <div
                        className={styles.placeholder}
                        aria-hidden="true"
                    >
                        {t('account.ui.entityCard.noImage')}
                    </div>
                ) : (
                    <div
                        className={styles.visual}
                        aria-hidden="true"
                    >
                        {media}
                    </div>
                )}
                {badge === undefined ? null : <div className={styles.badge}>{badge}</div>}
            </div>
            <div className={styles.body}>
                <Heading className={styles.title}>
                    {href === undefined ? (
                        title
                    ) : (
                        <a
                            href={href}
                            className={styles.link}
                        >
                            {title}
                        </a>
                    )}
                </Heading>
                {meta === undefined ? null : <p className={styles.meta}>{meta}</p>}
                {children}
            </div>
            {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
        </Root>
    );
}

/** Props of {@link EntityCardGrid}. */
export interface EntityCardGridProps {
    /** Translated accessible name of the list. */
    readonly label: string;
    /** The `EntityCard`s. */
    readonly children: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * A responsive grid of {@link EntityCard}s.
 *
 * @param props - See {@link EntityCardGridProps}.
 * @returns A labelled `<ul>`.
 */
export function EntityCardGrid({ label, children, className, helpId }: EntityCardGridProps) {
    return (
        <div className={styles.gridWrap}>
            <ul
                {...helpAttr({ helpId })}
                aria-label={label}
                className={cx(styles.grid, className)}
            >
                {children}
            </ul>
        </div>
    );
}
