/**
 * @file DestinationReviewRatingFields.tsx
 * @description Collapsible category rating fields for the destination review
 * form. The 18 dimensions are grouped into 5 collapsible categories; each
 * category header has its own star row that propagates the value to every
 * dimension in the category. Expanding a category reveals the individual
 * dimension rows so each one can be fine-tuned separately.
 *
 * UI-only grouping — the parent keeps the flat 18-dimension rating state and
 * submits it unchanged.
 */
import { cn } from '@/lib/cn';
import { useCallback, useState } from 'react';
import styles from './DestinationReviewSidebarCard.module.css';
import {
    DEFAULT_CATEGORY_LABELS,
    DEFAULT_LABELS,
    RATING_CATEGORIES,
    type RatingKey,
    type RatingState
} from './destination-rating';

function StarIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="100%"
            height="100%"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <title>Estrella</title>
            <path d="M12 2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2z" />
        </svg>
    );
}

function ChevronIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <title>Expandir</title>
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );
}

interface StarRowProps {
    readonly label: string;
    readonly value: number;
    readonly submitting: boolean;
    readonly onSet: (star: number) => void;
}

/** One labeled star-rating row (ARIA APG radiogroup/radio pattern). */
function StarRow({ label, value, submitting, onSet }: StarRowProps) {
    return (
        <div
            className={styles.starGroup}
            role="radiogroup"
            aria-label={label}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the ARIA APG pattern
                    role="radio"
                    aria-checked={value === star}
                    aria-label={`${label}: ${star}`}
                    className={cn(styles.starButton, star <= value && styles.starButtonOn)}
                    onClick={() => onSet(star)}
                    disabled={submitting}
                >
                    <StarIcon />
                </button>
            ))}
        </div>
    );
}

interface DestinationReviewRatingFieldsProps {
    readonly ratings: RatingState;
    readonly submitting: boolean;
    /** Instance-unique prefix for DOM ids (two islands coexist on the page). */
    readonly idPrefix: string;
    /** Translate helper from the parent island (key, fallback). */
    readonly t: (key: string, fallback: string) => string;
    /** Sets one dimension to a star value. */
    readonly onSetDimension: (key: RatingKey, star: number) => void;
    /** Sets every dimension of a category to a star value. */
    readonly onSetCategory: (dims: readonly RatingKey[], star: number) => void;
}

/**
 * Renders the 5 collapsible category blocks for the destination review form.
 *
 * Collapsed: the category star row shows the common value of its dimensions
 * (or unset when they diverge) and propagates clicks to all of them.
 * Expanded: each dimension gets its own star row for individual control.
 *
 * @param props - Flat rating state plus dimension/category setters
 */
export function DestinationReviewRatingFields({
    ratings,
    submitting,
    idPrefix,
    t,
    onSetDimension,
    onSetCategory
}: DestinationReviewRatingFieldsProps) {
    const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({});

    const toggle = useCallback((key: string) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    }, []);

    return (
        <div
            className={styles.ratingList}
            aria-label={t('review.form.ratingLabel', 'Calificación')}
        >
            <p className={styles.categoryHint}>
                {t(
                    'review.form.destination.categoryHint',
                    'Calificá cada categoría, o desplegala para afinar cada aspecto.'
                )}
            </p>
            {RATING_CATEGORIES.map((category) => {
                const label = t(
                    `destination.rating.categories.${category.key}`,
                    DEFAULT_CATEGORY_LABELS[category.key] ?? category.key
                );
                // Header stars show the rounded average of the rated dimensions
                // (so a per-dimension override keeps a meaningful header value).
                const ratedDims = category.dims.filter((dim) => ratings[dim] >= 1);
                const categoryValue =
                    ratedDims.length === 0
                        ? 0
                        : Math.round(
                              ratedDims.reduce((sum, dim) => sum + ratings[dim], 0) /
                                  ratedDims.length
                          );
                const ratedCount = ratedDims.length;
                const isOpen = expanded[category.key] === true;
                const dimsId = `${idPrefix}-cat-${category.key}`;

                return (
                    <div
                        key={category.key}
                        className={styles.categoryBlock}
                    >
                        <div className={styles.categoryHeader}>
                            <button
                                type="button"
                                className={styles.categoryToggle}
                                aria-expanded={isOpen}
                                aria-controls={dimsId}
                                onClick={() => toggle(category.key)}
                            >
                                <span
                                    className={cn(
                                        styles.categoryChevron,
                                        isOpen && styles.categoryChevronOpen
                                    )}
                                >
                                    <ChevronIcon />
                                </span>
                                <span className={styles.categoryLabel}>{label}</span>
                                <span className={styles.categoryCount}>
                                    {ratedCount}/{category.dims.length}
                                </span>
                            </button>
                            <StarRow
                                label={label}
                                value={categoryValue}
                                submitting={submitting}
                                onSet={(star) => onSetCategory(category.dims, star)}
                            />
                        </div>
                        {isOpen && (
                            <div
                                id={dimsId}
                                className={styles.categoryDims}
                            >
                                {category.dims.map((dim) => (
                                    <div
                                        key={dim}
                                        className={styles.ratingRow}
                                    >
                                        <span className={styles.ratingLabel}>
                                            {t(
                                                `destination.rating.dimensions.${dim}`,
                                                DEFAULT_LABELS[dim]
                                            )}
                                        </span>
                                        <StarRow
                                            label={t(
                                                `destination.rating.dimensions.${dim}`,
                                                DEFAULT_LABELS[dim]
                                            )}
                                            value={ratings[dim]}
                                            submitting={submitting}
                                            onSet={(star) => onSetDimension(dim, star)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
