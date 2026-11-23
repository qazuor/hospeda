/**
 * ListingCard and ListingCardGrid — one card per listing an owner manages
 * (HOS-2483, spec HOS-2414 §6.2). Shared by the properties list and the venue
 * and experience lists; the vertical is a prop.
 *
 * Anatomy: a media block (the listing photo, or the vertical's icon tile when
 * there is none), the title (a real link when `href` is given), a `status`
 * (a StatusPill: the word, never color alone), `meta` lines (location, price,
 * type), a free body (`children`: notices, a checklist), then the action row:
 * ONE `primaryAction` and a `menu` (the kit `Menu`) with everything else.
 * `footer` holds a secondary block below the actions (e.g. a QR panel).
 *
 * Pure presentation: every text arrives translated, and the actions arrive
 * built (the card does not know what publishing means). Interactive parts
 * (`primaryAction`, `menu`) live in islands passed as nodes.
 *
 * @module components/account/ui/ListingCard
 */

import { BuildingIcon, CompassIcon, type IconProps, VenueIcon } from '@repo/icons';
import type { ComponentType, ReactNode } from 'react';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './ListingCard.module.css';

/** The listing verticals a card can show. */
export type ListingCardVertical = 'accommodation' | 'venue' | 'experience';

/** Icon of the tile shown when a listing has no photo. */
const VERTICAL_ICON: Readonly<Record<ListingCardVertical, ComponentType<IconProps>>> = {
    accommodation: BuildingIcon,
    venue: VenueIcon,
    experience: CompassIcon
};

/** The listing photo. */
export interface ListingCardImage {
    /** Final URL, already transformed by the caller (`getMediaUrl`). */
    readonly src: string;
    /** Translated alternative text. */
    readonly alt: string;
}

/** Props of {@link ListingCard}. */
export interface ListingCardProps {
    /** The listing name. */
    readonly title: ReactNode;
    /** Which vertical the listing belongs to (icon tile, `data-vertical`). */
    readonly vertical: ListingCardVertical;
    /** Destination of the title link (usually the editor). Plain text without it. */
    readonly href?: string;
    /** The listing photo. Without it the card shows the vertical's icon tile. */
    readonly image?: ListingCardImage;
    /** A StatusPill with the publication status. */
    readonly status?: ReactNode;
    /** Short facts under the title, one line each (location, price, type). */
    readonly meta?: readonly ReactNode[];
    /** Free body: notices, a checklist. */
    readonly children?: ReactNode;
    /** The ONE visible action (a Button, LinkButton or an island rendering one). */
    readonly primaryAction?: ReactNode;
    /** The other actions: a kit `Menu`. */
    readonly menu?: ReactNode;
    /** A secondary block below the actions (e.g. the QR panel). */
    readonly footer?: ReactNode;
    /** Heading level of the title. @default 3 */
    readonly headingLevel?: 2 | 3;
    /**
     * Root element: a `role="listitem"` block inside a {@link ListingCardGrid},
     * an `article` when the card stands alone. @default 'listitem'
     */
    readonly as?: 'listitem' | 'article';
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit listing card.
 *
 * @param props - See {@link ListingCardProps}.
 * @returns A `role="listitem"` block (default) or an `<article>` card.
 */
export function ListingCard({
    title,
    vertical,
    href,
    image,
    status,
    meta,
    children,
    primaryAction,
    menu,
    footer,
    headingLevel = 3,
    as = 'listitem',
    className,
    helpId
}: ListingCardProps) {
    const Heading = headingLevel === 2 ? 'h2' : 'h3';
    const Icon = VERTICAL_ICON[vertical];
    const hasActions = primaryAction !== undefined || menu !== undefined;

    return (
        <CardRoot
            as={as}
            {...helpAttr({ helpId })}
            data-vertical={vertical}
            className={cx(styles.card, image ? undefined : styles.withTile, className)}
        >
            {image ? (
                <div className={styles.media}>
                    <img
                        src={image.src}
                        alt={image.alt}
                        className={styles.image}
                        loading="lazy"
                        decoding="async"
                    />
                </div>
            ) : (
                <div
                    className={styles.tile}
                    aria-hidden="true"
                >
                    <Icon size="md" />
                </div>
            )}
            <div className={styles.body}>
                <div className={styles.heading}>
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
                    {status}
                </div>
                {meta && meta.length > 0 ? (
                    <ul className={styles.meta}>
                        {meta.map((line, index) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered display lines with no state.
                            <li key={index}>{line}</li>
                        ))}
                    </ul>
                ) : null}
                {children}
            </div>
            {hasActions ? (
                <div className={styles.actions}>
                    <div className={styles.primary}>{primaryAction}</div>
                    {menu}
                </div>
            ) : null}
            {footer === undefined ? null : <div className={styles.footer}>{footer}</div>}
        </CardRoot>
    );
}

/** Props of {@link CardRoot}. */
interface CardRootProps {
    readonly as: 'listitem' | 'article';
    readonly className: string;
    readonly children: ReactNode;
    readonly 'data-vertical': ListingCardVertical;
    readonly 'data-help'?: HelpAnchor;
}

/** The card's root: an ARIA list item, or an `article`. */
function CardRoot({ as, children, ...rest }: CardRootProps) {
    return as === 'article' ? (
        <article {...rest}>{children}</article>
    ) : (
        // biome-ignore lint/a11y/useSemanticElements: an <li> needs a <ul>/<ol> parent, and the grid cannot be one (see ListingCardGrid).
        <div
            role="listitem"
            {...rest}
        >
            {children}
        </div>
    );
}

/** Props of {@link ListingCardGrid}. */
export interface ListingCardGridProps {
    /** Translated accessible name of the list. */
    readonly label: string;
    /** The `ListingCard`s. */
    readonly children: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * A responsive grid of {@link ListingCard}s: one column, two from 40rem of its
 * own width, three from 64rem.
 *
 * It is an ARIA list of `div`s, not a `<ul>`: an Astro page that passes the
 * cards as children has them wrapped in `<astro-static-slot>`, which is not
 * valid inside a `<ul>` but is fine (and `display: contents`) inside a `div`.
 *
 * @param props - See {@link ListingCardGridProps}.
 * @returns A labelled `role="list"` block.
 */
export function ListingCardGrid({ label, children, className, helpId }: ListingCardGridProps) {
    return (
        <div className={styles.gridWrap}>
            {/* biome-ignore lint/a11y/useSemanticElements: Astro wraps slotted cards in <astro-static-slot>, which a <ul> may not contain. */}
            <div
                role="list"
                {...helpAttr({ helpId })}
                aria-label={label}
                className={cx(styles.grid, className)}
            >
                {children}
            </div>
        </div>
    );
}
