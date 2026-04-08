/**
 * @file PostCard.tsx
 * @description React card component for blog post items inside Embla carousels.
 * Displays a post thumbnail with organic-alt shape, title, author info,
 * published date, and a "Leer mas" link.
 */

import type { BlogPostCardData } from '@/data/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { ArrowRightIcon } from '@repo/icons';
import styles from './PostCard.module.css';

/** Props for the PostCard component. */
interface PostCardProps {
    /** Blog post data to display on the card. */
    readonly data: BlogPostCardData;
    /** Active locale used to build the post URL and format the date. */
    readonly locale: SupportedLocale;
    /** Optional additional CSS classes for the card root element. */
    readonly className?: string;
}

/**
 * Blog post card component designed for use inside Embla carousel slides.
 *
 * Renders a card with an organic-alt shaped thumbnail (16:9 aspect ratio),
 * post title, author avatar + name, published date, and a "Leer mas" link
 * with an arrow icon. Card shadow and hover shadow use CSS custom properties.
 *
 * @param props - {@link PostCardProps}
 * @returns A React element representing the blog post card.
 *
 * @example
 * ```tsx
 * <PostCard data={post} locale="es" />
 * ```
 */
export function PostCard({ data, locale, className }: PostCardProps) {
    const href = buildUrl({ locale, path: `publicaciones/${data.slug}` });

    const publishedDate = formatDate({ date: data.publishedAt, locale });

    return (
        <article
            className={cn(styles.card, className)}
            aria-label={`Artículo: ${data.title}`}
        >
            {/* Thumbnail */}
            {/* biome-ignore lint/a11y/useAnchorContent: decorative duplicate link, main link is on the title */}
            <a
                href={href}
                className={styles.thumbnailLink}
                tabIndex={-1}
                aria-hidden="true"
            >
                <img
                    src={data.featuredImage || '/assets/images/placeholder-blog.svg'}
                    alt={data.title}
                    loading="lazy"
                    className={styles.thumbnailImg}
                    width={300}
                    height={200}
                />
            </a>

            {/* Content */}
            <div className={styles.content}>
                {/* Title */}
                <h3 className={styles.title}>
                    <a
                        href={href}
                        className={styles.titleLink}
                    >
                        {data.title}
                    </a>
                </h3>

                {/* Author row */}
                <div className={styles.authorRow}>
                    {data.authorAvatar ? (
                        <img
                            src={data.authorAvatar}
                            alt={data.authorName}
                            className={styles.authorAvatar}
                            aria-hidden="true"
                        />
                    ) : (
                        <div
                            className={styles.authorFallback}
                            aria-hidden="true"
                        >
                            {data.authorName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className={styles.authorName}>{data.authorName}</span>
                </div>

                {/* Published date */}
                <time
                    dateTime={data.publishedAt}
                    className={styles.date}
                >
                    {publishedDate}
                </time>

                {/* Read more link */}
                <div className={styles.readMoreWrapper}>
                    <a
                        href={href}
                        className={styles.readMoreLink}
                        aria-label={`Leer más sobre ${data.title}`}
                    >
                        Leer más
                        <ArrowRightIcon
                            size={16}
                            weight="bold"
                            aria-hidden="true"
                        />
                    </a>
                </div>
            </div>
        </article>
    );
}
