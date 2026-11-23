/**
 * RatingStars — a read-only star rating (HOS-2502, spec §6.1).
 *
 * Replaces the three star styles the account pages grew (a glyph in a badge,
 * a row of emoji, an inline SVG). The whole control is ONE image named by
 * `label` («Calificación: 4,5 de 5»): the individual stars and the optional
 * number are decorative, so a screen reader hears the rating once.
 *
 * Fractions are drawn: the filled layer of each star is clipped to its share
 * of the value, so 3.5 shows three full stars and a half one.
 *
 * Pure presentation: the label arrives translated.
 *
 * @module components/account/ui/RatingStars
 */
import { StarIcon } from '@repo/icons';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './RatingStars.module.css';

/** Props of {@link RatingStars}. */
export interface RatingStarsProps {
    /** The rating, 0 to `max`. Values outside the range are clamped. */
    readonly value: number;
    /** Number of stars. @default 5 */
    readonly max?: number;
    /** REQUIRED translated accessible name that says the rating in words. */
    readonly label: string;
    /** Shows the numeric value after the stars. @default false */
    readonly showValue?: boolean;
    /** Locale-formatted text for the number (`4,6`). Defaults to the plain value. */
    readonly valueText?: string;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Share of star `index` (0-based) that is filled, 0 to 1.
 *
 * @param input - Options object.
 * @param input.value - The rating, already clamped.
 * @param input.index - 0-based star position.
 * @returns A number between 0 and 1.
 */
export function starFill({
    value,
    index
}: {
    readonly value: number;
    readonly index: number;
}): number {
    return Math.min(1, Math.max(0, value - index));
}

/**
 * The kit read-only star rating.
 *
 * @param props - See {@link RatingStarsProps}.
 * @returns A `<span role="img">` named by `label`.
 */
export function RatingStars({
    value,
    max = 5,
    label,
    showValue = false,
    valueText,
    className,
    helpId
}: RatingStarsProps) {
    const clamped = Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
    const stars = Array.from({ length: max }, (_, index) => index);
    return (
        <span
            {...helpAttr({ helpId })}
            role="img"
            aria-label={label}
            className={cx(styles.root, className)}
        >
            <span
                className={styles.stars}
                aria-hidden="true"
            >
                {stars.map((index) => (
                    <span
                        key={index}
                        className={styles.star}
                    >
                        <StarIcon
                            size={16}
                            weight="regular"
                            color="currentColor"
                            className={styles.empty}
                        />
                        <span
                            className={styles.fill}
                            style={{ inlineSize: `${starFill({ value: clamped, index }) * 100}%` }}
                        >
                            <StarIcon
                                size={16}
                                weight="fill"
                                color="currentColor"
                                className={styles.filled}
                            />
                        </span>
                    </span>
                ))}
            </span>
            {showValue ? (
                <span
                    className={styles.value}
                    aria-hidden="true"
                >
                    {valueText ?? Number(clamped.toFixed(1))}
                </span>
            ) : null}
        </span>
    );
}
