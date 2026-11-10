/**
 * @file VenueReviewDimensionFields.client.tsx
 * @description Optional per-dimension star rows of the venue review form
 * (HOS-1866 / 6.6, AC:6:10).
 *
 * The dimensions arrive already resolved from
 * `resolveOfferedReviewDimensions({ vertical, sectionStates })`, and each row
 * renders the catalog's own `labelKey`. Nothing here compares a vertical,
 * listing type, section id or dimension id (G-FAC-05). Every row is optional:
 * tapping the star already chosen clears that dimension's vote through
 * `onVote`, so the value can never get stuck.
 *
 * The star glyph is declared here on purpose: importing it from
 * `VenueReviewForm.client.tsx` would create an import cycle.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type {
    OfferedReviewDimension,
    ReviewDimensionVotes
} from '@/lib/venue/review-dimensions-view';
import styles from './VenueReviewForm.module.css';

const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

interface VenueReviewDimensionFieldsProps {
    /** Dimensions the form may offer, already filtered by section state. */
    readonly dimensions: readonly OfferedReviewDimension[];
    /** Votes keyed by dimension id; an absent key means "not voted". */
    readonly votes: ReviewDimensionVotes;
    /** Toggles one dimension's vote (sets it, or clears the current one). */
    readonly onVote: (dimensionId: string, value: number) => void;
    /** Disables every star while a submission is in flight. */
    readonly disabled: boolean;
    /** Active locale for the labels. */
    readonly locale: SupportedLocale;
}

/**
 * Readable fallback for a missing translation: the catalog's label key without
 * its namespace. The keys exist in es/en/pt, so this only guards a bad deploy.
 *
 * @param labelKey - The catalog-declared i18n key.
 * @returns The bare dimension id.
 */
function labelFallback(labelKey: string): string {
    return labelKey.replace('review.dimensions.', '');
}

/**
 * VenueReviewDimensionFields — one optional star row per offered dimension.
 *
 * @param props - Component props (see {@link VenueReviewDimensionFieldsProps}).
 */
export function VenueReviewDimensionFields({
    dimensions,
    votes,
    onVote,
    disabled,
    locale
}: VenueReviewDimensionFieldsProps) {
    const { t } = createTranslations(locale);

    if (dimensions.length === 0) return null;

    return (
        <>
            <p className={styles.fieldLabel}>
                {t('review.form.dimensions.title', 'Calificá por aspecto')}
            </p>
            {dimensions.map((dimension) => {
                const current = votes[dimension.id] ?? 0;
                const label = t(dimension.labelKey, labelFallback(dimension.labelKey));
                return (
                    <div
                        key={dimension.id}
                        className={styles.ratingRow}
                    >
                        <span className={styles.ratingLabel}>
                            {label}
                            <span className={styles.fieldOptional}>
                                {t('review.form.dimensions.optional', 'Opcional')}
                            </span>
                        </span>
                        <div
                            className={styles.starGroup}
                            role="radiogroup"
                            aria-label={label}
                        >
                            {STAR_POSITIONS.map((star) => (
                                // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the ARIA APG pattern for star ratings; <input type=radio> can't host the star glyph.
                                <button
                                    key={star}
                                    type="button"
                                    role="radio"
                                    aria-checked={current === star}
                                    aria-label={`${star}`}
                                    className={cn(
                                        styles.starButton,
                                        star <= current && styles.starButtonOn
                                    )}
                                    onClick={() => onVote(dimension.id, star)}
                                    disabled={disabled}
                                >
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
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
            <p className={styles.helpText}>
                {t(
                    'review.form.dimensions.removeHint',
                    'Tocá de nuevo la estrella elegida para quitar tu voto'
                )}
            </p>
        </>
    );
}
